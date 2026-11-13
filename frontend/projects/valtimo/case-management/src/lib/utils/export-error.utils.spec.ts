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
import {firstValueFrom} from 'rxjs';
import {readProblemFromBlobError} from './export-error.utils';

describe('export error utils', () => {
  const errorWith = (body: unknown): HttpErrorResponse =>
    new HttpErrorResponse({status: 409, error: body});

  it('parses a problem json blob', async () => {
    const problem = {title: 'Form definition is missing', activityId: 'a'};
    const blob = new Blob([JSON.stringify(problem)], {type: 'application/problem+json'});

    expect(await firstValueFrom(readProblemFromBlobError(errorWith(blob)))).toEqual(problem);
  });

  it('returns null for a non-json blob', async () => {
    expect(await firstValueFrom(readProblemFromBlobError(errorWith(new Blob(['nope']))))).toBeNull();
  });

  it('returns null when the body is not a blob', async () => {
    expect(await firstValueFrom(readProblemFromBlobError(errorWith({a: 1})))).toBeNull();
  });
});
