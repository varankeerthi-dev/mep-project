// Vercel Edge Function — overnight auto-draft of "today's" work instructions.
// Pure fetch + Web Crypto (no SDKs). Idempotent: only populates a draft when it
// was just created; close-out (evening) is what normally populates tomorrow's draft.
export const config = {
  runtime: 'edge',
  maxDuration: 60,
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbHeaders() {
  return {
    apikey: SERVICE_KEY || '',
    Authorization: `Bearer ${SERVICE_KEY || ''}`,
    'Content-Type': 'application/json',
  };
}

async function sbSelect<T = any>(table: string, query: string, select = '*'): Promise<T[]> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&${query}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) {
    console.error('sbSelect failed', table, res.status, await res.text());
    return [];
  }
  return (await res.json()) as T[];
}

async function sbGetOne<T = any>(table: string, query: string, select = '*'): Promise<T | null> {
  const rows = await sbSelect<T>(table, query, select);
  return rows?.[0] ?? null;
}

async function sbInsert(table: string, row: Record<string, unknown>): Promise<any | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    console.error('sbInsert failed', table, res.status, await res.text());
    return null;
  }
  const rows = (await res.json()) as any[];
  return rows?.[0] ?? null;
}

function dateStr(d: Date): string {
  // UTC date (cron runs in UTC). Note timezone caveat in plan.
  return d.toISOString().slice(0, 10);
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response('Missing Supabase config', { status: 400 });
  }

  try {
    const now = new Date();
    const today = dateStr(now);
    const yesterday = dateStr(new Date(now.getTime() - 24 * 3600 * 1000));

    // 1. Orgs that had work yesterday (so we know who to carry forward for).
    const orgRows = await sbSelect<{ organisation_id: string }>(
      'work_instructions',
      `select=organisation_id&date=eq.${yesterday}&organisation_id=not.is.null`,
      'organisation_id',
    );
    const orgIds = [...new Set((orgRows || []).map((r) => r.organisation_id).filter(Boolean))];

    let created = 0;
    for (const org of orgIds) {
      // 2a. Yesterday's postponed work_items (carried forward).
      const postponed = await sbSelect<any>(
        'work_items',
        `select=id,description,assignees,project_id,project_activity_id,work_instructions(client_name,organisation_id,date)` +
          `&work_instructions.organisation_id=eq.${org}` +
          `&work_instructions.date=eq.${yesterday}` +
          `&status=eq.postponed`,
        '*',
      );

      // 2b. Yesterday's site reports → engineer "next plan" items.
      const reports = await sbSelect<any>(
        'site_reports',
        `select=id,client_id,clients(client_name),site_report_work_plan_next_day(description)` +
          `&report_date=eq.${yesterday}` +
          `&client_id=not.is.null` +
          `&organisation_id=eq.${org}`,
        '*',
      );

      // 3. Bucket by client_name.
      const byClient = new Map<string, { carried: any[]; suggested: string[] }>();
      const bucket = (cn: string) => {
        if (!byClient.has(cn)) byClient.set(cn, { carried: [], suggested: [] });
        return byClient.get(cn)!;
      };

      for (const it of postponed || []) {
        const cn = it.work_instructions?.client_name;
        if (!cn) continue;
        bucket(cn).carried.push(it);
      }
      for (const rep of reports || []) {
        const cn = rep.clients?.client_name;
        if (!cn) continue;
        for (const p of rep.site_report_work_plan_next_day || []) {
          if (p?.description) bucket(cn).suggested.push(p.description);
        }
      }

      // 4. Per client: ensure today's draft exists; populate only if freshly created.
      for (const [clientName, data] of byClient) {
        if (data.carried.length === 0 && data.suggested.length === 0) continue;

        const existing = await sbGetOne(
          'work_instructions',
          `select=id&organisation_id=eq.${org}&date=eq.${today}&client_name=eq.${encodeURIComponent(clientName)}`,
          'id',
        );
        if (existing) continue; // already present (close-out populated it)

        const draft = await sbInsert('work_instructions', {
          organisation_id: org,
          date: today,
          client_name: clientName,
          status: 'draft',
          created_by: null,
        });
        if (!draft?.id) continue;

        for (const it of data.carried) {
          await sbInsert('work_items', {
            work_instruction_id: draft.id,
            description: it.description,
            assignees: Array.isArray(it.assignees) ? it.assignees : [],
            project_id: it.project_id ?? null,
            project_activity_id: it.project_activity_id ?? null,
            status: 'pending',
            source: 'manager',
            carried_forward_from: it.id,
          });
        }
        for (const desc of data.suggested) {
          await sbInsert('work_items', {
            work_instruction_id: draft.id,
            description: desc,
            assignees: [],
            status: 'suggested',
            source: 'engineer_suggested',
          });
        }
        created++;
      }
    }

    return new Response(JSON.stringify({ ok: true, created }), { status: 200 });
  } catch (err) {
    console.error('work-instruction-draft error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
