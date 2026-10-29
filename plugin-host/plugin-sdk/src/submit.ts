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

import { SubmitHandler } from "./models/index.js";

const submitHandlers = new Map<string, SubmitHandler>();

/**
 * Register a task-form submit handler for a given bundle key (Level 1).
 *
 * When a `task-form` bundle declares `submitHandler: true` in the manifest, GZAC calls this handler
 * (server-to-server, on the same rails as `action`) during submission — *before* it completes the
 * task. Return `{status: "completed", variables, documentContent}` to have GZAC complete the task
 * with those values, or `{status: "error", errorMessage, fieldErrors}` to reject the submission and
 * surface the errors on the form. The key must match the bundle's `key`.
 */
export function submit(key: string, handler: SubmitHandler): void {
  submitHandlers.set(key, handler);
}

export function getSubmitHandler(key: string): SubmitHandler | undefined {
  return submitHandlers.get(key);
}

export function getRegisteredSubmitKeys(): string[] {
  return Array.from(submitHandlers.keys());
}
