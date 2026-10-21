"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, LoaderCircle, RefreshCw, X } from "lucide-react";
import { decideRequest } from "@/app/admin/actions";
import { REVIEWABLE_STATES } from "@/lib/broker";

export function AdminDecision({
  id,
  status,
  updatedAt,
}: {
  id: string;
  status: number | null;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const locked = useRef(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<5 | 6 | null>(null);
  if (saved || !REVIEWABLE_STATES.some((s) => s === status))
    return (
      <div className="admin-decision-locked" role="status">
        {saved === 5 || status === 5
          ? "Approved. This decision is read-only."
          : saved === 6 || status === 6
            ? "Rejected. This decision is read-only."
            : "This request is read-only; provisioning has already started."}
      </div>
    );
  function decide(decision: "approve" | "reject") {
    if (locked.current) return;
    locked.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const response = await decideRequest(id, updatedAt, decision);
        if (!response.ok) {
          setError(response.error);
          return;
        }
        setSaved(response.status);
        router.refresh();
      } catch {
        setError(
          "The decision could not be confirmed. Refresh to check its status before retrying.",
        );
      } finally {
        locked.current = false;
      }
    });
  }
  return (
    <section className="admin-decision">
      <div>
        <h2>Review decision</h2>
        <p>
          Record your decision for this submitted configuration. Decisions are
          final.
        </p>
      </div>
      {error && (
        <div className="chat-error" role="alert">
          <CircleAlert size={16} />
          <span>{error}</span>
          <button
            disabled={busy}
            onClick={() => {
              setError(null);
              router.refresh();
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      )}
      <div className="review-actions">
        <button
          className="reject-button"
          disabled={busy || !!error}
          onClick={() => decide("reject")}
        >
          <X size={16} /> Reject request
        </button>
        <button
          className="primary-button"
          disabled={busy || !!error}
          onClick={() => decide("approve")}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}{" "}
          {busy ? "Saving decision…" : "Approve request"}
        </button>
      </div>
    </section>
  );
}
