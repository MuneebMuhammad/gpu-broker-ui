import { Suspense } from "react";
import { pageContext } from "@/lib/requests";
import { SUBMITTED_STATES } from "@/lib/broker";
import { RequestHome } from "@/components/broker/home";
type SearchParams = Promise<{ page?: string; status?: string; q?: string }>;
async function Requests({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(params.page) || 1)),
  );
  const filter = ["draft", "submitted"].includes(params.status || "")
    ? params.status!
    : "all";
  const search = (params.q || "").slice(0, 36);
  const { supabase, user } = await pageContext();
  let query = supabase
    .from("requests")
    .select("*", { count: "exact" })
    .eq("user_id", user.id);
  if (filter === "draft") query = query.eq("request_state", 1);
  if (filter === "submitted")
    query = query.in("request_state", [...SUBMITTED_STATES]);
  // UUID columns cannot be searched with ILIKE. Exact IDs keep this query typed.
  if (search)
    query = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      search,
    )
      ? query.eq("request_id", search)
      : query.eq("request_id", "00000000-0000-0000-0000-000000000000");
  const { data, count, error } = await query
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  return (
    <RequestHome
      rows={data || []}
      count={count || 0}
      page={page}
      filter={filter}
      search={params.q || ""}
      error={
        error
          ? "Please check your connection and request access, then retry."
          : undefined
      }
    />
  );
}
export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <div className="page-loading">
          <span className="loading-mark" />
          Loading your requests…
        </div>
      }
    >
      <Requests searchParams={searchParams} />
    </Suspense>
  );
}
