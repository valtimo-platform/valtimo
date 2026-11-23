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
import {HttpErrorResponse} from '@angular/common/http';
import {from, Observable, of} from 'rxjs';
import {catchError, map} from 'rxjs/operators';

const readProblemFromBlobError = (
  error: HttpErrorResponse
): Observable<Record<string, any> | null> => {
  if (!(error?.error instanceof Blob)) return of(null);

  return from(error.error.text()).pipe(
    map(text => {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : null;
    }),
    catchError(() => of(null))
  );
};

export {readProblemFromBlobError};
