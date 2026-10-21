// Opt-in HTTP tests: run against a local production server after npm run build.
// Only disposable Auth accounts and their own request rows are created/deleted.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { FIELD_LABELS, parseAgentResult } from "../lib/broker.ts";

try {
  process.loadEnvFile(".env.local");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const base = process.env.GPU_UI_TEST_URL || "http://127.0.0.1:3100";
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Use a local test server.",
);
assert.ok(
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  "A server-only service key is required for disposable fixtures.",
);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const accounts = [],
  ids = [];
let checks = 0;
function pass(name) {
  checks++;
  console.log(`PASS ${name}`);
}
function checked(response) {
  if (response.error) throw response.error;
  return response.data;
}
async function account(role) {
  const email = `gpu-admin-qa-${role}-${randomUUID()}@example.com`;
  const password = randomUUID() + "Aa1!";
  const user = checked(
    await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { is_admin: true },
    }),
  ).user;
  accounts.push(user.id);
  const cookies = new Map();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (items) => items.forEach((c) => cookies.set(c.name, c.value)),
      },
    },
  );
  checked(await client.auth.signInWithPassword({ email, password }));
  return {
    user,
    client,
    cookie: () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
  };
}
async function page(path, who) {
  const response = await fetch(base + path, {
    headers: who ? { Cookie: who.cookie() } : {},
    redirect: "manual",
  });
  return { response, text: await response.text() };
}
function unavailable(page) {
  // With streamed Suspense, Next.js sends the 404 fallback inside a 200 response.
  assert.ok(
    page.response.status === 404 ||
      page.text.includes("NEXT_HTTP_ERROR_FALLBACK;404"),
    "Expected an inaccessible request fallback",
  );
}
let manifest;
async function action(name, args, who) {
  manifest ||= JSON.parse(
    await readFile(
      new URL(
        "../.next/server/server-reference-manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const entry = Object.entries(manifest.node).find(
    ([, value]) => value.exportedName === name,
  );
  assert.ok(entry, `Missing server action: ${name}`);
  const path =
    name === "decideRequest"
      ? `/admin/requests/${args[0]}`
      : name === "confirmRequest"
        ? `/requests/${args[0]}/review`
        : "/requests/new";
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      ...(who ? { Cookie: who.cookie() } : {}),
      Origin: base,
      "Content-Type": "text/plain;charset=UTF-8",
      "Next-Action": entry[0],
    },
    body: JSON.stringify(args),
    redirect: "manual",
  });
  const text = await response.text();
  for (const line of text.split("\n")) {
    const match = line.match(/^\w+:(\{.*\})$/);
    if (match) {
      try {
        const value = JSON.parse(match[1]);
        if (typeof value.ok === "boolean") return value;
      } catch {}
    }
  }
  // The authentication proxy may reject anonymous action requests before dispatch.
  if (!who && (response.status === 307 || response.status === 401))
    return { ok: false };
  throw new Error(
    `Unexpected action response ${response.status}: ${text.slice(0, 150)}`,
  );
}
const fields = Object.fromEntries(
  Object.keys(FIELD_LABELS).map((k) => [k, null]),
);
Object.assign(fields, {
  model_name: "Admin QA CedarLM",
  parameter_count: 600000000,
  dataset_size_gb: 2,
  sequence_length: 2048,
  batch_size: 1,
  training_method: "LoRA",
  precision: "BF16",
  number_of_layers: 12,
  hidden_size: 1024,
  epochs: 0.5,
  workload_type: "training",
  lora_rank: 16,
});
const result = {
  status: "ready",
  message:
    "QA explanation: this configuration fits the recorded training workload.",
  state: {
    values: Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== null),
    ),
    pending_fields: [],
    unresolved_fields: [],
  },
  fields,
  field_sources: Object.fromEntries(
    Object.keys(fields).map((k) => [
      k,
      k === "number_of_layers" ? "estimated" : "user",
    ]),
  ),
  missing_fields: [],
  estimated_fields: ["number_of_layers"],
  assumptions: [
    "QA heuristic: architecture is estimated.",
    "QA prices are illustrative.",
  ],
  gpu_configuration: {
    instance: "qa.instance",
    gpu: "QA-GPU",
    gpu_count: 1,
    required_memory_gb_per_gpu: 10,
    usable_memory_gb_per_gpu: 24,
  },
  estimated_time_hours: 1.25,
};
assert.ok(
  parseAgentResult(result),
  "The saved-agent fixture must match the Flask response contract.",
);
async function seed(owner, state = 2, updated = "2026-10-01T00:00:00.000Z") {
  const id = randomUUID();
  ids.push(id);
  return checked(
    await db
      .from("requests")
      .insert({
        request_id: id,
        user_id: owner.user.id,
        request_state: state,
        updated_at: updated,
        agent_result: result,
        chat_history: [
          {
            id: randomUUID(),
            role: "user",
            content: "QA researcher: fine-tune this model.",
            createdAt: new Date().toISOString(),
          },
          {
            id: randomUUID(),
            role: "assistant",
            content: result.message,
            createdAt: new Date().toISOString(),
          },
        ],
      })
      .select()
      .single(),
  );
}
async function row(id) {
  return checked(
    await db.from("requests").select("*").eq("request_id", id).single(),
  );
}
try {
  const statuses = checked(
    await db.from("request_statuses").select("id,name").in("id", [5, 6]),
  );
  assert.equal(statuses.find((s) => s.id === 5)?.name, "approved");
  assert.equal(statuses.find((s) => s.id === 6)?.name, "rejected");
  pass("Configured approved/rejected status mapping");
  const researcher = await account("researcher"),
    admin = await account("admin"),
    other = await account("other");
  checked(
    await db.from("users").insert({
      user_id: admin.user.id,
      email: admin.user.email,
      is_admin: true,
    }),
  );
  assert.equal(
    checked(
      await db
        .from("users")
        .select("user_id")
        .eq("user_id", researcher.user.id),
    ).length,
    0,
  );
  pass("Researcher requires no public.users row");
  const selfPromotion = await researcher.client
    .from("users")
    .insert({ user_id: researcher.user.id, is_admin: true });
  if (!selfPromotion.error)
    checked(await db.from("users").delete().eq("user_id", researcher.user.id));
  assert.ok(
    selfPromotion.error,
    "Database policies must block browser-created admin rows.",
  );
  pass("Existing database policies reject self-created admin profiles");
  const submitted = await seed(researcher),
    draft = await seed(researcher, 1),
    reviewed = await seed(researcher, 3),
    provisioning = await seed(researcher, 4),
    stale = await seed(researcher),
    race = await seed(researcher),
    nullVersion = await seed(researcher, 2, null),
    privateRow = await seed(other);
  const anonymous = await page("/admin");
  assert.equal(anonymous.response.status, 307);
  const denied = await page("/admin", researcher);
  unavailable(denied);
  assert.ok(!denied.text.includes(submitted.request_id));
  const deniedDetails = await page(
    `/admin/requests/${submitted.request_id}`,
    researcher,
  );
  unavailable(deniedDetails);
  assert.ok(!deniedDetails.text.includes("QA researcher:"));
  pass("Anonymous and profile-less researcher cannot read admin data");
  const home = await page("/", researcher);
  assert.equal(home.response.status, 200);
  assert.ok(home.text.includes("Good ideas need"));
  const editor = await page("/requests/new", researcher);
  assert.equal(editor.response.status, 200);
  assert.ok(editor.text.includes("What are you working on?"));
  pass("Profile-less researcher retains workspace and chat editor access");
  const landing = await page("/auth/continue", admin);
  assert.equal(landing.response.headers.get("location"), "/admin");
  const researcherLanding = await page("/auth/continue", researcher);
  assert.equal(researcherLanding.response.headers.get("location"), "/");
  pass("Server login landing resolves current role");
  const adminHome = await page("/admin", admin);
  assert.equal(adminHome.response.status, 200);
  assert.ok(adminHome.text.includes(submitted.request_id));
  assert.ok(adminHome.text.includes(reviewed.request_id));
  assert.ok(!adminHome.text.includes(draft.request_id));
  assert.ok(!adminHome.text.includes(provisioning.request_id));
  assert.ok(adminHome.text.includes(researcher.user.id));
  const all = await page("/admin?status=all", admin);
  assert.ok(all.text.includes(provisioning.request_id));
  assert.ok(!all.text.includes(draft.request_id));
  const draftDetail = await page(`/admin/requests/${draft.request_id}`, admin);
  unavailable(draftDetail);
  pass("Pending and all filters include submitted requests and exclude drafts");
  const detail = await page(`/admin/requests/${submitted.request_id}`, admin);
  assert.equal(detail.response.status, 200);
  for (const text of [
    "QA researcher: fine-tune this model.",
    result.message,
    "QA-GPU",
    "qa.instance",
    "QA heuristic: architecture is estimated.",
    "Researcher provided",
    "0.5",
    researcher.user.id,
    "Approve request",
    "Reject request",
  ])
    assert.ok(detail.text.includes(text), `Missing detail: ${text}`);
  const adminOwn = await page("/", admin);
  assert.ok(adminOwn.text.includes("Admin review"));
  assert.ok(!adminOwn.text.includes(submitted.request_id));
  pass(
    "Admin sees full saved details and can access an isolated researcher workspace",
  );
  const unauthorized = await action(
    "decideRequest",
    [submitted.request_id, submitted.updated_at, "approve"],
    researcher,
  );
  assert.equal(unauthorized.ok, false);
  assert.equal((await row(submitted.request_id)).request_state, 2);
  const anonymousAction = await action("decideRequest", [
    submitted.request_id,
    submitted.updated_at,
    "approve",
  ]);
  assert.equal(anonymousAction.ok, false);
  pass("Direct decision actions reject non-admin and anonymous users");
  checked(
    await db.from("users").insert({ user_id: other.user.id, is_admin: false }),
  );
  assert.equal(
    (
      await action(
        "decideRequest",
        [submitted.request_id, submitted.updated_at, "approve"],
        other,
      )
    ).ok,
    false,
  );
  unavailable(await page("/admin", other));
  pass("Explicit false admin flag grants no access");
  await other.client
    .from("users")
    .update({ is_admin: true })
    .eq("user_id", other.user.id);
  const changedRole = checked(
    await db
      .from("users")
      .select("is_admin")
      .eq("user_id", other.user.id)
      .single(),
  ).is_admin;
  if (changedRole)
    checked(
      await db
        .from("users")
        .update({ is_admin: false })
        .eq("user_id", other.user.id),
    );
  assert.equal(
    changedRole,
    false,
    "Database policies must block browser promotion of existing profiles.",
  );
  pass(
    "Existing database policies reject self-promotion of a non-admin profile",
  );
  for (const args of [
    ["bad-id", null, "approve"],
    [submitted.request_id, undefined, "approve"],
    [submitted.request_id, submitted.updated_at, "provision"],
    [submitted.request_id, {}, "approve"],
  ])
    assert.equal((await action("decideRequest", args, admin)).ok, false);
  assert.equal(
    (
      await action(
        "decideRequest",
        [draft.request_id, draft.updated_at, "approve"],
        admin,
      )
    ).ok,
    false,
  );
  assert.equal(
    (await action("decideRequest", [randomUUID(), null, "reject"], admin)).ok,
    false,
  );
  assert.equal(
    (
      await action(
        "decideRequest",
        [provisioning.request_id, provisioning.updated_at, "reject"],
        admin,
      )
    ).ok,
    false,
  );
  pass(
    "Invalid inputs, missing requests, drafts, and provisioning cannot be decided",
  );
  checked(
    await db
      .from("requests")
      .update({ updated_at: new Date().toISOString() })
      .eq("request_id", stale.request_id),
  );
  assert.equal(
    (
      await action(
        "decideRequest",
        [stale.request_id, stale.updated_at, "approve"],
        admin,
      )
    ).conflict,
    true,
  );
  assert.equal((await row(stale.request_id)).request_state, 2);
  pass("Stale timestamps cannot overwrite a changed review");
  const approved = await action(
    "decideRequest",
    [submitted.request_id, submitted.updated_at, "approve"],
    admin,
  );
  assert.deepEqual(approved, { ok: true, status: 5 });
  const afterApproved = await row(submitted.request_id);
  assert.deepEqual(afterApproved.chat_history, submitted.chat_history);
  assert.deepEqual(afterApproved.agent_result, submitted.agent_result);
  assert.equal(afterApproved.user_id, researcher.user.id);
  assert.equal(
    (
      await action(
        "decideRequest",
        [submitted.request_id, submitted.updated_at, "approve"],
        admin,
      )
    ).ok,
    true,
  );
  assert.equal(
    (await row(submitted.request_id)).updated_at,
    afterApproved.updated_at,
  );
  assert.equal(
    (
      await action(
        "decideRequest",
        [submitted.request_id, afterApproved.updated_at, "reject"],
        admin,
      )
    ).conflict,
    true,
  );
  pass(
    "Approval preserves workload/history, retries idempotently, and cannot be reversed",
  );
  const rejected = await action(
    "decideRequest",
    [reviewed.request_id, reviewed.updated_at, "reject"],
    admin,
  );
  assert.deepEqual(rejected, { ok: true, status: 6 });
  assert.equal(
    (
      await action(
        "decideRequest",
        [reviewed.request_id, reviewed.updated_at, "reject"],
        admin,
      )
    ).ok,
    true,
  );
  assert.equal(
    (
      await action(
        "decideRequest",
        [
          reviewed.request_id,
          (await row(reviewed.request_id)).updated_at,
          "approve",
        ],
        admin,
      )
    ).conflict,
    true,
  );
  pass("Reviewed state can be rejected, with identical retry and no reversal");
  assert.equal(
    (
      await action(
        "decideRequest",
        [nullVersion.request_id, null, "approve"],
        admin,
      )
    ).ok,
    true,
  );
  pass("Legacy null timestamps support conditional decisions");
  const racing = await Promise.all([
    action(
      "decideRequest",
      [race.request_id, race.updated_at, "approve"],
      admin,
    ),
    action(
      "decideRequest",
      [race.request_id, race.updated_at, "reject"],
      admin,
    ),
  ]);
  assert.equal(racing.filter((x) => x.ok).length, 1);
  assert.equal(racing.filter((x) => x.conflict).length, 1);
  pass("Concurrent opposite decisions produce exactly one winner");
  const approvedPage = await page(
    `/requests/${submitted.request_id}`,
    researcher,
  );
  assert.ok(approvedPage.text.includes("Request approved."));
  assert.ok(approvedPage.text.includes("Not started"));
  const rejectedPage = await page(
    `/requests/${reviewed.request_id}`,
    researcher,
  );
  assert.ok(rejectedPage.text.includes("Request rejected."));
  assert.ok(rejectedPage.text.includes("Not applicable"));
  const filtered = await page("/?status=submitted", researcher);
  assert.ok(filtered.text.includes(submitted.request_id));
  assert.ok(filtered.text.includes(reviewed.request_id));
  const approvedFilter = await page(
    `/admin?status=approved&q=${submitted.request_id}`,
    admin,
  );
  assert.ok(approvedFilter.text.includes(submitted.request_id));
  const rejectedFilter = await page(
    `/admin?status=rejected&q=${reviewed.request_id}`,
    admin,
  );
  assert.ok(rejectedFilter.text.includes(reviewed.request_id));
  const locked = await page(`/admin/requests/${submitted.request_id}`, admin);
  assert.ok(locked.text.includes("Approved. This decision is read-only."));
  assert.ok(!locked.text.includes("Approve request"));
  pass(
    "Researcher and admin views reflect final decisions without starting provisioning",
  );
  unavailable(await page(`/requests/${privateRow.request_id}`, researcher));
  assert.equal(
    (
      await action(
        "confirmRequest",
        [privateRow.request_id, privateRow.updated_at],
        researcher,
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await action(
        "confirmRequest",
        [reviewed.request_id, reviewed.updated_at],
        researcher,
      )
    ).ok,
    true,
  );
  assert.equal((await row(reviewed.request_id)).request_state, 6);
  pass("Researcher ownership and submitted locking remain enforced");
  // Keep fixture dates ahead of real records so pagination assertions do not depend on other users' requests.
  const paginated = Array.from({ length: 21 }, () => ({
    request_id: randomUUID(),
    user_id: researcher.user.id,
    request_state: 5,
    updated_at: "2099-01-01T00:00:00.000Z",
  })).sort((a, b) => a.request_id.localeCompare(b.request_id));
  ids.push(...paginated.map((row) => row.request_id));
  checked(await db.from("requests").insert(paginated));
  const firstPage = await page("/admin?status=approved&page=1", admin);
  const secondPage = await page("/admin?status=approved&page=2", admin);
  assert.ok(firstPage.text.includes(paginated[0].request_id));
  assert.ok(!firstPage.text.includes(paginated[20].request_id));
  assert.ok(secondPage.text.includes(paginated[20].request_id));
  pass(
    "Admin pagination separates 20-row pages without losing submitted requests",
  );
  checked(
    await db
      .from("users")
      .update({ is_admin: false })
      .eq("user_id", admin.user.id),
  );
  assert.equal(
    (
      await action(
        "decideRequest",
        [stale.request_id, (await row(stale.request_id)).updated_at, "approve"],
        admin,
      )
    ).ok,
    false,
  );
  unavailable(await page("/admin", admin));
  assert.equal(
    (await page("/auth/continue", admin)).response.headers.get("location"),
    "/",
  );
  pass("Revoked admin rights take effect without signing out");
  console.log(`PASS: ${checks} authenticated admin HTTP checks.`);
} finally {
  const errors = [];
  if (ids.length) {
    const deleted = await db.from("requests").delete().in("request_id", ids);
    if (deleted.error) errors.push(deleted.error.message);
  }
  for (const id of accounts) {
    const profile = await db.from("users").delete().eq("user_id", id);
    if (profile.error) errors.push(profile.error.message);
    const auth = await db.auth.admin.deleteUser(id);
    if (auth.error) errors.push(auth.error.message);
  }
  if (errors.length)
    throw new Error(`Disposable fixture cleanup failed: ${errors.join("; ")}`);
  console.log("Disposable test accounts and requests removed.");
}
