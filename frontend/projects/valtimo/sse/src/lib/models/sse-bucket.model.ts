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

// generic bucket for listeners of any type
import {BaseSseEvent, SseError, SseEventListener} from './sse-events.model';

export class SseSubscriptionBucket<T> {
  readonly listeners: SseEventListener<T>[] = [];

  on(listener: SseEventListener<T>) {
    this.listeners.push(listener);
  }

  off(listener: SseEventListener<T>) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  offAll() {
    this.listeners.length = 0;
  }

  sendEvent(event: T) {
    this.listeners.forEach(listener => {
      listener(event);
    });
  }
}

// error bucket for error listeners
export class SseErrorBucket extends SseSubscriptionBucket<SseError> {}

// implicit type bucket with event for filtering
export class SseEventSubscriptionBucket<T extends BaseSseEvent> extends SseSubscriptionBucket<T> {
  readonly event: string;

  constructor(event: string) {
    super();
    this.event = event;
  }
}
