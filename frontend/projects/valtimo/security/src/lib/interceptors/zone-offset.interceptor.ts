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

import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import moment from 'moment';

@Injectable()
export class ZoneOffsetInterceptor implements HttpInterceptor {
  public intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const modifiedReq = req.clone({
      headers: req.headers.set('X-Timezone-Offset', this.getFormattedZoneOffset()),
    });
    return next.handle(modifiedReq);
  }

  private getFormattedZoneOffset(): string {
    let offset = new Date().getTimezoneOffset();
    let isNegative = false;

    if (offset < 0) {
      isNegative = true;
      offset = offset * -1;
    }

    const duration = moment.duration(offset, 'minutes');
    const momentOffset = moment.utc(duration.asMilliseconds()).format('HH:mm');

    return `${isNegative ? '+' : '-'}${momentOffset}`;
  }
}
