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

import { ActionHandler } from "./models/index.js";

const actionHandlers = new Map<string, ActionHandler>();

/**
 * Register an action handler for a given action key.
 * When the plugin host calls handle_action with this key, your handler is invoked.
 */
export function action(key: string, handler: ActionHandler): void {
  actionHandlers.set(key, handler);
}

export function getActionHandler(key: string): ActionHandler | undefined {
  return actionHandlers.get(key);
}

export function getRegisteredActionKeys(): string[] {
  return Array.from(actionHandlers.keys());
}
