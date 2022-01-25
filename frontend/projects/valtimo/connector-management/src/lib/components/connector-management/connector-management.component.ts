/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {Component, OnDestroy} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {ConnectorInstance, Pagination, ConnectorModal} from '@valtimo/contract';
import {map, switchMap, take, tap} from 'rxjs/operators';
import {TranslateService} from '@ngx-translate/core';
import {ConnectorManagementService} from '../../services/connector-management/connector-management.service';
import {ConnectorManagementStateService} from '../../services/connector-management-state/connector-management-state.service';

@Component({
  selector: 'valtimo-connector-management',
  templateUrl: './connector-management.component.html',
  styleUrls: ['./connector-management.component.scss'],
})
export class ConnectorManagementComponent implements OnDestroy {
  readonly loading$ = new BehaviorSubject<boolean>(true);

  readonly fields$ = new BehaviorSubject<Array<{key: string; label: string}>>([]);

  readonly currentPageAndSize$ = new BehaviorSubject<Partial<Pagination>>({
    page: 0,
    size: 10,
  });

  readonly pageSizes$ = new BehaviorSubject<Partial<Pagination>>({
    collectionSize: 0,
    maxPaginationItemSize: 5,
  });

  readonly pagination$: Observable<Pagination> = combineLatest([
    this.currentPageAndSize$,
    this.pageSizes$,
  ]).pipe(
    map(
      ([currentPage, sizes]) =>
        ({...currentPage, ...sizes, page: currentPage.page + 1} as Pagination)
    )
  );

  readonly connectorInstances$: Observable<Array<ConnectorInstance>> = combineLatest([
    this.currentPageAndSize$,
    this.translateService.stream('key'),
    this.stateService.refresh$,
  ]).pipe(
    tap(() => this.setFields()),
    switchMap(([currentPage]) =>
      combineLatest([
        this.connectorManagementService.getConnectorInstances({
          page: currentPage.page,
          size: currentPage.size,
        }),
        this.connectorManagementService.getConnectorTypes(),
      ])
    ),
    tap(([instanceRes]) => {
      this.pageSizes$.pipe(take(1)).subscribe(sizes => {
        this.pageSizes$.next({...sizes, collectionSize: instanceRes.totalElements});
      });
    }),
    map(([instanceRes, typesRes]) =>
      instanceRes.content.map(instance => {
        return {...instance, typeName: typesRes.find(type => type.id === instance.type.id)?.name};
      })
    ),
    tap(() => this.loading$.next(false))
  );

  readonly modalType$ = new BehaviorSubject<ConnectorModal>('add');

  constructor(
    private readonly connectorManagementService: ConnectorManagementService,
    private readonly translateService: TranslateService,
    private readonly stateService: ConnectorManagementStateService
  ) {}

  ngOnDestroy(): void {
    this.stateService.hideModal();
  }

  paginationClicked(newPageNumber): void {
    this.currentPageAndSize$.pipe(take(1)).subscribe(currentPage => {
      this.currentPageAndSize$.next({...currentPage, page: newPageNumber - 1});
    });
  }

  paginationSet(newPageSize): void {
    if (newPageSize) {
      this.currentPageAndSize$.pipe(take(1)).subscribe(currentPage => {
        this.currentPageAndSize$.next({...currentPage, size: newPageSize});
      });
    }
  }

  rowClicked(instance: ConnectorInstance): void {
    this.modalType$.next('modify');
    this.stateService.setConnectorInstance(instance);
    this.stateService.showModal();
  }

  showAddModal(): void {
    this.modalType$.next('add');
    this.stateService.showModal();
  }

  private setFields(): void {
    const getTranslatedLabel = (key: string) =>
      this.translateService.instant(`connectorManagement.labels.${key}`);
    const keys: Array<string> = ['name', 'typeName'];
    this.fields$.next(keys.map(key => ({label: getTranslatedLabel(key), key})));
  }
}
