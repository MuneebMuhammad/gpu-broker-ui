import Link from "next/link";
import { ArrowLeft, MessageSquare, ShieldCheck } from "lucide-react";
import {
  STATUS,
  formatDate,
  parseAgentResult,
  parseHistory,
  requestName,
  type RequestRow,
} from "@/lib/broker";
import { WorkloadSummary, Recommendation } from "./summary";
import { AdminDecision } from "./admin-decision";

export function AdminRequest({
  row,
  email,
}: {
  row: RequestRow;
  email: string | null;
}) {
  const result = parseAgentResult(row.agent_result);
  const history = parseHistory(row.chat_history);
  const status = STATUS[row.request_state as keyof typeof STATUS];
  return (
    <>
      <Link className="back-link" href="/admin">
        <ArrowLeft size={14} /> Submitted requests
      </Link>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">REQUEST REVIEW</span>
          <h1>{requestName(row)}</h1>
          <p className="admin-request-id">{row.request_id}</p>
        </div>
        <span className={`status-badge ${status?.className || "unknown"}`}>
          <span />
          {status?.label || "Unknown"}
        </span>
      </div>
      <dl className="admin-request-meta">
        <div>
          <dt>Researcher</dt>
          <dd>{email || row.user_id || "Unknown researcher"}</dd>
          {email && <dd className="table-subtext">{row.user_id}</dd>}
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDate(row.created_at)}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{formatDate(row.updated_at || row.created_at)}</dd>
        </div>
      </dl>
      <div className="admin-review-grid">
        <section className="admin-conversation">
          <div className="panel-heading">
            <span className="icon-tile">
              <MessageSquare size={18} />
            </span>
            <div>
              <h2>Researcher conversation</h2>
              <p>{history.length} saved messages · Read-only</p>
            </div>
          </div>
          <div className="admin-chat-log">
            {history.length ? (
              history.map((m, i) => (
                <article
                  className={`admin-chat-message ${m.role}`}
                  key={`${m.id}-${i}`}
                >
                  <strong>
                    {m.role === "user" ? "Researcher" : "GPU Broker"}
                  </strong>
                  <p>{m.content}</p>
                  <time dateTime={m.createdAt}>{formatDate(m.createdAt)}</time>
                </article>
              ))
            ) : (
              <p className="admin-footnote">
                No saved conversation is available.
              </p>
            )}
          </div>
        </section>
        <div className="admin-request-details">
          {result ? (
            <>
              <Recommendation result={result} neutral />
              <section className="admin-agent-explanation">
                <h2>Agent explanation</h2>
                <p>{result.message}</p>
              </section>
              <WorkloadSummary result={result} neutral />
            </>
          ) : (
            <div className="chat-error" role="alert">
              The saved recommendation could not be read. The conversation is
              shown as recorded.
            </div>
          )}
        </div>
      </div>
      <div className="review-notice">
        <ShieldCheck size={20} />
        <p>
          Approval records this review decision. It does not start provisioning
          or change the researcher’s workload.
        </p>
      </div>
      <AdminDecision
        key={`${row.request_id}-${row.updated_at}`}
        id={row.request_id}
        status={row.request_state}
        updatedAt={row.updated_at}
      />
    </>
  );
}
