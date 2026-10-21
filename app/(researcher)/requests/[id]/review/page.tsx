import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ownedRequest } from "@/lib/requests";
import { parseAgentResult } from "@/lib/broker";
import { ReviewWorkspace } from "@/components/broker/review-workspace";
async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await ownedRequest(id);
  const result = parseAgentResult(row.agent_result);
  if (
    row.request_state !== 1 ||
    result?.status !== "ready" ||
    !result.gpu_configuration
  )
    redirect(`/requests/${id}`);
  return <ReviewWorkspace row={row} />;
}
export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="page-loading">
          <span className="loading-mark" />
          Preparing your recommendation…
        </div>
      }
    >
      <Review params={params} />
    </Suspense>
  );
}
