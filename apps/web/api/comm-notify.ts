// Vercel Edge Function — Manager Alerts agent.
// No SDKs required: calls OpenRouter REST API + Supabase REST API directly via fetch.
export const config = {
  runtime: 'edge',
  maxDuration: 60,
};

// --- Config (set these in Vercel env) -------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OR_API_KEY = process.env.OPENROUTER_API_KEY;
const OR_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const OR_REFERER = process.env.OPENROUTER_REFERER || 'https://mep.app';
const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET;

// --- JSON Schema for structured OpenRouter output -------------------------
const ALERT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    suggestedOptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          action: { type: 'string' },
        },
        required: ['label', 'action'],
        additionalProperties: false,
      },
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ['summary', 'suggestedOptions'],
  additionalProperties: false,
};

// --- Supabase REST helpers (service role bypasses RLS) --------------------
function sbHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_KEY || '',
    Authorization: `Bearer ${SERVICE_KEY || ''}`,
    'Content-Type': 'application/json',
  };
}

async function sbGetOne<T>(table: string, query: string, select = '*'): Promise<T | null> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&${query}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return null;
  const rows = (await res.json()) as T[];
  return rows?.[0] ?? null;
}

async function sbInsert(table: string, row: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  return res.ok;
}

// --- Webhook signature verification (Web Crypto / HMAC-SHA256) ------------
async function verifySignature(body: string, signature: string | null): Promise<boolean> {
  if (!WEBHOOK_SECRET) return true; // skip if not configured
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return signature === `sha256=${hex}` || signature === hex;
}

// --- OpenRouter call (structured JSON output) -----------------------------
async function generateAlert(prompt: string): Promise<{ summary: string; suggestedOptions: { label: string; action: string }[] } | null> {
  if (!OR_API_KEY) {
    console.error('OPENROUTER_API_KEY missing');
    return null;
  }
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OR_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': OR_REFERER,
      'X-Title': 'MEP Manager Alerts',
    },
    body: JSON.stringify({
      model: OR_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an operations assistant that briefs a manager/MD about new communication log entries from team members. Always return valid JSON matching the provided schema.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'manager_alert', strict: true, schema: ALERT_SCHEMA } },
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    console.error('OpenRouter error', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (!parsed.summary || !Array.isArray(parsed.suggestedOptions)) return null;
    return { summary: parsed.summary, suggestedOptions: parsed.suggestedOptions.slice(0, 3) };
  } catch {
    return null;
  }
}

// --- Handler ---------------------------------------------------------------
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const raw = await request.text();
  const signature = request.headers.get('x-supabase-signature');
  if (!(await verifySignature(raw, signature))) {
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (payload?.type !== 'INSERT' || payload?.table !== 'client_communication') {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const record = payload.record || {};
  const communicationId = record.id;
  const organisationId = record.organisation_id;
  if (!communicationId || !organisationId || !SUPABASE_URL || !SERVICE_KEY) {
    return new Response('Missing data or Supabase config', { status: 400 });
  }

  try {
    const [empRow, partyRow] = await Promise.all([
      record.call_entered_by ? sbGetOne<{ full_name: string }>('user_profiles', `user_id=eq.${record.call_entered_by}`, 'full_name') : Promise.resolve(null),
      record.client_id
        ? sbGetOne<{ client_name: string }>('clients', `id=eq.${record.client_id}`, 'client_name')
        : Promise.resolve(null),
    ]);

    const who = empRow?.full_name || 'An employee';
    const partyName = partyRow?.client_name || null;
    const party = partyName ? ` with ${partyName}` : '';
    const channel = record.call_category || record.call_regarding || 'communication';
    const context = [
      `Channel: ${channel}`,
      record.subject ? `Subject: ${record.subject}` : null,
      record.call_brief ? `Brief: ${record.call_brief}` : null,
      record.priority ? `Priority: ${record.priority}` : null,
      record.next_action ? `Existing next action: ${record.next_action}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = `You are an operations assistant that briefs a manager/MD about a new communication log entry.

${who} (employee) just logged a ${channel}${party}.

${context}

Write a concise one-sentence summary for the manager describing what the employee logged.
Then propose exactly 3 distinct, practical next-action options the manager could take in response.`;

    const ai = await generateAlert(prompt);

    const summary = ai?.summary || `${who} logged a ${channel}${party}.`;
    const suggestedOptions =
      ai?.suggestedOptions || [
        { label: 'Acknowledge', action: 'Mark as seen and assign a follow-up owner.' },
        { label: 'Reply', action: 'Respond to the employee or the party directly.' },
        { label: 'Schedule', action: 'Add a follow-up task with a due date.' },
      ];

    await sbInsert('manager_alerts', {
      organisation_id: organisationId,
      communication_id: communicationId,
      logged_by: record.call_entered_by ?? null,
      logged_by_name: empRow?.full_name ?? null,
      party_type: record.party_type ?? null,
      party_name: partyName,
      summary,
      suggested_options: suggestedOptions,
      status: 'new',
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('comm-notify error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
