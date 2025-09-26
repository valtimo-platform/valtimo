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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {BehaviorSubject, Observable, take} from 'rxjs';
import {CandidateUser} from '../models';

@Injectable()
export class DossierBulkAssignService {
  public readonly candidateUsers$ = new BehaviorSubject<CandidateUser[]>([]);

  private _valtimoEndpointUri: string;

  constructor(
    private configService: ConfigService,
    private http: HttpClient
  ) {
    this._valtimoEndpointUri = `${this.configService.config.valtimoApi.endpointUri}v1/document/`;
  }

  public bulkAssign(assigneeId: string, documentIds: string[]): Observable<void> {
    return this.http.post<void>(`${this._valtimoEndpointUri}assign`, {assigneeId, documentIds});
  }

  public loadCandidateUsers(documentIds: string[]): void {
    this.http
      .post<CandidateUser[]>(`${this._valtimoEndpointUri}candidate-user`, {documentIds})
      .pipe(take(1))
      .subscribe({
        next: (candidateUsers: CandidateUser[]) => {
          this.candidateUsers$.next(candidateUsers);
        },
        error: error => {
          console.error(error);
        },
      });
  }
}
