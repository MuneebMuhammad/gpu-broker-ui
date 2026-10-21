"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/lib/admin";
import { REVIEWABLE_STATES } from "@/lib/broker";

type DecisionResult =
  | { ok: true; status: 5 | 6 }
  | { ok: false; error: string; conflict?: boolean };

export async function decideRequest(
  id: string,
  expectedUpdatedAt: string | null,
  decision: "approve" | "reject",
): Promise<DecisionResult> {
  const context = await adminContext();
  if (!context)
    return {
      ok: false,
      error: "Admin access is required. Sign in with an authorized account.",
    };
  if (
    typeof id !== "string" ||
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id) ||
    (expectedUpdatedAt !== null &&
      (typeof expectedUpdatedAt !== "string" ||
        !Number.isFinite(Date.parse(expectedUpdatedAt)))) ||
    (decision !== "approve" && decision !== "reject")
  )
    return { ok: false, error: "Invalid review decision." };
  const { supabase } = context;
  const target = decision === "approve" ? 5 : 6;
  const { data: row, error } = await supabase
    .from("requests")
    .select("request_state, updated_at")
    .eq("request_id", id)
    .maybeSingle();
  if (error)
    return {
      ok: false,
      error: "The request could not be loaded. Please try again.",
    };
  if (!row || row.request_state === 1 || row.request_state === null)
    return { ok: false, error: "Submitted request not found." };
  const refreshViews = () => {
    revalidatePath("/admin");
    revalidatePath(`/admin/requests/${id}`);
    revalidatePath("/");
    revalidatePath(`/requests/${id}`);
    revalidatePath(`/requests/${id}/review`);
  };
  // A retry after a lost response must acknowledge the decision without changing its timestamp.
  if (row.request_state === target) {
    refreshViews();
    return { ok: true, status: target };
  }
  if (
    !REVIEWABLE_STATES.some((state) => state === row.request_state) ||
    row.updated_at !== expectedUpdatedAt
  )
    return {
      ok: false,
      conflict: true,
      error:
        "This request changed or already has a decision. Refresh before continuing.",
    };
  let query = supabase
    .from("requests")
    .update({ request_state: target, updated_at: new Date().toISOString() })
    .eq("request_id", id)
    .eq("request_state", row.request_state!);
  query =
    expectedUpdatedAt === null
      ? query.is("updated_at", null)
      : query.eq("updated_at", expectedUpdatedAt);
  const { data: changed, error: updateError } = await query
    .select("request_state")
    .maybeSingle();
  if (updateError)
    return {
      ok: false,
      error:
        "The decision could not be saved. Refresh to check its status before retrying.",
    };
  if (!changed) {
    // Another admin may have submitted the identical decision while this request was in flight.
    const { data: latest, error: latestError } = await supabase
      .from("requests")
      .select("request_state")
      .eq("request_id", id)
      .maybeSingle();
    if (latestError || latest?.request_state !== target)
      return {
        ok: false,
        conflict: true,
        error:
          "Another review changed this request. Refresh to see the latest decision.",
      };
  }
  refreshViews();
  return { ok: true, status: target };
}
