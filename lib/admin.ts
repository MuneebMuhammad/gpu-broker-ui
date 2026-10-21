import "server-only";
import { notFound } from "next/navigation";
import { pageContext, researcherContext } from "@/lib/requests";
import { SUBMITTED_STATES } from "@/lib/broker";

type Context = NonNullable<Awaited<ReturnType<typeof researcherContext>>>;

export async function hasAdminAccess({ supabase, user }: Context) {
  // A missing profile is normal for researchers. Never trust auth metadata or a browser flag.
  const { data, error } = await supabase
    .from("users")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  return !error && data?.is_admin === true;
}

export async function adminContext() {
  const context = await researcherContext();
  return context && (await hasAdminAccess(context)) ? context : null;
}

export async function adminPageContext() {
  const context = await pageContext();
  if (!(await hasAdminAccess(context))) notFound();
  return context;
}

export async function submittedRequest(id: string) {
  // Authorize here too: layouts alone do not protect independently executed page reads.
  const { supabase } = await adminPageContext();
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))
    notFound();
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("request_id", id)
    .in("request_state", [...SUBMITTED_STATES])
    .maybeSingle();
  if (error)
    throw new Error("The request could not be loaded. Please try again.");
  if (!data) notFound();
  return data;
}
