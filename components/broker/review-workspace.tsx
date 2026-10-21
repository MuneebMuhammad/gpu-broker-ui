"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";
import { confirmRequest } from "@/app/actions";
import {
  SUBMITTED_STATES,
  formatDate,
  parseAgentResult,
  parseHistory,
  shortId,
  type RequestRow,
} from "@/lib/broker";
import { Recommendation, Stepper, WorkloadSummary } from "./summary";

export function ReviewWorkspace({ row }: { row: RequestRow }) {
  const result = parseAgentResult(row.agent_result);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await confirmRequest(row.request_id, row.updated_at);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      router.replace(`/requests/${row.request_id}`);
      router.refresh();
    } catch {
      setError(
        "Your submission could not be confirmed. Refresh to check its status before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!result) return null;
  return (
    <>
      <Link href={`/requests/${row.request_id}`} className="back-link">
        <ArrowLeft size={14} /> Back to conversation
      </Link>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">A GOOD FIT FOR YOUR WORKLOAD</span>
          <h1>Ready for a closer look?</h1>
          <p>
            Review your recommendation before sending it to the platform team.
          </p>
        </div>
        <span className="draft-indicator">
          <FileCheck2 size={14} /> {shortId(row.request_id)}
        </span>
      </div>
      <Stepper current={2} />
      <div className="review-grid">
        <WorkloadSummary result={result} />
        <div className="review-main">
          <Recommendation result={result} />
          <div className="review-notice">
            <ShieldCheck size={20} />
            <div>
              <strong>
                You’re requesting a review, not starting resources.
              </strong>
              <p>
                Your platform team will review the request before any
                provisioning begins.
              </p>
            </div>
          </div>
          {error && (
            <div role="alert" className="chat-error">
              <CircleAlert size={16} />
              <span>{error}</span>
              <button onClick={() => window.location.reload()}>Refresh</button>
            </div>
          )}
          <div className="review-actions">
            <Link
              className={`secondary-button ${busy ? "disabled-link" : ""}`}
              href={`/requests/${row.request_id}`}
            >
              <Pencil size={15} /> Edit answers
            </Link>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Check size={16} />
              )}
              {busy ? "Submitting…" : "Confirm & submit"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </div>
          <p className="review-lock">
            <LockKeyhole size={12} /> Submitted requests are read-only. You can
            always create a new request.
          </p>
        </div>
      </div>
    </>
  );
}

export function SubmittedRequest({ row }: { row: RequestRow }) {
  const result = parseAgentResult(row.agent_result);
  const history = parseHistory(row.chat_history);
  const state = row.request_state;
  const confirmed = SUBMITTED_STATES.some((s) => s === state);
  const rejected = state === 6;
  const approved = state === 5;
  const decided = approved || rejected;
  return (
    <>
      <Link href="/" className="back-link">
        <ArrowLeft size={14} /> All requests
      </Link>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">
            {decided
              ? "PLATFORM REVIEW COMPLETE"
              : "YOUR NEXT STEP IS IN MOTION"}
          </span>
          <h1>
            {approved
              ? "Request approved."
              : rejected
                ? "Request rejected."
                : confirmed
                  ? "Request submitted."
                  : "Request details"}
          </h1>
          <p>
            {rejected
              ? "The platform team rejected this request. You can create a new request with revised requirements."
              : approved
                ? "The platform team approved your request. Provisioning has not started."
                : confirmed
                  ? "Your workload is with the platform team. Follow its progress here."
                  : "This request is available in read-only mode."}
          </p>
        </div>
        <Link className="secondary-button" href="/requests/new">
          New request <ArrowRight size={15} />
        </Link>
      </div>
      <Stepper current={3} />
      <div className="submitted-grid">
        <section className="submission-card">
          <span className={`success-emblem ${rejected ? "rejected" : ""}`}>
            {rejected ? (
              <X size={28} strokeWidth={1.8} />
            ) : (
              <Check size={28} strokeWidth={1.8} />
            )}
          </span>
          <span className="eyebrow">
            {approved
              ? "APPROVED BY PLATFORM TEAM"
              : rejected
                ? "REJECTED BY PLATFORM TEAM"
                : confirmed
                  ? "CONFIRMED BY YOU"
                  : "REQUEST RECORD"}
          </span>
          <h2>
            {approved
              ? "Your request is approved."
              : rejected
                ? "This request was rejected."
                : confirmed
                  ? "One step closer to your next breakthrough."
                  : "Your request"}
          </h2>
          <p className="submission-id">{shortId(row.request_id)}</p>
          <span className="full-id" title={row.request_id}>
            {row.request_id}
          </span>
          <div className="submission-date">
            Created {formatDate(row.created_at)}
          </div>
          <ol className="status-timeline">
            {[
              {
                title: "Researcher confirmed",
                description: confirmed
                  ? "Your configuration has been submitted"
                  : "Not confirmed",
                complete: confirmed,
              },
              {
                title: "Platform team review",
                description: approved
                  ? "Approved"
                  : rejected
                    ? "Rejected"
                    : state === 3 || state === 4
                      ? "Reviewed"
                      : "Pending",
                complete: decided || state === 3 || state === 4,
                rejected,
              },
              {
                title: "Resource provisioning",
                description:
                  state === 4
                    ? "Started"
                    : rejected
                      ? "Not applicable — request rejected"
                      : "Not started",
                complete: state === 4,
              },
            ].map((step, i) => (
              <li
                key={step.title}
                className={
                  step.rejected ? "rejected" : step.complete ? "complete" : ""
                }
              >
                <span className="timeline-dot">
                  {step.rejected ? (
                    <X size={13} />
                  ) : step.complete ? (
                    <Check size={13} />
                  ) : (
                    i + 1
                  )}
                </span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="submission-note">
            <ShieldCheck size={17} />
            <p>
              Resources are created only after platform approval. This workspace
              does not provision GPUs.
            </p>
          </div>
          <Link href="/" className="primary-button">
            Back to your requests <ArrowRight size={16} />
          </Link>
        </section>
        <div className="submitted-details">
          {result && (
            <>
              <Recommendation result={result} compact />
              <WorkloadSummary result={result} />
            </>
          )}
        </div>
      </div>
      {history.length > 0 && (
        <details className="saved-conversation">
          <summary>
            View saved conversation <span>{history.length} messages</span>
          </summary>
          <div>
            {history.map((m) => (
              <article key={m.id}>
                <strong>{m.role === "user" ? "You" : "GPU Broker"}</strong>
                <p>{m.content}</p>
              </article>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
