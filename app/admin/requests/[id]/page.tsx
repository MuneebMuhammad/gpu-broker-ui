import { Suspense } from "react";
import { adminPageContext, submittedRequest } from "@/lib/admin";
import { AdminRequest } from "@/components/broker/admin-request";
async function Request({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await submittedRequest(id);
  const { supabase } = await adminPageContext();
  const { data: profile } = row.user_id
    ? await supabase
        .from("users")
        .select("email")
        .eq("user_id", row.user_id)
        .maybeSingle()
    : { data: null };
  return <AdminRequest row={row} email={profile?.email || null} />;
}
export default function AdminRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={<div className="page-loading">Loading request details…</div>}
    >
      <Request params={params} />
    </Suspense>
  );
}
