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

import {RequestHandler} from "./models/index.js";

const requestHandlers = new Map<string, RequestHandler>();
let catchAllHandler: RequestHandler | undefined;

/**
 * Register a request handler for a given path. When the iframe calls
 * `sdk.getPluginData(path)` (which the host forwards to `handle_request`), the handler registered
 * for that exact path is invoked. The RPC-style counterpart to {@link action}.
 */
export function request(path: string, handler: RequestHandler): void {
  requestHandlers.set(path, handler);
}

/**
 * Register a catch-all request handler, invoked when no exact-path handler matches. Use this to
 * implement custom routing inside the plugin.
 */
export function onRequest(handler: RequestHandler): void {
  catchAllHandler = handler;
}

export function getRequestHandler(path: string): RequestHandler | undefined {
  return requestHandlers.get(path) ?? catchAllHandler;
}

export function getRegisteredRequestPaths(): string[] {
  return Array.from(requestHandlers.keys());
}
