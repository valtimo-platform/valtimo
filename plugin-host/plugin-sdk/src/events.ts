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

import { EventHandler } from "./models/index.js";

const eventHandlers: EventHandler[] = [];

/**
 * Register a handler for platform events. The plugin host delivers every event whose CloudEvent
 * `type` is listed in the manifest's `eventSubscriptions`. Discriminate on `event.type` inside the
 * handler. Multiple handlers may be registered; all are invoked for each event.
 */
export function onEvent(handler: EventHandler): void {
  eventHandlers.push(handler);
}

export function getEventHandlers(): EventHandler[] {
  return eventHandlers;
}
