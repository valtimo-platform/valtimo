/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

type SseEventType =
  | 'CASE_CREATED'
  | 'TASK_UPDATE'
  | 'PROCESS_END'
  | 'CASE_ASSIGNED'
  | 'CASE_UNASSIGNED'
  | 'ESTABLISHED_CONNECTION';

type SseEventListener<T> = (event: T) => void;

// base event containing the event type
interface BaseSseEvent {
  eventType?: SseEventType;
  processInstanceId?: string;
}

// event implementations for json mapping objects in:
interface TaskUpdateSseEvent extends BaseSseEvent {
  processInstanceId: string;
}

interface EstablishedConnectionSseEvent extends BaseSseEvent {
  subscriptionId: string;
}

interface SseError {
  state: number;
  message: string;
  data?: any;
}

export {
  SseError,
  EstablishedConnectionSseEvent,
  TaskUpdateSseEvent,
  BaseSseEvent,
  SseEventListener,
  SseEventType,
};
