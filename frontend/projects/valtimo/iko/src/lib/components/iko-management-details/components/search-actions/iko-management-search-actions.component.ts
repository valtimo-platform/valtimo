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

import {CommonModule} from '@angular/common';
import {Component} from '@angular/core';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  ViewType,
} from '@valtimo/components';
import {ButtonModule, IconModule, TabsModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, Observable, switchMap, tap} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {IkoDataRequestResponse} from '../../../../models';
import {IkoManagementApiService} from '../../../../services';
import {IkoManagementSearchActionModalComponent} from './search-action-modal/search-action-modal.component';

@Component({
  standalone: true,
  templateUrl: './iko-management-search-actions.component.html',
  imports: [
    ButtonModule,
    CarbonListModule,
    CommonModule,
    ConfirmationModalModule,
    IconModule,
    IkoManagementSearchActionModalComponent,
    TabsModule,
    TranslateModule,
  ],
})
export class IkoManagementSearchActionsComponent {
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'title',
      label: 'interface.title',
      viewType: ViewType.TEXT,
    },
    {
      key: 'key',
      label: 'interface.key',
      viewType: ViewType.TEXT,
    },
  ];
  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.editSearchAction.bind(this),
    },
    {
      label: 'interface.delete',
      callback: this.deleteSearchAction.bind(this),
      type: 'danger',
    },
  ];

  public readonly deleteSearchActionKey$ = new BehaviorSubject<string | null>(null);
  public readonly prefillData$ = new BehaviorSubject<IkoDataRequestResponse | null>(null);
  public readonly actionModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly deleteModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly aggregateKey$ = this.route.params.pipe(
    map((params: Params) => params.key),
    filter(key => !!key)
  );

  private readonly _refresh$ = new BehaviorSubject<null>(null);
  public readonly searchActions$: Observable<IkoDataRequestResponse[]> = combineLatest([
    this.aggregateKey$,
    this._refresh$,
  ]).pipe(
    switchMap(([key]) => this.ikoManagementApiService.getManagementIkoDataRequests(key)),
    tap(() => this.loading$.next(false))
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly ikoManagementApiService: IkoManagementApiService
  ) {}

  public onSearchActionClick(action: IkoDataRequestResponse): void {
    this.router.navigate([`${action.key}`], {relativeTo: this.route});
  }

  public deleteSearchAction(action: IkoDataRequestResponse): void {
    this.deleteSearchActionKey$.next(action.key);
    this.deleteModalOpen$.next(true);
  }

  public onDeleteSearchAction(key: string): void {
    this.aggregateKey$
      .pipe(
        switchMap((aggregateKey: string) =>
          this.ikoManagementApiService.deleteIkoDataRequest(aggregateKey, key)
        )
      )
      .subscribe(() => this._refresh$.next(null));
  }

  public editSearchAction(action: IkoDataRequestResponse): void {
    this.prefillData$.next(action);
    this.actionModalOpen$.next(true);
  }

  public onItemsReordered(searchActions: IkoDataRequestResponse[], aggregateKey: string): void {
    this.ikoManagementApiService
      .updateIkoDataRequests(aggregateKey, searchActions)
      .pipe(take(1))
      .subscribe();
  }

  public onModalClose(action: IkoDataRequestResponse | null): void {
    this.actionModalOpen$.next(false);
    const prefillData: IkoDataRequestResponse | null = this.prefillData$.getValue();
    this.prefillData$.next(null);

    if (!action) return;
    this.aggregateKey$
      .pipe(
        switchMap((aggregateKey: string) =>
          prefillData === null
            ? this.ikoManagementApiService.createIkoDataRequest(aggregateKey, action.key, {
                ...action,
                properties: {},
              })
            : this.ikoManagementApiService.updateIkoDataRequest(aggregateKey, action.key, action)
        )
      )
      .subscribe(() => {
        this._refresh$.next(null);
      });
  }

  public openAddModal(): void {
    this.actionModalOpen$.next(true);
  }
}
