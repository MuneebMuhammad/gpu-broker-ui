import {
  ArrowUpRight,
  Check,
  Clock3,
  Cpu,
  Database,
  Info,
  Layers3,
  Server,
} from "lucide-react";
import {
  FIELD_LABELS,
  SOURCE_LABELS,
  visibleFields,
  formatField,
  formatHours,
  type AgentResult,
  type Field,
} from "@/lib/broker";

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="stepper" aria-label="Request progress">
      {["Describe workload", "Review recommendation", "Request submitted"].map(
        (title, i) => (
          <li
            key={title}
            className={
              i + 1 === current ? "current" : i + 1 < current ? "complete" : ""
            }
            aria-current={i + 1 === current ? "step" : undefined}
          >
            <span className="step-number">
              {i + 1 < current ? <Check size={13} /> : `0${i + 1}`}
            </span>
            <span>{title}</span>
            {i < 2 && <span className="step-line" />}
          </li>
        ),
      )}
    </ol>
  );
}

export function WorkloadSummary({
  result,
  stale = false,
  neutral = false,
}: {
  result: AgentResult | null;
  stale?: boolean;
  neutral?: boolean;
}) {
  const architecture: Field[] = ["number_of_layers", "hidden_size"];
  const fields = result ? visibleFields(result) : [];
  const sourceLabel = (source: string) =>
    neutral && source === "user"
      ? "Researcher provided"
      : SOURCE_LABELS[source] || source;
  function fieldRow(field: Field) {
    if (!result) return null;
    const source = result.field_sources[field];
    return (
      <div className="field-row" key={field}>
        <dt>
          {FIELD_LABELS[field]}
          <span
            className={`field-source source-${source}`}
            title={sourceLabel(source)}
          >
            {sourceLabel(source)}
          </span>
        </dt>
        <dd
          className={result.fields[field] === null ? "field-missing" : ""}
          title={String(result.fields[field] ?? "Not provided")}
        >
          {formatField(field, result.fields[field])}
        </dd>
      </div>
    );
  }
  return (
    <aside className="summary-panel">
      <div className="panel-heading">
        <span className="icon-tile">
          <Layers3 size={17} />
        </span>
        <div>
          <h2>Workload summary</h2>
          <p>Details that shape {neutral ? "the" : "your"} configuration</p>
        </div>
      </div>
      {stale && result && (
        <div className="summary-note">
          <Info size={14} /> Previous values · waiting for an updated
          recommendation.
        </div>
      )}
      {!result ? (
        <div className="summary-empty">
          <div className="summary-placeholder">
            <span>MODEL</span>
            <i />
            <span>WORKLOAD</span>
            <i />
            <span>DATASET</span>
            <i />
          </div>
          <p>
            Start with your model and what you want to do. We’ll fill in the
            details together.
          </p>
        </div>
      ) : (
        <>
          <dl className="field-list">
            {fields.filter((f) => !architecture.includes(f)).map(fieldRow)}
          </dl>
          {fields.some((f) => architecture.includes(f)) && (
            <details className="architecture">
              <summary>
                Model architecture <Layers3 size={13} />
              </summary>
              <dl className="field-list">
                {fields.filter((f) => architecture.includes(f)).map(fieldRow)}
              </dl>
            </details>
          )}
          {result.estimated_fields.length > 0 && (
            <div className="summary-note">
              <Info size={14} />
              <span>
                Some architecture values are estimated. Review the assumptions
                {neutral ? "used in the estimate." : "before submitting."}
              </span>
            </div>
          )}
        </>
      )}
      <div className="summary-bottom">
        <span className="live-dot" />{" "}
        {neutral ? "Saved workload values" : "Updates as you chat"}
      </div>
    </aside>
  );
}

export function Recommendation({
  result,
  compact = false,
  neutral = false,
}: {
  result: AgentResult;
  compact?: boolean;
  neutral?: boolean;
}) {
  const config = result.gpu_configuration;
  if (!config)
    return (
      <div className="no-configuration">
        <Info size={20} />
        <h3>No configuration found yet</h3>
        <p>
          {result.status === "needs_input"
            ? "A few more details will help us find the right fit."
            : "The current requirements exceed the available configurations. Adjust your workload in the chat."}
        </p>
      </div>
    );
  return (
    <section className={`recommendation-card ${compact ? "compact" : ""}`}>
      <div className="recommendation-topline">
        <span className="eyebrow">
          <span className="live-dot" /> RECOMMENDED CONFIGURATION
        </span>
        <span className="fit-badge">
          <Check size={12} /> Workload fit
        </span>
      </div>
      <div className="recommendation-hero">
        <div className="hardware-icon">
          <Server size={44} strokeWidth={1.1} />
          <div className="hardware-led" />
        </div>
        <div>
          <h2>
            {config.gpu_count} × {config.gpu}
          </h2>
          <p>
            {config.gpu_count === 1
              ? "Single GPU"
              : `${config.gpu_count}-GPU configuration`}
            <span>·</span>
            {result.fields.workload_type === "inference"
              ? "Inference"
              : "Training"}
          </p>
          <code>{config.instance}</code>
        </div>
      </div>
      <div className="configuration-metrics">
        <div>
          <Database size={16} />
          <span>Estimated memory / GPU</span>
          <strong>
            {config.required_memory_gb_per_gpu.toFixed(2)} <small>GB</small>
          </strong>
        </div>
        <div>
          <Cpu size={16} />
          <span>Usable memory / GPU</span>
          <strong>
            {config.usable_memory_gb_per_gpu.toFixed(1)} <small>GB</small>
          </strong>
        </div>
        <div>
          <Clock3 size={16} />
          <span>
            {result.estimated_time_hours === null
              ? "Inference runtime"
              : "Estimated training time"}
          </span>
          <strong
            className={
              result.estimated_time_hours === null ? "metric-text" : ""
            }
          >
            {result.estimated_time_hours === null
              ? "Not estimated"
              : formatHours(result.estimated_time_hours)}
          </strong>
        </div>
      </div>
      <div className="recommendation-reason">
        <h3>Why this configuration?</h3>
        <p>
          Fits {neutral ? "the researcher’s" : "your"} model and workload within
          the available GPU memory
          {result.fields.training_time_constraint_hours === "urgent"
            ? `, with ${neutral ? "the" : "your"} urgency preference considered`
            : typeof result.fields.training_time_constraint_hours === "number"
              ? ` and ${neutral ? "the" : "your"} training deadline`
              : ""}
          .
        </p>
      </div>
      <details className="assumptions">
        <summary>
          <Info size={14} /> Estimation assumptions <ArrowUpRight size={13} />
        </summary>
        <ul>
          {result.assumptions.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
