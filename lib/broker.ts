import type { Tables } from "@/lib/supabase/generatedTypes";

export const FIELD_LABELS = {
  model_name: "Model",
  parameter_count: "Parameters",
  dataset_size_gb: "Dataset size",
  sequence_length: "Sequence length",
  batch_size: "Batch size",
  training_method: "Training method",
  precision: "Precision",
  number_of_layers: "Layers",
  hidden_size: "Hidden size",
  epochs: "Epochs",
  training_time_constraint_hours: "Training deadline",
  workload_type: "Workload",
  lora_rank: "LoRA rank",
} as const;
export type Field = keyof typeof FIELD_LABELS;
export type FieldValue = string | number | null;
export type AgentState = {
  values: Partial<Record<Field, string | number>>;
  unresolved_fields: Field[];
  pending_fields: Field[];
};
export type Configuration = {
  instance: string;
  gpu: string;
  gpu_count: number;
  required_memory_gb_per_gpu: number;
  usable_memory_gb_per_gpu: number;
  training_hours?: number | null;
};
export type AgentResult = {
  status: "needs_input" | "ready" | "no_feasible_configuration";
  message: string;
  state: AgentState;
  fields: Record<Field, FieldValue>;
  field_sources: Record<Field, string>;
  missing_fields: Field[];
  estimated_fields: Field[];
  assumptions: string[];
  gpu_configuration: Configuration | null;
  estimated_time_hours: number | null;
};
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};
export type RequestRow = Tables<"requests">;
export const STATUS = {
  1: { label: "Draft", className: "draft" },
  2: { label: "Awaiting review", className: "pending" },
  3: { label: "Reviewed", className: "reviewed" },
  4: { label: "Provisioning started", className: "provisioning" },
  5: { label: "Approved", className: "approved" },
  6: { label: "Rejected", className: "rejected" },
} as const;
// Reviewed is still pending a decision; provisioning is a separate, read-only state.
export const REVIEWABLE_STATES = [2, 3] as const;
export const SUBMITTED_STATES = [2, 3, 4, 5, 6] as const;
export const SOURCE_LABELS: Record<string, string> = {
  user: "You provided",
  model_registry: "Model defaults",
  model_name: "Model name",
  default: "Default",
  estimated: "Estimated",
  unavailable: "Unknown",
  unset: "Not provided",
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isField = (v: unknown): v is Field =>
  typeof v === "string" && Object.hasOwn(FIELD_LABELS, v);
const isValue = (v: unknown) =>
  v === null ||
  typeof v === "string" ||
  (typeof v === "number" && Number.isFinite(v));
const isFieldList = (v: unknown): v is Field[] =>
  Array.isArray(v) && v.length <= 13 && v.every(isField);

export function isAgentState(v: unknown): v is AgentState {
  return (
    isObject(v) &&
    Object.keys(v).length === 3 &&
    isObject(v.values) &&
    Object.entries(v.values).every(
      ([k, value]) => isField(k) && value !== null && isValue(value),
    ) &&
    isFieldList(v.pending_fields) &&
    isFieldList(v.unresolved_fields)
  );
}

export function parseAgentResult(v: unknown): AgentResult | null {
  if (
    !isObject(v) ||
    !["ready", "needs_input", "no_feasible_configuration"].includes(
      String(v.status),
    ) ||
    typeof v.message !== "string" ||
    !isAgentState(v.state) ||
    !isObject(v.fields) ||
    !isObject(v.field_sources) ||
    !Object.keys(FIELD_LABELS).every(
      (k) =>
        isValue((v.fields as Record<string, unknown>)[k]) &&
        typeof (v.field_sources as Record<string, unknown>)[k] === "string",
    ) ||
    !isFieldList(v.missing_fields) ||
    !isFieldList(v.estimated_fields) ||
    !Array.isArray(v.assumptions) ||
    !v.assumptions.every((x) => typeof x === "string") ||
    !(
      v.estimated_time_hours === null ||
      (typeof v.estimated_time_hours === "number" &&
        Number.isFinite(v.estimated_time_hours) &&
        v.estimated_time_hours >= 0)
    )
  )
    return null;
  const c = v.gpu_configuration;
  if (
    c !== null &&
    (!isObject(c) ||
      typeof c.instance !== "string" ||
      typeof c.gpu !== "string" ||
      ![
        "gpu_count",
        "required_memory_gb_per_gpu",
        "usable_memory_gb_per_gpu",
      ].every(
        (k) =>
          typeof c[k] === "number" &&
          Number.isFinite(c[k]) &&
          (c[k] as number) >= 0,
      ))
  )
    return null;
  if (v.status === "ready" && (!c || (c as Configuration).gpu_count < 1))
    return null;
  return v as AgentResult;
}

export function parseHistory(v: unknown): ChatMessage[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (m): m is ChatMessage =>
      isObject(m) &&
      typeof m.id === "string" &&
      ["user", "assistant"].includes(String(m.role)) &&
      typeof m.content === "string" &&
      typeof m.createdAt === "string",
  );
}

export function visibleFields(result: AgentResult): Field[] {
  return (Object.keys(FIELD_LABELS) as Field[]).filter(
    (field) =>
      result.field_sources[field] !== "not_applicable" &&
      (result.fields[field] !== null || result.missing_fields.includes(field)),
  );
}
export function formatField(field: Field, value: FieldValue) {
  if (value === null) return "Not provided";
  if (field === "workload_type")
    return value === "training" ? "Training" : "Inference";
  if (field === "parameter_count" && typeof value === "number")
    return value >= 1e9
      ? `${Number((value / 1e9).toFixed(3))}B`
      : `${Number((value / 1e6).toFixed(2))}M`;
  if (field === "dataset_size_gb")
    return `${Number(Number(value).toFixed(6))} GB`;
  if (field === "sequence_length")
    return `${Number(value).toLocaleString("en-US")} tokens`;
  if (field === "training_time_constraint_hours")
    return value === "urgent" ? "Urgent" : `${value} hours`;
  return typeof value === "number"
    ? value.toLocaleString("en-US", {
        maximumFractionDigits: field === "hidden_size" ? 1 : 6,
      })
    : value;
}
export function formatHours(hours: number) {
  return hours < 1
    ? `${Math.max(1, Math.round(hours * 60))} min`
    : `${Number(hours.toFixed(2))} hours`;
}
export function requestName(row: RequestRow) {
  const result = parseAgentResult(row.agent_result);
  const name = result?.fields.model_name;
  return name
    ? `${name} · ${result.fields.workload_type === "inference" ? "Inference" : "Training"}`
    : parseHistory(row.chat_history)
        .find((m) => m.role === "user")
        ?.content.slice(0, 64) || "Untitled request";
}
export function shortId(id: string) {
  return `REQ-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}
export function sameSnapshot(a: unknown, b: unknown): boolean {
  const stable = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(stable)
      : isObject(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, stable(value[key])]),
          )
        : value;
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(date));
}
