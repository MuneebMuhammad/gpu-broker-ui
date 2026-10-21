import { Suspense } from "react";
import { adminPageContext } from "@/lib/admin";
import { SUBMITTED_STATES, REVIEWABLE_STATES } from "@/lib/broker";
import { AdminHome } from "@/components/broker/admin-home";

type SearchParams = Promise<{ page?: string; status?: string; q?: string }>;
async function Requests({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(params.page) || 1)),
  );
  const filter = ["all", "approved", "rejected"].includes(params.status || "")
    ? params.status!
    : "pending";
  const search = (params.q || "").slice(0, 36);
  const { supabase } = await adminPageContext();
  const states =
    filter === "pending"
      ? [...REVIEWABLE_STATES]
      : filter === "approved"
        ? [5]
        : filter === "rejected"
          ? [6]
          : [...SUBMITTED_STATES];
  let query = supabase
    .from("requests")
    .select("*", { count: "exact" })
    .in("request_state", states);
  if (search)
    query = query.eq(
      "request_id",
      /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(search)
        ? search
        : "00000000-0000-0000-0000-000000000000",
    );
  const { data, count, error } = await query
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("request_id")
    .range((page - 1) * 20, page * 20 - 1);
  const rows = data || [];
  const ids = [
    ...new Set(rows.flatMap((row) => (row.user_id ? [row.user_id] : []))),
  ];
  const { data: profiles } = ids.length
    ? await supabase.from("users").select("user_id, email").in("user_id", ids)
    : { data: [] };
  const emails = Object.fromEntries(
    (profiles || []).map((p) => [p.user_id, p.email]),
  );
  return (
    <AdminHome
      rows={rows}
      emails={emails}
      count={count || 0}
      page={page}
      filter={filter}
      search={search}
      error={
        error ? "Requests could not be loaded. Please try again." : undefined
      }
    />
  );
}
export default function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading submitted requests…</div>}
    >
      <Requests searchParams={searchParams} />
    </Suspense>
  );
}
