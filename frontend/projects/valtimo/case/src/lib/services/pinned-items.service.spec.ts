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

import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {ConfigService, InterceptorSkip} from '@valtimo/shared';
import {PinnedItem, PinnedItemType} from '../models';
import {PinnedItemsService} from './pinned-items.service';

describe('PinnedItemsService', () => {
  const ENDPOINT = '/api/v1/pinned-item';
  const TYPE = PinnedItemType.CASE_DEFINITION;

  let service: PinnedItemsService;
  let httpMock: HttpTestingController;
  let latest: PinnedItem[];

  const pinned = (itemKey: string, order = 0): PinnedItem => ({
    itemType: TYPE,
    itemKey,
    order,
    displayName: itemKey,
  });

  const keys = (): string[] => latest.map(item => item.itemKey);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PinnedItemsService,
        {provide: ConfigService, useValue: {config: {valtimoApi: {endpointUri: '/api/'}}}},
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(PinnedItemsService);
    httpMock = TestBed.inject(HttpTestingController);

    service.pinnedItems$.subscribe(items => (latest = items));
    httpMock.expectOne({method: 'GET', url: ENDPOINT}).flush([pinned('a', 0), pinned('b', 1)]);
  });

  afterEach(() => httpMock.verify());

  it('applies a pin before the backend answers', () => {
    service.togglePinnedItem(TYPE, 'c');

    expect(keys()).toEqual(['c', 'a', 'b']);

    httpMock.expectOne({method: 'POST', url: ENDPOINT}).flush(null);
    httpMock.expectOne({method: 'GET', url: ENDPOINT}).flush([]);
  });

  it('sends the request once, also without a subscriber', () => {
    service.togglePinnedItem(TYPE, 'a');

    const requests = httpMock.match({method: 'DELETE', url: `${ENDPOINT}/${TYPE}/a`});
    expect(requests.length).toBe(1);
    requests[0].flush(null);
    httpMock.expectOne({method: 'GET', url: ENDPOINT}).flush([]);
  });

  it('skips the global error toast', () => {
    service.togglePinnedItem(TYPE, 'c');

    const request = httpMock.expectOne({method: 'POST', url: ENDPOINT});
    expect(request.request.headers.get(InterceptorSkip)).toBe('all');
    request.flush(null);
    httpMock.expectOne({method: 'GET', url: ENDPOINT}).flush([]);
  });

  it('completes and refetches once the backend accepted the change', () => {
    let completed = false;
    service.togglePinnedItem(TYPE, 'c').subscribe({complete: () => (completed = true)});

    httpMock.expectOne({method: 'POST', url: ENDPOINT}).flush(null);
    expect(completed).toBeTrue();

    httpMock
      .expectOne({method: 'GET', url: ENDPOINT})
      .flush([pinned('a', 0), pinned('b', 1), pinned('c', 2)]);
    expect(keys()).toEqual(['a', 'b', 'c']);
  });

  it('rolls back a failed pin and errors', () => {
    let failed = false;
    service.togglePinnedItem(TYPE, 'c').subscribe({error: () => (failed = true)});

    httpMock
      .expectOne({method: 'POST', url: ENDPOINT})
      .flush(null, {status: 500, statusText: 'Internal Server Error'});

    expect(failed).toBeTrue();
    expect(keys()).toEqual(['a', 'b']);
  });

  it('rolls back a failed unpin by restoring the item', () => {
    let failed = false;
    service.togglePinnedItem(TYPE, 'a').subscribe({error: () => (failed = true)});

    expect(keys()).toEqual(['b']);

    httpMock
      .expectOne({method: 'DELETE', url: `${ENDPOINT}/${TYPE}/a`})
      .flush(null, {status: 500, statusText: 'Internal Server Error'});

    expect(failed).toBeTrue();
    expect(latest).toContain(pinned('a', 0));
    expect(keys().length).toBe(2);
  });

  it('keeps a toggle made while a failing call was pending', () => {
    service.togglePinnedItem(TYPE, 'c');
    service.togglePinnedItem(TYPE, 'd');

    const [pinC, pinD] = httpMock.match({method: 'POST', url: ENDPOINT});
    pinC.flush(null, {status: 500, statusText: 'Internal Server Error'});

    expect(keys()).toEqual(['d', 'a', 'b']);

    pinD.flush(null);
    httpMock.expectOne({method: 'GET', url: ENDPOINT}).flush([]);
  });
});
