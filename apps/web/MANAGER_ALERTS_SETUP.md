# Manager Alerts — AI Agent Setup

An event-driven AI agent that watches the `client_communication` table, briefs the
MD/manager ("Employee X logged this ___"), and suggests 3 next-action options on a
web dashboard.

## What was added

| File | Purpose |
|------|---------|
| `supabase-manager-alerts.sql` | Creates `manager_alerts` table + RLS policies |
| `api/comm-notify.ts` | Vercel **Edge Function** (Supabase DB webhook → OpenRouter REST API → Supabase REST API) |
| `src/pages/ManagerAlerts.tsx` | Manager/MD dashboard (live updates via Postgres realtime) |
| `src/App.tsx` | Route `/manager-alerts` |
| `src/components/Sidebar.tsx` | "Manager alerts" nav link |
| `package.json` | Added `ai` + `@ai-sdk/openai` |

## 1. Run the migration

Run `supabase-manager-alerts.sql` in the Supabase SQL editor.

## 2. Set Vercel environment variables

In Vercel → Project → Settings → Environment Variables (also works in `.env.local` for `vercel dev`):

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # Project Settings → API
SUPABASE_WEBHOOK_SECRET=<any-secret-you-choose> # optional but recommended
OPENROUTER_API_KEY=<from openrouter.ai/keys>
OPENROUTER_MODEL=openai/gpt-4o-mini             # any OpenRouter slug
```

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS for server inserts. Keep it secret.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are for the client only and are
  already set.
- The agent is a **Vercel Edge Function** (`api/comm-notify.ts`, `runtime: 'edge'`) that uses
  only built-in `fetch` — no SDKs to install. It calls the OpenRouter REST API
  (`/api/v1/chat/completions`) with a `json_schema` response format for structured output,
  and writes the result via the Supabase REST API using the service-role key.
  Model is controlled by `OPENROUTER_MODEL`
  (e.g. `openai/gpt-4o-mini`, `anthropic/claude-3.5-sonnet`, or `tencent/hy3:free`).

## 3. Create the Supabase database webhook (the event trigger)

1. Supabase → Database → Webhooks → "Create a new webhook".
2. Trigger: **Table changes** on `client_communication`, events = **Insert** only.
3. Webhook endpoint: `https://<your-vercel-domain>/api/comm-notify`
   (for local testing use `vercel dev` and point it at `http://localhost:3000/api/comm-notify`).
4. HTTP POST, payload format = **JSON**.
5. Under "Webhook secrets", set the secret and copy it into `SUPABASE_WEBHOOK_SECRET`.

Now, every time a team member logs a communication, the agent fires, summarizes it,
and pushes options to `/manager-alerts`.

## 4. Manager flow

- Manager opens **Manager alerts** in the sidebar.
- Each card shows who logged what + 3 suggested next actions.
- Clicking an option marks it **actioned**; "Acknowledge" marks it seen.
- New alerts appear live (Postgres realtime subscription).

## Notes / tuning

- The model and prompt live in `api/comm-notify.ts`. Change `NVIDIA_CHAT_MODEL` or the
  prompt to adjust tone/options (e.g. 2 vs 3 options, include due dates).
- If the AI call fails, the function falls back to a plain summary so the dashboard
  still receives the entry.
- To restrict the dashboard to MD/manager only, wrap the route in a `PermissionGuard`
  or add a role check (org_members.role = 'admin' | 'manager').
