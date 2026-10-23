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

import {Injectable} from '@angular/core';
import {PinnedItemsService, PinnedItemType} from '@valtimo/case';
import {BehaviorSubject, map, Observable, tap, throwError} from 'rxjs';
import {CaseDefinitionGroupManagementService} from '../../services';
import {
  CaseDefinitionGroupUpdateRequest,
  CaseDefinitionGroupWithMembersResponse,
} from '../../models';

@Injectable()
export class CaseDefinitionGroupDetailService {
  private readonly _group$ = new BehaviorSubject<CaseDefinitionGroupWithMembersResponse | null>(
    null
  );
  public readonly group$ = this._group$.asObservable();

  public get currentGroup(): CaseDefinitionGroupWithMembersResponse | null {
    return this._group$.value;
  }

  constructor(
    private readonly groupManagementService: CaseDefinitionGroupManagementService,
    private readonly pinnedItemsService: PinnedItemsService
  ) {}

  public loadGroup(groupKey: string): void {
    if (this._group$.value?.key !== groupKey) this._group$.next(null);

    this.groupManagementService.getGroup(groupKey).subscribe(group => this._group$.next(group));
  }

  public reloadGroup(): void {
    const groupKey = this._group$.value?.key;
    if (!groupKey) return;

    this.loadGroup(groupKey);
  }

  public updateGroup(
    request: CaseDefinitionGroupUpdateRequest
  ): Observable<CaseDefinitionGroupWithMembersResponse | null> {
    const current = this._group$.value;
    if (!current) {
      return throwError(() => new Error('Case definition group is not loaded'));
    }

    return this.groupManagementService.updateGroup(current.key, request).pipe(
      tap(response => {
        const latest = this._group$.value ?? current;
        this._group$.next({
          ...latest,
          title: response.title,
          description: response.description,
          color: response.color,
          order: response.order,
        });

        if (this.pinnedItemsService.isPinned(PinnedItemType.CASE_DEFINITION_GROUP, current.key)) {
          this.pinnedItemsService.refresh();
        }
      }),
      map(() => this._group$.value)
    );
  }
}
