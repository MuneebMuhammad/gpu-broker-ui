import { Suspense } from "react";
import { ownedRequest } from "@/lib/requests";
import { ChatWorkspace } from "@/components/broker/chat-workspace";
import { SubmittedRequest } from "@/components/broker/review-workspace";
async function Request({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await ownedRequest(id);
  return row.request_state === 1 ? (
    <ChatWorkspace initial={row} />
  ) : (
    <SubmittedRequest row={row} />
  );
}
export default function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="page-loading">
          <span className="loading-mark" />
          Loading request…
        </div>
      }
    >
      <Request params={params} />
    </Suspense>
  );
}
