"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CircleAlert,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { saveDraft } from "@/app/actions";
import {
  parseAgentResult,
  parseHistory,
  shortId,
  type AgentResult,
  type ChatMessage,
  type RequestRow,
} from "@/lib/broker";
import { Stepper, WorkloadSummary } from "./summary";

const OPENING =
  "Tell me about the model and workload you have in mind. I’ll help you find a GPU configuration that fits.";

export function ChatWorkspace({
  initial = null,
}: {
  initial?: RequestRow | null;
}) {
  const [id] = useState(() => initial?.request_id ?? crypto.randomUUID());
  const [history, setHistory] = useState<ChatMessage[]>(() =>
    parseHistory(initial?.chat_history),
  );
  const [result, setResult] = useState<AgentResult | null>(() =>
    parseAgentResult(initial?.agent_result),
  );
  const [version, setVersion] = useState<string | null>(
    initial?.updated_at ?? null,
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeMessage, setActiveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(initial));
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const pendingSave = useRef<{
    history: ChatMessage[];
    result: AgentResult;
    receipt: string;
  } | null>(null);
  const lock = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [history.length, busy, failedMessage]);

  async function persist(
    messages: ChatMessage[],
    response: AgentResult,
    receipt: string,
  ) {
    setSaving(true);
    setSaveError(null);
    pendingSave.current = { history: messages, result: response, receipt };
    try {
      const saved = await saveDraft({
        id,
        expectedUpdatedAt: version,
        history: messages,
        result: response,
        receipt,
      });
      if (!saved.ok) {
        setSaveError(saved.error);
        setConflict(Boolean(saved.conflict));
        return;
      }
      setVersion(saved.row.updated_at);
      setSaved(true);
      pendingSave.current = null;
      // Keep this mounted conversation while giving refresh/bookmark a resumable URL.
      if (window.location.pathname === "/requests/new")
        window.history.replaceState(null, "", `/requests/${id}`);
    } catch {
      setSaveError(
        "Connection interrupted. Retry saving; your agent response is still here.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function send(message: string) {
    message = message.trim();
    if (
      !message ||
      message.length > 8000 ||
      lock.current ||
      pendingSave.current ||
      conflict
    )
      return;
    lock.current = true;
    setBusy(true);
    setActiveMessage(message);
    setError(null);
    setFailedMessage(null);
    setInput("");
    setSaved(false);
    try {
      const response = await fetch("/api/gpu/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, state: result?.state ?? null }),
        signal: AbortSignal.timeout(110_000),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error || "The agent could not respond. Please retry.",
        );
      const next = parseAgentResult(body);
      if (!next)
        throw new Error("An incomplete response was received. Please retry.");
      const time = new Date().toISOString();
      const messages: ChatMessage[] = [
        ...history,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: message,
          createdAt: time,
        },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: next.message,
          createdAt: time,
        },
      ];
      setHistory(messages);
      setResult(next);
      setBusy(false);
      await persist(
        messages,
        next,
        response.headers.get("X-Result-Receipt") || "",
      );
    } catch (error) {
      setFailedMessage(message);
      setError(
        error instanceof Error ? error.message : "Could not send your message.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
      textarea.current?.focus();
    }
  }
  const ready =
    result?.status === "ready" &&
    saved &&
    !busy &&
    !saving &&
    !error &&
    !saveError &&
    !failedMessage;
  const disabled = busy || saving || Boolean(saveError) || conflict;
  return (
    <>
      <Link href="/" className="back-link">
        <ArrowLeft size={14} /> All requests
      </Link>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">LET’S FIND YOUR FIT</span>
          <h1>
            {initial ? "Your workload, refined." : "What are you working on?"}
          </h1>
          <p>Describe your workload. We’ll take care of the configuration.</p>
        </div>
        <span className="draft-indicator">
          {saving ? (
            <LoaderCircle size={13} className="spin" />
          ) : saved ? (
            <Check size={13} />
          ) : (
            <span className="small-dot" />
          )}
          {saving
            ? "Saving…"
            : saved
              ? `Draft saved · ${shortId(id)}`
              : "New draft"}
        </span>
      </div>
      <Stepper current={1} />
      <div className="chat-grid">
        <section className="chat-panel" aria-label="GPU recommendation chat">
          <div className="chat-heading">
            <span className="agent-avatar">
              <Sparkles size={17} />
            </span>
            <div>
              <h2>Research assistant</h2>
              <p>
                <span className="live-dot" /> Here to help you size your
                workload
              </p>
            </div>
            <span className="ai-tag">AI AGENT</span>
          </div>
          <div
            className="chat-messages"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            <div className="chat-message assistant">
              <span className="message-avatar">
                <Sparkles size={15} />
              </span>
              <div className="message-body">
                <span className="message-label">GPU Broker</span>
                <div className="message-bubble">{OPENING}</div>
              </div>
            </div>
            {history.map((m) => (
              <div className={`chat-message ${m.role}`} key={m.id}>
                {m.role === "assistant" && (
                  <span className="message-avatar">
                    <Sparkles size={15} />
                  </span>
                )}
                <div className="message-body">
                  <span className="message-label">
                    {m.role === "user" ? "You" : "GPU Broker"}
                  </span>
                  <div className="message-bubble">{m.content}</div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="chat-message user">
                <div className="message-body">
                  <span className="message-label">You</span>
                  <div className="message-bubble">{activeMessage}</div>
                </div>
              </div>
            )}
            {busy && (
              <div className="chat-message assistant">
                <span className="message-avatar">
                  <Sparkles size={15} />
                </span>
                <div className="thinking">
                  <span />
                  <span />
                  <span />
                  <small>Working through the details</small>
                </div>
              </div>
            )}
            {failedMessage && (
              <div className="chat-message user failed">
                <div className="message-body">
                  <span className="message-label">Not sent</span>
                  <div className="message-bubble">{failedMessage}</div>
                </div>
              </div>
            )}
            {!history.length && !busy && !failedMessage && (
              <div className="chat-starters">
                <span>NOT SURE WHERE TO START?</span>
                {["I want to fine-tune a model", "I want to run inference"].map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setInput(s);
                        textarea.current?.focus();
                      }}
                    >
                      <span>{s}</span>
                      <ArrowUp size={14} />
                    </button>
                  ),
                )}
              </div>
            )}
            {result?.status === "no_feasible_configuration" && (
              <div className="chat-notice">
                <CircleAlert size={16} />
                <p>
                  No available configuration meets these requirements. Try
                  adjusting the model, precision, batch size, or deadline.
                </p>
              </div>
            )}
            {result?.status === "ready" && !busy && !failedMessage && (
              <div className="chat-ready">
                <Check size={15} />
                <div>
                  <strong>We found a configuration that fits.</strong>
                  <p>Review the details, or keep chatting to make changes.</p>
                </div>
              </div>
            )}
            <div ref={bottom} />
          </div>
          {(error || saveError) && (
            <div className="chat-error" role="alert">
              <CircleAlert size={16} />
              <span>{error || saveError}</span>
              {error && failedMessage && (
                <button
                  onClick={() => {
                    setInput(failedMessage);
                    setFailedMessage(null);
                    setError(null);
                    textarea.current?.focus();
                  }}
                >
                  Edit message
                </button>
              )}
              {conflict ? (
                <button onClick={() => window.location.reload()}>Reload</button>
              ) : saveError ? (
                <button
                  disabled={saving}
                  onClick={() => {
                    const p = pendingSave.current;
                    if (p && !saving)
                      void persist(p.history, p.result, p.receipt);
                  }}
                >
                  Retry save
                </button>
              ) : (
                <button
                  onClick={() => failedMessage && void send(failedMessage)}
                >
                  Retry
                </button>
              )}
            </div>
          )}
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <div className="composer-box">
              <textarea
                ref={textarea}
                aria-label="Describe your workload or update its details"
                placeholder="Tell us about your model, dataset, or what you’d like to change…"
                maxLength={8000}
                rows={2}
                disabled={disabled || Boolean(failedMessage)}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
              />
              <button
                aria-label="Send message"
                className="send-button"
                disabled={disabled || !input.trim() || Boolean(failedMessage)}
              >
                {busy ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <ArrowUp size={19} />
                )}
              </button>
            </div>
            <div className="composer-footnote">
              <span>
                <Sparkles size={11} /> Powered by GPT-6.1 Sol
              </span>
              <span>Enter to send · Shift + Enter for a new line</span>
            </div>
          </form>
        </section>
        <div className="chat-sidebar">
          <WorkloadSummary
            result={result}
            stale={busy || Boolean(failedMessage)}
          />
          {result?.gpu_configuration && !busy && (
            <div className="sidebar-recommendation">
              <span className="eyebrow">
                {failedMessage
                  ? "PREVIOUS RECOMMENDATION"
                  : "YOUR RECOMMENDATION"}
              </span>
              <h3>
                {result.gpu_configuration.gpu_count} ×{" "}
                {result.gpu_configuration.gpu}
              </h3>
              <code>{result.gpu_configuration.instance}</code>
              <Link
                className={`primary-button ${!ready ? "disabled-link" : ""}`}
                href={ready ? `/requests/${id}/review` : "#"}
                aria-disabled={!ready}
                tabIndex={ready ? 0 : -1}
              >
                Review recommendation <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </div>
      <div className="workspace-tip">
        <span>
          <Sparkles size={13} /> Have a correction? Just tell the assistant what
          to change.
        </span>
        <span>Your draft is saved after each response.</span>
      </div>
    </>
  );
}
