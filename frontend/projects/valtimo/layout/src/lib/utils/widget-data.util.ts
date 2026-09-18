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

import {catchError, Observable, of, OperatorFunction, tap} from 'rxjs';
// Type-only: the library already has an import cycle through the widget constants, and pulling
// the service in at runtime would drag this util into it.
import type {WidgetLayoutService} from '../services/widget-layout.service';

/**
 * Turns a failed widget data request into an error state on the widget block, so a widget that
 * could not reach its source is not shown as an empty widget. Any request that then succeeds
 * clears that state again, whatever triggered it.
 *
 * Apply this to the data request itself, not to the stream it is switch-mapped from, so the
 * widget keeps responding to pagination and reloads after a failure.
 *
 * @param widgetLayoutService the layout service of the widget container
 * @param getWidgetUuid resolves the widget uuid on emission — the uuid input is not set yet when
 * the data stream is constructed
 */
function catchWidgetDataError<T>(
  widgetLayoutService: WidgetLayoutService,
  getWidgetUuid: () => string
): OperatorFunction<T, T | null> {
  return (source: Observable<T>) =>
    source.pipe(
      tap(() => widgetLayoutService.clearWidgetDataError(getWidgetUuid())),
      catchError(() => {
        widgetLayoutService.setWidgetDataError(getWidgetUuid());
        return of(null);
      })
    );
}

export {catchWidgetDataError};
