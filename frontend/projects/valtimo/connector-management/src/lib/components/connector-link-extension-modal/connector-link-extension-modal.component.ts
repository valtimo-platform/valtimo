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

import {AfterViewInit, Component, OnDestroy, ViewChild} from '@angular/core';
import {AlertService, ModalComponent, Pagination} from '@valtimo/components';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {map, switchMap, take, tap} from 'rxjs/operators';
import {ConnectorInstance} from '@valtimo/config';
import {TranslateService} from '@ngx-translate/core';
import {ActivatedRoute} from '@angular/router';
import {ConnectorManagementService} from '../../services/connector-management/connector-management.service';
import {ConnectorManagementStateService} from '../../services/connector-management-state/connector-management-state.service';
import {ObjectApiSyncService} from '../../services/object-api-sync/object-api-sync.service';

/**
 * @deprecated Use the new plugin framework
 */
@Component({
  selector: 'valtimo-connector-link-extension-modal',
  templateUrl: './connector-link-extension-modal.component.html',
  styleUrls: ['./connector-link-extension-modal.component.scss'],
})
export class ConnectorLinkExtensionModalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('modal') modal: ModalComponent;

  private showSubscription!: Subscription;

  readonly loading$ = new BehaviorSubject<boolean>(true);

  readonly fields$ = new BehaviorSubject<Array<{key: string; label: string}>>([]);

  readonly currentPageAndSize$ = new BehaviorSubject<Partial<Pagination>>({
    page: 0,
    size: 10,
  });

  readonly pageSizes$ = new BehaviorSubject<Partial<Pagination>>({
    collectionSize: 0,
  });

  readonly pagination$: Observable<Pagination> = combineLatest([
    this.currentPageAndSize$,
    this.pageSizes$,
  ]).pipe(
    map(
      ([currentPage, sizes]) =>
        ({...currentPage, ...sizes, page: currentPage.page + 1}) as Pagination
    )
  );

  readonly connectorInstances$: Observable<Array<ConnectorInstance>> = combineLatest([
    this.currentPageAndSize$,
    this.connectorManagementService.getConnectorTypes(),
    this.translateService.stream('key'),
    this.stateService.refresh$,
  ]).pipe(
    tap(() => this.setFields()),
    switchMap(([currentPage, types]) =>
      this.connectorManagementService.getConnectorInstancesByType(
        types.find(type => type.name.toLowerCase().includes('objectsapi'))?.id,
        {page: currentPage.page, size: currentPage.size}
      )
    ),
    tap(instanceRes => {
      this.pageSizes$.pipe(take(1)).subscribe(sizes => {
        this.pageSizes$.next({...sizes, collectionSize: instanceRes.totalElements});
      });
    }),
    map(res => res.content),
    tap(() => this.loading$.next(false))
  );

  readonly noObjectsApiConnectors$ = this.connectorInstances$.pipe(
    map(instances => !instances || instances.length === 0)
  );

  readonly disabled$!: Observable<boolean>;

  constructor(
    private readonly connectorManagementService: ConnectorManagementService,
    private readonly translateService: TranslateService,
    private readonly stateService: ConnectorManagementStateService,
    private readonly objectApiSyncService: ObjectApiSyncService,
    private readonly route: ActivatedRoute,
    private readonly alertService: AlertService
  ) {
    this.disabled$ = this.stateService.inputDisabled$;
  }

  ngAfterViewInit(): void {
    this.showSubscription = this.stateService.showExtensionModal$.subscribe(show => {
      if (show) {
        this.show();
      } else {
        this.hide();
      }
    });
  }

  ngOnDestroy(): void {
    this.showSubscription?.unsubscribe();
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
    const connectorInstanceId = instance.id;
    const enabled = true;
    const documentDefinitionName = this.route.snapshot.paramMap.get('name');
    const objectTypeUrl = (instance as any).properties?.objectType?.url;
    const splitObjectTypeUrl = objectTypeUrl?.split('/');
    const objectTypeId = splitObjectTypeUrl[splitObjectTypeUrl.length - 1];

    this.stateService.disableInput();

    this.objectApiSyncService
      .createObjectSyncConfig({connectorInstanceId, enabled, documentDefinitionName, objectTypeId})
      .subscribe(
        res => {
          this.alertService.success(
            this.translateService.instant('connectorManagement.extension.addSyncSuccess')
          );
          this.stateService.hideExtensionModal();
          this.stateService.enableInput();
          this.stateService.refresh();
          this.stateService.setLastConfigIdAdded(res.objectSyncConfig.id);
        },
        () => {
          this.stateService.enableInput();
        }
      );
  }

  private setFields(): void {
    const getTranslatedLabel = (key: string) =>
      this.translateService.instant(`connectorManagement.labels.${key}`);
    const keys: Array<string> = ['name'];
    this.fields$.next(keys.map(key => ({label: getTranslatedLabel(key), key})));
  }

  private show(): void {
    this.modal.show();
  }

  private hide(): void {
    this.modal.hide();
  }
}
