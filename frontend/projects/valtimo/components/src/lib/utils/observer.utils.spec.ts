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

import {firstValueFrom} from 'rxjs';
import {borderBoxWidth, fromMutationObserver, fromResizeObserver} from './observer.utils';

describe('observer utils', () => {
  let element: HTMLDivElement;

  const nextMicrotask = (): Promise<void> => new Promise(resolve => setTimeout(resolve));

  beforeEach(() => {
    element = document.createElement('div');
    element.style.width = '120px';
    document.body.appendChild(element);
  });

  afterEach(() => element.remove());

  it('observes nothing until subscribed, and stops when unsubscribed', async () => {
    const records = jasmine.createSpy('records');
    const mutations$ = fromMutationObserver(element, {childList: true});

    element.appendChild(document.createElement('span'));
    await nextMicrotask();
    const subscription = mutations$.subscribe(records);
    expect(records).not.toHaveBeenCalled();

    element.appendChild(document.createElement('span'));
    await nextMicrotask();
    expect(records).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();
    element.appendChild(document.createElement('span'));
    await nextMicrotask();
    expect(records).toHaveBeenCalledTimes(1);
  });

  it('reports the size of an observed element', async () => {
    const entries = await firstValueFrom(fromResizeObserver(element));

    expect(borderBoxWidth(entries[0])).toBe(120);
  });

  it('disconnects its resize observer when unsubscribed', () => {
    const disconnect = spyOn(ResizeObserver.prototype, 'disconnect').and.callThrough();

    fromResizeObserver(element).subscribe().unsubscribe();

    expect(disconnect).toHaveBeenCalled();
  });
});
