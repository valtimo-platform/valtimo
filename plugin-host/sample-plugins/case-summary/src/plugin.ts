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

import type {ActionInput, Document, EventInput} from "@valtimo/plugin-sdk";
import {action, config, gzacApi, log, onEvent,} from "@valtimo/plugin-sdk";

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

  log.info(`[case-summary] ${summary}`);

  return {
    status: "completed" as const,
    variables: {
      [summaryVariable]: summary,
      [definitionKeyVariable]: document.definitionId?.name,
    },
  };
});

// Subscribe to platform events declared under `eventSubscriptions` in manifest.json. The host
// routes each matching CloudEvent here. On `document.created` this writes a note back to the
// document via the GZAC API, exercising the full event -> callback round trip. The POST endpoint is
// declared under `permissions.managementEndpoints`, so the configuration must be granted it.
onEvent((event: EventInput) => {
  log.info(
    `[case-summary] event ${event.type} (resultType=${event.resultType ?? "?"}, ` +
      `resultId=${event.resultId ?? "?"}, user=${event.userId ?? "?"})`
  );

  if (event.type === "com.ritense.valtimo.document.created" && event.resultId) {
    const content = `consumed by external plugin on ${new Date().toISOString()}`;
    const res = gzacApi.post(`/api/v1/document/${event.resultId}/note`, {content});
    if (res.status < 200 || res.status >= 300) {
      return {
        status: "error" as const,
        errorCode: `NOTE_CREATE_${res.status}`,
        errorMessage: `Failed to add note to document ${event.resultId} (status ${res.status})`,
      };
    }
    log.info(`[case-summary] added note to document ${event.resultId}`);
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
