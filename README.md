# GPU Broker · Researcher and admin workspaces

Next.js App Router interface for researchers to describe workloads, review GPU
recommendations, and submit requests to the platform team. Uses the existing
Supabase project and the Flask AI agent. Admins review submitted requests and
record approval or rejection. No GPU resources are provisioned here.

## Run locally

Requires Node.js 22.22 or newer.

```bash
npm install
npm run dev
```

Open the printed local URL and sign in with a Supabase account. The existing
signup, email-confirmation, password-recovery, and password-update flows are
retained. The Flask service must be running separately.

Configure `.env.local` (never commit this file):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_FLASK_URL=http://127.0.0.1:5000
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

The current database policies block researcher-session inserts into `requests`,
so the app uses the service-role key **on the server only**, after independently
verifying the session. Researcher request reads/updates are restricted to that
verified user ID; inserts set the owner on the server. Admin reads and decisions
require an independent database admin-flag check. No service key is sent to the
browser. Existing database policies and generated types are not changed.

If you later allow researcher-session CRUD through RLS and omit the service key,
set a strong random `GPU_BROKER_SIGNING_SECRET` instead. A server signing key is
required to verify agent results before saving. When a service key is present it
also provides that signing key; `GPU_BROKER_SIGNING_SECRET` can override it.

## Researcher flow

- `/`: owned requests, pagination, draft/submitted filters, and full request-ID lookup.
- `/requests/new`: chat with the agent and see applicable workload values update.
- `/requests/[id]`: resume an autosaved draft or inspect a submitted request.
- `/requests/[id]/review`: inspect memory, GPU, estimated training time, and assumptions.
- `/help`: explain the describe → review → submit workflow.

The workload summary labels user inputs, model defaults, workflow defaults, and
estimated architecture. Inference hides training-only fields and states that
runtime is not estimated. Allocation duration is intentionally omitted.

The browser calls authenticated `POST /api/gpu/chat`, which forwards only
`message` and the previous `state` to `${NEXT_PUBLIC_FLASK_URL}/api/gpu/chat`.
This keeps the existing Flask contract and avoids browser CORS configuration.
The handler uses a 100-second upstream timeout and never automatically resends a
chat message. Session failures, upstream errors, and invalid responses are shown
with retry controls.

## Persistence and status

The app uses the existing `requests.chat_history` and `requests.agent_result`
JSON columns. Chat history contains `{ id, role, content, createdAt }` messages;
the agent-result column contains the complete latest Flask response, including
the resumable state. Both are saved together after each successful agent turn.
The draft ID remains stable during retries. A failed save can be retried without
calling the agent again. Optimistic `updated_at` checks reject stale writes.

Server-issued result receipts prevent client-modified recommendation snapshots
from being written through privileged server actions. The receipt is bound to
the verified user; it is not a Supabase credential and is not stored in the row.

Existing request statuses are used exactly as configured:

| ID  | Database name            | UI meaning                          |
| --- | ------------------------ | ----------------------------------- |
| 1   | `draft`                  | Editable, autosaved conversation    |
| 2   | `researcher_confirmed`   | Submitted, awaiting platform review |
| 3   | `platform_team_reviewed` | Reviewed                            |
| 4   | `provisioning_started`   | Provisioning started                |
| 5   | `approved`               | Approved, provisioning not started  |
| 6   | `rejected`               | Rejected, read-only                 |

**Confirm & submit** conditionally moves an owned, ready draft from 1 to 2.
Repeated confirmation is idempotent. All non-draft states are read-only in the
researcher interface. Admin review records approved (5) or rejected (6) decisions. This application
never advances requests to provisioning (4), and reviewed (3) remains distinct
from approved.

## Verification

```bash
npm test
npx tsc --noEmit
npm run build
npm start
```

The Node tests cover agent-response validation, inference field visibility,
message parsing, JSONB-safe retry comparison, formatting, and status semantics.
Authenticated HTTP integration checks were also run against a temporary test
account and local mock agent: draft saving/resume, stale writes, ownership,
tamper rejection, confirmation, submitted locking, and upstream failures.
The temporary test account and request records are removed after verification.

Next.js retains Cache Components and Partial Prefetching. Session-dependent
content is under Suspense and is not shared through server-side user-data caches.

## Admin workspace

Admins sign in through the same login page and are directed to `/admin`.
Create their Supabase Auth account first, then manually insert a `public.users`
row with `user_id` equal to that account's Auth UUID and `is_admin = true`.
Email is optional. Researchers do not need rows in `public.users`; signup is
unchanged and no profiles, migrations, or triggers are created by this app.

`/admin` lists submitted requests with pending/all/approved/rejected filters,
20-row pagination, and full request-ID lookup. `/admin/requests/[id]` shows the
complete saved conversation, workload values and provenance, recommendation,
agent explanation, and estimation assumptions. Researchers without profile
emails are identified by their user ID. Drafts are excluded from admin access.

Each admin page and action verifies the session and reads the current database
flag; missing profiles, false flags, and lookup failures never grant access.
The service-role key remains server-only. Ensure Supabase's database policies
also prevent ordinary clients from changing `users.is_admin` or another user's
requests. This application provides no profile/admin-management write endpoint.

Approve and Reject apply only to states 2 and 3 and set state 5 or 6. Conditional
status/timestamp updates prevent stale reviews from overwriting decisions.
Identical retries are idempotent; conflicting decisions require refresh.
Decided and provisioning requests cannot be changed by this interface.
Admins can use the header Workspace link for their own researcher requests.
No provisioning or agent calls occur during admin review.

To repeat the admin HTTP suite, run `npm run build`, start the production server
with `npm start -- --hostname 127.0.0.1 --port 3100`, then run
`node --experimental-strip-types tests/admin.integration.mjs` in another terminal.
It uses `.env.local` to create disposable test accounts and requests and removes
those fixtures in a `finally` block. It checks authorization, manually assigned
roles, database self-promotion protection, review decisions, conflicting writes,
request details, pagination, researcher ownership, and role revocation.
`GPU_UI_TEST_URL` can override the local test-server URL.
