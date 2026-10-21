import test from "node:test";
import assert from "node:assert/strict";
import {
  FIELD_LABELS,
  parseAgentResult,
  isAgentState,
  parseHistory,
  visibleFields,
  sameSnapshot,
  formatField,
  formatHours,
  requestName,
  shortId,
  STATUS,
  SUBMITTED_STATES,
  REVIEWABLE_STATES,
} from "../lib/broker.ts";

function fixture(inference = false) {
  const fields = Object.fromEntries(
    Object.keys(FIELD_LABELS).map((k) => [k, null]),
  );
  Object.assign(fields, {
    model_name: "CedarLM",
    parameter_count: 600000000,
    sequence_length: 2048,
    batch_size: 1,
    precision: "BF16",
    workload_type: inference ? "inference" : "training",
  });
  const sources = Object.fromEntries(
    Object.keys(fields).map((k) => [k, fields[k] === null ? "unset" : "user"]),
  );
  if (inference)
    for (const k of [
      "dataset_size_gb",
      "training_method",
      "epochs",
      "lora_rank",
      "training_time_constraint_hours",
    ])
      sources[k] = "not_applicable";
  return {
    status: "needs_input",
    message: "Dataset size?",
    state: {
      values: { model_name: "CedarLM" },
      pending_fields: ["dataset_size_gb"],
      unresolved_fields: [],
    },
    fields,
    field_sources: sources,
    missing_fields: inference ? [] : ["dataset_size_gb"],
    estimated_fields: [],
    assumptions: [],
    gpu_configuration: null,
    estimated_time_hours: null,
  };
}
test("requires complete agent response and rejects fabricated readiness", () => {
  assert.ok(parseAgentResult(fixture()));
  assert.equal(parseAgentResult({ status: "ready" }), null);
  assert.equal(parseAgentResult({ ...fixture(), status: "ready" }), null);
  assert.equal(
    parseAgentResult({ ...fixture(), estimated_time_hours: Infinity }),
    null,
  );
});
test("validates recommendation numbers and required field values", () => {
  const r = {
    ...fixture(),
    status: "ready",
    gpu_configuration: {
      instance: "test",
      gpu: "A10G",
      gpu_count: 1,
      required_memory_gb_per_gpu: 12,
      usable_memory_gb_per_gpu: 21.6,
    },
  };
  assert.ok(parseAgentResult(r));
  assert.equal(
    parseAgentResult({
      ...r,
      gpu_configuration: { ...r.gpu_configuration, gpu_count: 0 },
    }),
    null,
  );
  assert.equal(
    parseAgentResult({
      ...r,
      gpu_configuration: {
        ...r.gpu_configuration,
        required_memory_gb_per_gpu: NaN,
      },
    }),
    null,
  );
  assert.equal(
    parseAgentResult({ ...r, fields: { ...r.fields, batch_size: undefined } }),
    null,
  );
});
test("state accepts only known workload fields and finite values", () => {
  assert.ok(isAgentState(fixture().state));
  assert.equal(
    isAgentState({ ...fixture().state, values: { admin: true } }),
    false,
  );
  assert.equal(
    isAgentState({ ...fixture().state, values: { batch_size: NaN } }),
    false,
  );
  assert.equal(
    isAgentState({ ...fixture().state, pending_fields: ["gpu"] }),
    false,
  );
});
test("shows missing essentials but hides irrelevant and optional empty fields", () => {
  const training = visibleFields(fixture());
  assert.ok(training.includes("dataset_size_gb"));
  assert.ok(!training.includes("epochs"));
  assert.ok(!visibleFields(fixture(true)).includes("dataset_size_gb"));
  assert.ok(!visibleFields(fixture(true)).includes("lora_rank"));
});
test("recovers only valid saved messages without rendering arbitrary objects", () => {
  const valid = {
    id: "1",
    role: "user",
    content: "Hello",
    createdAt: new Date().toISOString(),
  };
  assert.deepEqual(
    parseHistory([null, { role: "system", content: "bad" }, valid]),
    [valid],
  );
  assert.deepEqual(parseHistory({ messages: [valid] }), []);
});
test("save retry compares JSONB independently of property order and preserves message order", () => {
  assert.equal(
    sameSnapshot({ b: 2, a: { d: 4, c: 3 } }, { a: { c: 3, d: 4 }, b: 2 }),
    true,
  );
  assert.equal(
    sameSnapshot(["hello", "response"], ["response", "hello"]),
    false,
  );
});
test("formats units, missing values and inference runtime explicitly", () => {
  assert.equal(formatField("parameter_count", 3212749824), "3.213B");
  assert.equal(formatField("dataset_size_gb", 1.073741824), "1.073742 GB");
  assert.equal(
    formatField("training_time_constraint_hours", "urgent"),
    "Urgent",
  );
  assert.equal(formatField("batch_size", null), "Not provided");
  assert.equal(formatHours(0.5), "30 min");
  assert.equal(formatHours(2.35), "2.35 hours");
});
test("uses the supplied database status semantics", () => {
  assert.equal(STATUS[1].label, "Draft");
  assert.equal(STATUS[2].label, "Awaiting review");
  assert.equal(STATUS[3].label, "Reviewed");
  assert.equal(STATUS[4].label, "Provisioning started");
  assert.equal(shortId("12345678-1234-1234-1234-123456789abc"), "REQ-12345678");
  const row = { agent_result: fixture(true), chat_history: null };
  assert.equal(requestName(row), "CedarLM · Inference");
});

test("decision statuses stay submitted and do not imply provisioning", () => {
  assert.equal(STATUS[5].label, "Approved");
  assert.equal(STATUS[6].label, "Rejected");
  assert.deepEqual(SUBMITTED_STATES, [2, 3, 4, 5, 6]);
  assert.deepEqual(REVIEWABLE_STATES, [2, 3]);
  assert.ok(!REVIEWABLE_STATES.includes(4));
  assert.ok(!REVIEWABLE_STATES.includes(5));
  assert.ok(!REVIEWABLE_STATES.includes(6));
});
