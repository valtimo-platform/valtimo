/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {ConfigService} from '@valtimo/shared';
import {BehaviorSubject, forkJoin, Observable, take} from 'rxjs';
import {CandidateUser} from '../models';
import {CAN_ASSIGN_CASE_PERMISSION, CASE_DETAIL_PERMISSION_RESOURCE} from '../permissions';
import {PermissionService} from '@valtimo/access-control';

@Injectable()
export class CaseBulkAssignService {
  public readonly candidateUsers$ = new BehaviorSubject<CandidateUser[]>([]);
  public readonly canAssignAllDocuments$ = new BehaviorSubject<boolean>(true);
  public readonly canAssignAnyDocuments$ = new BehaviorSubject<boolean>(true);

  private _valtimoEndpointUri: string;

  constructor(
    private configService: ConfigService,
    private http: HttpClient,
    private permissionService: PermissionService
  ) {
    this._valtimoEndpointUri = `${this.configService.config.valtimoApi.endpointUri}v1/document/`;
  }

  public bulkAssign(assigneeId: string, documentIds: string[]): Observable<void> {
    return this.http.post<void>(`${this._valtimoEndpointUri}assign`, {assigneeId, documentIds});
  }

  public loadCandidateUsers(documentIds: string[]): void {
    forkJoin(
      documentIds.map(documentId =>
        this.permissionService
          .requestPermission(CAN_ASSIGN_CASE_PERMISSION, {
            resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
            identifier: documentId,
          })
          .pipe(take(1))
      )
    )
      .pipe(take(1))
      .subscribe({
        next: permissions => {
          const canAssignAll = permissions.every(p => p);
          const canAssignAny = permissions.some(p => p);

          this.canAssignAllDocuments$.next(canAssignAll);
          this.canAssignAnyDocuments$.next(canAssignAny);

          if (canAssignAny) {
            const permittedDocumentIds = documentIds.filter((_, index) => permissions[index]);

            this.http
              .post<CandidateUser[]>(`${this._valtimoEndpointUri}candidate-user`, {
                documentIds: permittedDocumentIds,
              })
              .pipe(take(1))
              .subscribe({
                next: (candidateUsers: CandidateUser[]) => {
                  this.candidateUsers$.next(candidateUsers);
                },
                error: error => {
                  this.candidateUsers$.next([]);
                  this.canAssignAllDocuments$.next(false);
                  this.canAssignAnyDocuments$.next(false);
                  console.error(error);
                },
              });
          } else {
            this.candidateUsers$.next([]);
          }
        },
        error: () => {
          this.candidateUsers$.next([]);
          this.canAssignAllDocuments$.next(false);
          this.canAssignAnyDocuments$.next(false);
        },
      });
  }
}
