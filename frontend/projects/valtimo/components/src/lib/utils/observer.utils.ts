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

import {Observable} from 'rxjs';

/**
 * Resize observations of [elements]. Lazy: the observer opens on subscribe and disconnects on
 * unsubscribe. Emits each batch of entries from inside the observer callback, when layout is
 * fresh, so reading sizes there forces no extra layout. Runs in whatever zone it is subscribed in.
 */
const fromResizeObserver = (
  elements: Element | Array<Element>,
  options?: ResizeObserverOptions
): Observable<Array<ResizeObserverEntry>> =>
  new Observable(subscriber => {
    const observer = new ResizeObserver(entries => subscriber.next(entries));
    (Array.isArray(elements) ? elements : [elements]).forEach(element =>
      observer.observe(element, options)
    );
    return () => observer.disconnect();
  });

/** Mutation records of [target]. Lazy like [fromResizeObserver]. */
const fromMutationObserver = (
  target: Node,
  options: MutationObserverInit
): Observable<Array<MutationRecord>> =>
  new Observable(subscriber => {
    const observer = new MutationObserver(records => subscriber.next(records));
    observer.observe(target, options);
    return () => observer.disconnect();
  });

/** The border-box inline size of a resize entry, in CSS pixels. */
const borderBoxWidth = (entry: ResizeObserverEntry): number =>
  entry.borderBoxSize?.[0]?.inlineSize ?? entry.target.getBoundingClientRect().width;

/** The content-box inline size of a resize entry, in CSS pixels. */
const contentBoxWidth = (entry: ResizeObserverEntry): number =>
  entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;

export {borderBoxWidth, contentBoxWidth, fromMutationObserver, fromResizeObserver};
