"use server";

import { revalidatePath } from "next/cache";
import { researcherContext, verifyReceipt } from "@/lib/requests";
import {
  SUBMITTED_STATES,
  parseAgentResult,
  parseHistory,
  sameSnapshot,
  type ChatMessage,
  type AgentResult,
  type RequestRow,
} from "@/lib/broker";
import type { Json } from "@/lib/supabase/generatedTypes";

type SaveInput = {
  id: string;
  expectedUpdatedAt: string | null;
  history: ChatMessage[];
  result: AgentResult;
  receipt: string;
};
type ActionResult =
  | { ok: true; row: RequestRow }
  | { ok: false; error: string; conflict?: boolean };
export async function saveDraft(input: SaveInput): Promise<ActionResult> {
  const context = await researcherContext();
  if (!context)
    return {
      ok: false,
      error: "Your session expired. Sign in again to save this draft.",
    };
  const { supabase, user } = context;
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray(input.history) ||
    typeof input.id !== "string"
  )
    return { ok: false, error: "Invalid draft." };
  const result = parseAgentResult(input.result);
  const history = parseHistory(input.history);
  if (
    !/^[\da-f-]{36}$/i.test(input.id) ||
    !result ||
    !history.length ||
    history.length !== input.history.length ||
    history.at(-1)?.role !== "assistant" ||
    history.at(-1)?.content !== result.message ||
    JSON.stringify(input).length > 2_000_000
  )
    return { ok: false, error: "The draft contains invalid data." };
  if (!verifyReceipt(user.id, result, input.receipt))
    return {
      ok: false,
      error:
        "The recommendation could not be verified. Please resend your message.",
    };
  const { data: current, error: loadError } = await supabase
    .from("requests")
    .select("*")
    .eq("request_id", input.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (loadError)
    return {
      ok: false,
      error:
        "Could not read your draft. Check your connection or request access.",
    };
  if (current && current.request_state !== 1)
    return {
      ok: false,
      conflict: true,
      error:
        "This request has already been submitted. Reload to see its status.",
    };
  // A retry after a lost network response must not create a duplicate or rerun the agent.
  if (
    current &&
    sameSnapshot(current.chat_history, history) &&
    sameSnapshot(current.agent_result, result)
  )
    return { ok: true, row: current };
  if (current && current.updated_at !== input.expectedUpdatedAt)
    return {
      ok: false,
      conflict: true,
      error:
        "This draft changed in another tab. Reload before editing it again.",
    };
  const payload = {
    chat_history: history as unknown as Json,
    agent_result: result as unknown as Json,
    updated_at: new Date().toISOString(),
  };
  if (!current) {
    const { data, error } = await supabase
      .from("requests")
      .insert({
        ...payload,
        request_id: input.id,
        user_id: user.id,
        request_state: 1,
      })
      .select()
      .single();
    if (!error) revalidatePath("/");
    return error
      ? {
          ok: false,
          error:
            "Your draft could not be saved. Check your connection or request access, then retry saving.",
        }
      : { ok: true, row: data };
  }
  let query = supabase
    .from("requests")
    .update(payload)
    .eq("request_id", input.id)
    .eq("user_id", user.id)
    .eq("request_state", 1);
  query =
    current.updated_at === null
      ? query.is("updated_at", null)
      : query.eq("updated_at", current.updated_at);
  const { data, error } = await query.select().maybeSingle();
  if (error)
    return {
      ok: false,
      error:
        "Your draft could not be saved. Retry saving without resending your message.",
    };
  if (data) revalidatePath("/");
  return data
    ? { ok: true, row: data }
    : {
        ok: false,
        conflict: true,
        error: "This draft changed. Reload to get the latest version.",
      };
}

export async function confirmRequest(
  id: string,
  expectedUpdatedAt: string | null,
): Promise<ActionResult> {
  const context = await researcherContext();
  if (!context)
    return { ok: false, error: "Your session expired. Sign in again." };
  const { supabase, user } = context;
  const { data: row, error } = await supabase
    .from("requests")
    .select("*")
    .eq("request_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !row)
    return { ok: false, error: "Request not found or inaccessible." };
  if (row.request_state !== 1)
    return row.request_state !== null &&
      SUBMITTED_STATES.some((state) => state === row.request_state)
      ? { ok: true, row }
      : { ok: false, error: "This request cannot be submitted." };
  const result = parseAgentResult(row.agent_result);
  if (
    result?.status !== "ready" ||
    !result.gpu_configuration ||
    result.missing_fields.length
  )
    return {
      ok: false,
      error:
        "Finish the conversation and get a recommendation before submitting.",
    };
  if (row.updated_at !== expectedUpdatedAt)
    return {
      ok: false,
      conflict: true,
      error:
        "Your recommendation changed. Reload and review the latest version.",
    };
  let query = supabase
    .from("requests")
    .update({ request_state: 2, updated_at: new Date().toISOString() })
    .eq("request_id", id)
    .eq("user_id", user.id)
    .eq("request_state", 1);
  query =
    row.updated_at === null
      ? query.is("updated_at", null)
      : query.eq("updated_at", row.updated_at);
  const { data, error: updateError } = await query.select().maybeSingle();
  if (updateError || !data)
    return {
      ok: false,
      conflict: true,
      error:
        "Submission could not be completed. Refresh to check its status before trying again.",
    };
  revalidatePath("/");
  revalidatePath(`/requests/${id}`);
  revalidatePath("/admin");
  return { ok: true, row: data };
}
