import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { AgentResult } from "@/lib/broker";
import { createClient } from "@/lib/supabase/server";
import { createClient as createDataClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/generatedTypes";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

export async function researcherContext() {
  // Supabase checks token expiry with Date.now() during client initialization.
  // Keep that work request-bound instead of letting Cache Components prerender it.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  // Existing project RLS blocks researcher writes. Elevate only database access,
  // after validating identity; every caller must still filter by this user ID.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const database = key
    ? createDataClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : supabase;
  return { supabase: database, user: data.user };
}
export async function pageContext() {
  const context = await researcherContext();
  if (!context) redirect("/auth/login");
  return context;
}
export async function ownedRequest(id: string) {
  const { supabase, user } = await pageContext();
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))
    notFound();
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("request_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error)
    throw new Error(
      "Your request could not be loaded. Check your connection and try again.",
    );
  if (!data) notFound();
  return data;
}

export function resultReceipt(userId: string, result: AgentResult) {
  const key =
    process.env.GPU_BROKER_SIGNING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error(
      "A server signing key is required to save verified recommendations.",
    );
  return createHmac("sha256", key)
    .update(JSON.stringify({ scope: "gpu-researcher-result", userId, result }))
    .digest("base64url");
}
export function verifyReceipt(
  userId: string,
  result: AgentResult,
  receipt: unknown,
) {
  if (typeof receipt !== "string") return false;
  const expected = Buffer.from(resultReceipt(userId, result));
  const actual = Buffer.from(receipt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
