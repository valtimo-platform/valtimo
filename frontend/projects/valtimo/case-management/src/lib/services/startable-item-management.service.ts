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
import {NGXLogger} from 'ngx-logger';
import {CaseManagementParams, CaseProcessDefinitionResponseDto} from '@valtimo/shared';
import {runAfterCarbonModalClosed} from '@valtimo/components';
import {BehaviorSubject, Observable, of, Subject} from 'rxjs';
import {catchError, filter, map, switchMap, take} from 'rxjs/operators';
import {
  BuildingBlockItemProperties,
  CreateStartableItemRequest,
  ManagementStartableItem,
  StartableItemOrderEntry,
  StartableItemType,
  UpdateStartableItemOrderRequest,
} from '../models';
import {StartableItemApiService} from './startable-item-api.service';

@Injectable()
export class StartableItemManagementService {
  private readonly _params$ = new BehaviorSubject<CaseManagementParams | null>(null);

  private readonly _items$ = new BehaviorSubject<ManagementStartableItem[]>([]);
  public readonly items$ = this._items$.asObservable();

  private readonly _loading$ = new BehaviorSubject<boolean>(false);
  public readonly loading$ = this._loading$.asObservable();

  private readonly _showModal$ = new BehaviorSubject<boolean>(false);
  public readonly showModal$ = this._showModal$.asObservable();

  private readonly _editingItem$ = new BehaviorSubject<ManagementStartableItem | null>(null);
  public readonly editingItem$ = this._editingItem$.asObservable();

  private readonly _showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteModal$ = this._showDeleteModal$.asObservable();

  private readonly _itemToDelete$ = new BehaviorSubject<ManagementStartableItem | null>(null);
  public readonly itemToDelete$ = this._itemToDelete$.asObservable();

  private readonly _reorderComplete$ = new Subject<void>();
  public readonly reorderComplete$ = this._reorderComplete$.asObservable();

  public readonly usedProcessDefinitionIds$: Observable<string[]> = this._items$.pipe(
    map(items =>
      items
        .filter(item => item.type === StartableItemType.PROCESS && !!item.processDefinitionId)
        .map(item => item.processDefinitionId!)
    )
  );

  public readonly usedBuildingBlockKeys$: Observable<string[]> = this._items$.pipe(
    map(items =>
      items.filter(item => item.type === StartableItemType.BUILDING_BLOCK).map(item => item.key)
    )
  );

  public readonly linkedProcessDefinitions$: Observable<CaseProcessDefinitionResponseDto[]> =
    this._params$.pipe(
      filter((params): params is CaseManagementParams => params !== null),
      switchMap(params =>
        this.startableItemApiService.getLinkedProcessDefinitions(params)
      )
    );

  constructor(
    private readonly startableItemApiService: StartableItemApiService,
    private readonly logger: NGXLogger
  ) {}

  public setParams(params: CaseManagementParams): void {
    this._params$.next(params);
  }

  public getParams(): CaseManagementParams {
    const params = this._params$.value;
    if (!params) {
      this.logger.error('Params not initialized. Call setParams() first.');
    }
    return params!;
  }

  public loadItems(): void {
    this._loading$.next(true);
    this.startableItemApiService
      .getItems(this.getParams())
      .pipe(take(1))
      .subscribe({
        next: (items: ManagementStartableItem[]) => {
          this._items$.next(items);
          this._loading$.next(false);
        },
        error: error => {
          console.error(error);
          this._loading$.next(false);
        },
      });
  }

  public showCreateModal(): void {
    this._editingItem$.next(null);
    this._showModal$.next(true);
  }

  public showEditModal(item: ManagementStartableItem): void {
    this._editingItem$.next(item);
    this._showModal$.next(true);
  }

  public hideModal(): void {
    this._showModal$.next(false);
    runAfterCarbonModalClosed(() => this._editingItem$.next(null));
  }

  public showDeleteConfirmation(item: ManagementStartableItem): void {
    this._itemToDelete$.next(item);
    this._showDeleteModal$.next(true);
  }

  public hideDeleteModal(): void {
    this._showDeleteModal$.next(false);
    this._itemToDelete$.next(null);
  }

  public createItem(request: CreateStartableItemRequest): Observable<ManagementStartableItem> {
    return this.startableItemApiService.createItem(this.getParams(), request);
  }

  public updateItem(
    key: string,
    versionTag: string | null,
    request: CreateStartableItemRequest
  ): Observable<ManagementStartableItem> {
    return this.startableItemApiService.updateItem(
      this.getParams(),
      key,
      versionTag,
      request
    );
  }

  public getItemProperties(
    itemKey: string,
    versionTag: string | null,
    type: StartableItemType
  ): Observable<BuildingBlockItemProperties> {
    return this.startableItemApiService.getItemProperties(
      this.getParams(),
      itemKey,
      versionTag,
      type
    );
  }

  public deleteItem(item: ManagementStartableItem): Observable<void> {
    return this.startableItemApiService.deleteItem(
      this.getParams(),
      item.key,
      item.versionTag
    );
  }

  public updateOrder(items: ManagementStartableItem[]): void {
    this._items$.next(items);

    const request: UpdateStartableItemOrderRequest = {
      items: items.map(
        (item, index): StartableItemOrderEntry => ({
          key: item.key,
          type: item.type,
          versionTag: item.versionTag,
          sortOrder: index,
        })
      ),
    };

    this.startableItemApiService
      .updateOrder(this.getParams(), request)
      .pipe(
        take(1),
        catchError(() => {
          this.loadItems();
          return of([]);
        })
      )
      .subscribe({
        next: (updatedItems: ManagementStartableItem[]) => {
          if (updatedItems.length) {
            this._items$.next(updatedItems);
          }
          this._reorderComplete$.next();
        },
      });
  }
}
