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
import {BehaviorSubject, firstValueFrom, of, switchMap, throwError} from 'rxjs';
// Type-only: importing the service for real drags this spec into the library's import cycle
// through the widget constants.
import type {WidgetLayoutService} from '../services/widget-layout.service';
import {catchWidgetDataError} from './widget-data.util';

describe('catchWidgetDataError', () => {
  const UUID = 'widget-uuid';

  let calls: string[];
  let sink: WidgetLayoutService;

  beforeEach(() => {
    calls = [];
    sink = {
      setWidgetDataError: (uuid: string) => calls.push(`error:${uuid}`),
      clearWidgetDataError: (uuid: string) => calls.push(`clear:${uuid}`),
    } as unknown as WidgetLayoutService;
  });

  it('should pass data through and clear any earlier error when the request succeeds', async () => {
    const data = await firstValueFrom(
      of({bsn: '000000000'}).pipe(catchWidgetDataError(sink, () => UUID))
    );

    expect(data).toEqual({bsn: '000000000'});
    expect(calls).toEqual([`clear:${UUID}`]);
  });

  it('should flag the widget and emit null when the request fails', async () => {
    const data = await firstValueFrom(
      throwError(() => new Error('502')).pipe(catchWidgetDataError(sink, () => UUID))
    );

    expect(data).toBeNull();
    expect(calls).toEqual([`error:${UUID}`]);
  });

  it('should clear the error on any later success, not only on a reload', async () => {
    await firstValueFrom(
      throwError(() => new Error('502')).pipe(catchWidgetDataError(sink, () => UUID))
    );
    await firstValueFrom(of({bsn: '000000000'}).pipe(catchWidgetDataError(sink, () => UUID)));

    expect(calls).toEqual([`error:${UUID}`, `clear:${UUID}`]);
  });

  it('should keep the outer stream alive after a failure, so pagination still works', () => {
    const page$ = new BehaviorSubject<number>(1);
    const emitted: unknown[] = [];

    page$
      .pipe(
        switchMap(page =>
          (page === 1 ? throwError(() => new Error('502')) : of({page})).pipe(
            catchWidgetDataError(sink, () => UUID)
          )
        )
      )
      .subscribe(value => emitted.push(value));

    expect(emitted).toEqual([null]);

    page$.next(2);

    expect(emitted).toEqual([null, {page: 2}]);
    expect(calls).toEqual([`error:${UUID}`, `clear:${UUID}`]);
  });

  it('should resolve the uuid on emission, not when the stream is built', async () => {
    let uuid: string;
    const request$ = throwError(() => new Error('502')).pipe(
      catchWidgetDataError(sink, () => uuid)
    );

    uuid = UUID;
    await firstValueFrom(request$);

    expect(calls).toEqual([`error:${UUID}`]);
  });
});
