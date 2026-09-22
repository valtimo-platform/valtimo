/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type {ActionInput, Document, EventInput, RequestInput, SubmitInput} from "@valtimo/plugin-sdk";
import {action, config, gzacApi, httpRequest, kv, log, onEvent, request, submit,} from "@valtimo/plugin-sdk";

// Plugin-served data for the case-tab iframe. Reached via the host's
// `POST /plugins/case-summary/{version}/data` route, which the Angular parent-proxy calls when the
// bundle invokes `sdk.getPluginData("/summary")`. Demonstrates the "plugin serves its own data"
// origin — distinct from data the plugin reads back out of GZAC.
request("/summary", (input: RequestInput) => {
  const currency = (input.configuration.currency as string) ?? "EUR";

  // KV scenario: persistent per-document view counter
  const countKey = "view-count:" + (input.context?.documentId ?? "global");
  const prev = kv.get<number>(countKey);
  const viewCount = (prev.found ? prev.value! : 0) + 1;
  kv.set(countKey, viewCount);
  log.info("Plugin summary served", {documentId: input.context?.documentId, viewCount});

  return {
    status: 200,
    body: {
      message: "Hello from the case-summary plugin backend",
      currency,
      documentId: input.context?.documentId ?? null,
      viewCount,
      items: [
        {label: "Status", value: "In progress"},
        {label: "Priority", value: "Normal"},
        {label: "Channel", value: "Web"},
      ],
    },
  };
});

// Plugin-served data for the "Overview" menu page (a routed full-page iframe, not case-scoped).
// Reached the same way as the case-tab data — `sdk.getPluginData("/overview")` -> host data route.
// A page's context carries the plugin `configurationId` (no documentId), demonstrating that a page
// is application-level rather than bound to a single case.
request("/overview", (input: RequestInput) => {
  const currency = (input.configuration.currency as string) ?? "EUR";
  return {
    status: 200,
    body: {
      message: "Hello from the case-summary plugin backend (overview page)",
      configurationId: input.context?.configurationId ?? null,
      stats: [
        {label: "Open cases", value: "12"},
        {label: "Closed this week", value: "5"},
        {label: "Currency", value: currency},
      ],
    },
  };
});

// Plugin-served data for the "Reports" menu page — a small tabular report the plugin computes
// itself, showing a second, distinct page from the same plugin selected by its bundle key.
request("/reports", () => {
  return {
    status: 200,
    body: {
      rows: [
        {period: "2026-W24", created: 8, completed: 6},
        {period: "2026-W25", created: 11, completed: 9},
        {period: "2026-W26", created: 7, completed: 7},
      ],
    },
  };
});

// http_request scenario: fetch from a trusted public test API (JSONPlaceholder) and combine with
// KV-stored metadata. Demonstrates outbound HTTP, KV persistence, and structured logging — all
// three results visible in the case tab.
//
// Two destinations, two provenances. JSONPlaceholder is fixed in `permissions.egress`, so it is part
// of the grant the admin accepts once. `configuration.externalApiUrl` is marked `x-egress-target`,
// so GZAC derives its origin from whatever the admin typed and pushes that alongside — the plugin
// never has to know which of the two it is calling, but a wrong URL is refused by the allowlist.
request("/external-data", (input: RequestInput) => {
  const res = httpRequest.get<{id: number; title: string; completed: boolean}>(
    "https://jsonplaceholder.typicode.com/todos/1"
  );
  log.info("Fetched external data", {status: res.status, title: res.body?.title});

  const configuredUrl = (input.configuration.externalApiUrl as string | undefined)?.trim();
  let configured: {url: string; status: number; reached: boolean} | null = null;
  if (configuredUrl) {
    const configuredRes = httpRequest.get<unknown>(configuredUrl);
    log.info("Fetched admin-configured external data", {
      url: configuredUrl,
      status: configuredRes.status,
    });
    configured = {
      url: configuredUrl,
      status: configuredRes.status,
      reached: configuredRes.status >= 200 && configuredRes.status < 300,
    };
  }

  const docKey = "view-count:" + (input.context?.documentId ?? "global");
  const viewCount = kv.get<number>(docKey).value ?? 0;

  return {
    status: 200,
    body: {
      todo: res.status === 200 ? res.body : null,
      viewCount,
      fetchStatus: res.status,
      configured,
    },
  };
});

// KV stats: aggregate view counts across all tracked documents.
request("/kv-stats", () => {
  const allKeys = kv.list("view-count:");
  const totalViews = allKeys.reduce((sum, key) => {
    const val = kv.get<number>(key);
    return sum + (val.found ? val.value! : 0);
  }, 0);
  return {
    status: 200,
    body: {trackedDocuments: allKeys.length, totalViews},
  };
});

// Level 3 — tab -> plugin backend -> GZAC, authenticated with the **downscoped user token**.
// Counts the cases of this type the call can see via `gzacApi.asUser`: row-level PBAC filters the
// list to the logged-in user's accessible cases (∩ the plugin's allowlist).
request("/case-count-as-user", (input: RequestInput) => countCases(input, "user"));

// Level 4 — tab -> plugin backend -> GZAC, authenticated with the **service (plugin) token**.
// Same count, but PBAC is bypassed (system principal), so it sees *every* case of this type.
// Comparing the two totals shows the plugin token's scope is broader than any single user's.
request("/case-count-as-plugin", (input: RequestInput) => countCases(input, "plugin"));

/**
 * Shared handler for levels 3 & 4. The case-list search is row-level PBAC-filtered, so its
 * `totalElements` is a faithful scope signal: the user token returns the user's visible subset,
 * the service token returns the full set. A single-document GET can't show this — it's all-or-
 * nothing and the user already has access to the case whose tab they opened.
 */
function countCases(input: RequestInput, as: "user" | "plugin") {
  const caseDefinitionKey = input.context?.caseDefinitionKey as string | undefined;
  if (!caseDefinitionKey) {
    return {status: 400, body: {error: "No caseDefinitionKey in tab context"}};
  }

  const api = as === "user" ? gzacApi.asUser : gzacApi;
  const res = api.post<{totalElements?: number}>(
    `/api/v1/case/${caseDefinitionKey}/search?page=0&size=1`,
    {}
  );

  return {
    status: 200,
    body: {
      tokenType: as,
      upstreamStatus: res.status,
      caseDefinitionKey,
      totalElements: res.status === 200 ? (res.body?.totalElements ?? null) : null,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Task-form scenarios. The plugin ships three `task-form` bundles demonstrating the three levels:
//   - Level 0 (`approve`)  : pure frontend form, NO backend code here. The bundle sends value-
//                            resolver-prefixed keys via `sdk.submitTask` and GZAC completes the task.
//   - Level 1 (`review`)   : the `submit("review", …)` hook below validates/transforms the raw
//                            submission; GZAC still completes the task with what the hook returns.
//   - Level 2 (`custom`)   : the `request("/submit-task", …)` handler below drives completion itself
//                            via `gzacApi.asUser` (the escape hatch, unchanged from before).
// ---------------------------------------------------------------------------------------------

// Level 1 — task-form submit hook. GZAC calls this synchronously during submission (because the
// `review` task-form bundle declares `submitHandler: true`), BEFORE completing the task. It runs on
// the same rails as an action (server-to-server, HMAC, service token). Return `{status:"completed",
// variables, documentContent}` and GZAC completes the task with those values; return
// `{status:"error", errorMessage, fieldErrors}` to reject the submission and show errors on the form.
submit("review", (input: SubmitInput) => {
  const submission = input.submission as {decision?: string; comment?: string};
  const decision = (submission.decision ?? "").trim();
  const comment = (submission.comment ?? "").trim();

  // Custom validation the browser cannot bypass — a rejection must carry a reason.
  if (decision === "reject" && comment.length === 0) {
    return {
      status: "error" as const,
      errorCode: "COMMENT_REQUIRED",
      errorMessage: "A comment is required when rejecting.",
      fieldErrors: {comment: "Please explain why you are rejecting this case."},
    };
  }
  if (decision !== "approve" && decision !== "reject") {
    return {
      status: "error" as const,
      errorCode: "INVALID_DECISION",
      fieldErrors: {decision: "Choose approve or reject."},
    };
  }

  // Derived, server-authoritative variables + a document field — GZAC applies these the standard way.
  log.info("Review submit hook", {decision});
  return {
    status: "completed" as const,
    variables: {
      caseReviewDecision: decision,
      caseReviewApproved: decision === "approve",
      caseReviewedAt: new Date().toISOString(),
    },
    documentContent: {
      "/reviewComment": comment,
    },
  };
});

// Level 2 — full custom escape hatch. The `custom` task-form bundle POSTs here via
// `sdk.postPluginData("/submit-task", …)` and this handler completes the user task in GZAC itself,
// **as the logged-in user** (`gzacApi.asUser`, PBAC ∩ allowlist). The task id comes from the
// authoritative backend-supplied task context (never the request body); the complete endpoint must
// be granted under `permissions.endpoints`. Prefer Level 0/1 — this remains for genuinely custom needs.
request("/submit-task", (input: RequestInput) => {
  const taskId = input.context?.taskId as string | undefined;
  if (!taskId) {
    return {status: 400, body: {error: "No taskId in task-form context"}};
  }

  const body = (input.body ?? {}) as {variables?: Record<string, unknown>};
  const variables = body.variables ?? {};

  const res = gzacApi.asUser.post(`/api/v1/task/${taskId}/complete`, {variables});
  if (res.status < 200 || res.status >= 300) {
    log.info("Task completion failed", {taskId, status: res.status});
    return {
      status: res.status,
      body: {error: `Task completion failed (status ${res.status})`},
    };
  }

  log.info("Completed task as user", {taskId});
  return {status: 200, body: {completed: true}};
});

action("case-summary", (input: ActionInput) => {
  const titleField = (input.properties.titleField as string) || "/applicantName";
  const amountField = input.properties.amountField as string | undefined;
  const summaryVariable = (input.properties.summaryVariable as string) || "caseSummary";
  const definitionKeyVariable = (input.properties.definitionKeyVariable as string) || "caseDefinitionKey";
  const currency = (config.get("currency") as string) || "EUR";

  if (!input.documentId) {
    return {
      status: "error" as const,
      errorCode: "NO_BUSINESS_KEY",
      errorMessage:
        "Process has no business key — case-summary requires a case-bound process",
    };
  }

  const res = gzacApi.get<Document>(`/api/v1/document/${input.documentId}`);
  if (res.status !== 200) {
    return {
      status: "error" as const,
      errorCode: `DOCUMENT_LOOKUP_${res.status}`,
      errorMessage: `Could not fetch document ${input.documentId} (status ${res.status})`,
    };
  }

  const document = res.body;
  const content = document.content ?? {};
  const title = pointerLookup(content, titleField);
  const amount = amountField ? pointerLookup(content, amountField) : undefined;

  const parts: string[] = [];
  parts.push(title != null ? String(title) : "(no title)");
  if (amount != null) {
    parts.push(`${currency} ${amount}`);
  }
  parts.push(
    `(${document.definitionId?.name ?? "unknown"}/${input.documentId})`
  );
  const summary = parts.join(" — ");

  log.info("Built case summary", {documentId: input.documentId, summary, currency});

  return {
    status: "completed" as const,
    variables: {
      [summaryVariable]: summary,
      [definitionKeyVariable]: document.definitionId?.name,
    },
    // `result` is a separate channel from `variables`, consumed only by the process link's
    // configured `actionResultMappings` (e.g. mapping "/summary" to a `doc:` path). Every key
    // declared under the action's `outputs` in manifest.json must be present here — `?? null`
    // keeps a key on the wire when the lookup found nothing (undefined would be dropped by JSON
    // serialization and violate the outputs contract).
    result: {
      summary,
      title: title ?? null,
      amount: amount ?? null,
      currency,
    },
  };
});

// Subscribe to platform events declared under `eventSubscriptions` in manifest.json. The host
// routes each matching CloudEvent here. On `document.created` this writes a note back to the
// document via the GZAC API, exercising the full event -> callback round trip. The POST endpoint is
// declared under `permissions.endpoints`, so the configuration must be granted it.
onEvent((event: EventInput) => {
  if (event.type === "com.ritense.valtimo.document.created" && event.resultId) {
    log.info("Document created event received", {resultId: event.resultId, userId: event.userId});
    const content = `consumed by external plugin on ${new Date().toISOString()}`;
    const res = gzacApi.post(`/api/v1/document/${event.resultId}/note`, {content});
    if (res.status < 200 || res.status >= 300) {
      log.warn("Failed to add note", {documentId: event.resultId, status: res.status});
      return {
        status: "error" as const,
        errorCode: `NOTE_CREATE_${res.status}`,
        errorMessage: `Failed to add note to document ${event.resultId} (status ${res.status})`,
      };
    }
    log.info("Added note to document", {documentId: event.resultId});
  }

  return {status: "completed" as const};
});

/**
 * Minimal RFC 6901 JSON Pointer lookup. `""` and `"/"` return the root; missing path segments
 * return undefined rather than throwing. Supports the `~0`/`~1` escape sequences.
 */
function pointerLookup(
  content: Record<string, unknown>,
  pointer: string
): unknown {
  if (!pointer || pointer === "/") {
    return content;
  }
  const trimmed = pointer.startsWith("/") ? pointer.slice(1) : pointer;
  const parts = trimmed
    .split("/")
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur: unknown = content;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}
