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

import type { FastifyBaseLogger } from "fastify";
import { callGzac } from "./gzac.js";
import type { ConfigRecord } from "./store.js";

/**
 * The natively-implemented behaviour of the app's single plugin. Where a WASM plugin exports
 * `handle_action` / `handle_request` / `handle_event`, an app implements the same three concerns as
 * plain functions. Each receives the pushed configuration record (properties + the service token +
 * the GZAC callback URL) so it can act and, when granted, call back into GZAC.
 */

export interface ActionInput {
  processInstanceId?: string;
  documentId?: string;
  activityId?: string;
  properties: Record<string, unknown>;
}

export type ActionOutput =
  | { status: "completed"; variables?: Record<string, unknown> }
  | { status: "error"; errorCode: string; errorMessage: string };

export interface RequestInput {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  context?: Record<string, unknown>;
  /** Downscoped user token forwarded from the iframe via GZAC's parent-proxy, when present. */
  userToken?: string;
}

export interface RequestOutput {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface EventInput {
  type: string;
  resultId?: string;
  [key: string]: unknown;
}

interface Document {
  definitionId?: { name?: string };
  content?: Record<string, unknown>;
}

/**
 * Action: builds a greeting from the configured prefix and a name, and writes it to a process
 * variable. When the process is case-bound it fetches the document via the **service token** to
 * enrich the greeting — exercising the app→GZAC callback (allowlist: `GET /api/v1/document/*`).
 */
export async function runAction(
  actionKey: string,
  record: ConfigRecord,
  input: ActionInput,
  log: FastifyBaseLogger,
): Promise<ActionOutput> {
  if (actionKey !== "greet") {
    return { status: "error", errorCode: "UNKNOWN_ACTION", errorMessage: `Unknown action: ${actionKey}` };
  }

  const prefix = (record.properties.greetingPrefix as string) || "Hello";
  const greetingVariable = (input.properties.greetingVariable as string) || "greeting";
  let name = (input.properties.name as string)?.trim() || "";

  if (!name && input.documentId) {
    const res = await callGzac<Document>(record.gzacBaseUrl, record.serviceToken, "GET", `/api/v1/document/${input.documentId}`);
    if (res.status === 200) {
      name = res.body?.definitionId?.name ?? "world";
    } else {
      log.warn({ status: res.status, documentId: input.documentId }, "[demo-app] document lookup failed; greeting 'world'");
    }
  }
  if (!name) name = "world";

  const greeting = `${prefix}, ${name}!`;
  log.info(`[demo-app] greet -> ${greeting}`);
  return { status: "completed", variables: { [greetingVariable]: greeting } };
}

/**
 * Request (`handle_request`): the app serves its own JSON data to the iframe. `/info` is app-served
 * data (no GZAC). `/case-count-as-user` and `/case-count-as-plugin` call back into GZAC with the
 * user token vs the service token so the tab can compare their scopes (levels 3 & 4).
 */
export async function handleRequest(record: ConfigRecord, req: RequestInput, log: FastifyBaseLogger): Promise<RequestOutput> {
  switch (req.path) {
    case "/info":
      return {
        status: 200,
        body: {
          message: "Hello from the demo app backend",
          greetingPrefix: (record.properties.greetingPrefix as string) || "Hello",
          now: new Date().toISOString(),
        },
      };
    case "/case-count-as-user":
      return countCases(record, req, "user", log);
    case "/case-count-as-plugin":
      return countCases(record, req, "plugin", log);
    default:
      return { status: 404, body: { error: `No handler for ${req.path}` } };
  }
}

async function countCases(
  record: ConfigRecord,
  req: RequestInput,
  as: "user" | "plugin",
  log: FastifyBaseLogger,
): Promise<RequestOutput> {
  const caseDefinitionKey = req.context?.caseDefinitionKey as string | undefined;
  if (!caseDefinitionKey) {
    return { status: 400, body: { error: "No caseDefinitionKey in tab context" } };
  }
  const token = as === "user" ? req.userToken : record.serviceToken;
  if (!token) {
    return { status: 401, body: { error: "No user token available for this request" } };
  }

  const res = await callGzac<{ totalElements?: number }>(
    record.gzacBaseUrl,
    token,
    "POST",
    `/api/v1/case/${caseDefinitionKey}/search?page=0&size=1`,
    {},
  );
  log.info(`[demo-app] case count (${as}) -> status ${res.status}`);
  return {
    status: 200,
    body: {
      tokenType: as,
      upstreamStatus: res.status,
      caseDefinitionKey,
      totalElements: res.status === 200 ? res.body?.totalElements ?? null : null,
    },
  };
}

/**
 * Event (`handle_event`): reacts to the CloudEvents GZAC delivers over the pushed broker. On
 * `document.created` it writes a note back to the document with the service token (the granted
 * document-note endpoint), exercising the full event-to-callback round trip.
 */
export async function handleEvent(record: ConfigRecord, event: EventInput, log: FastifyBaseLogger): Promise<void> {
  log.info(`[demo-app] event ${event.type} (resultId=${event.resultId ?? "?"})`);
  if (event.type === "com.ritense.valtimo.document.created" && event.resultId) {
    const content = `Seen by demo app at ${new Date().toISOString()}`;
    const res = await callGzac(record.gzacBaseUrl, record.serviceToken, "POST", `/api/v1/document/${event.resultId}/note`, { content });
    if (res.status < 200 || res.status >= 300) {
      log.warn({ status: res.status, documentId: event.resultId }, "[demo-app] failed to add note");
    } else {
      log.info(`[demo-app] added note to document ${event.resultId}`);
    }
  }
}
