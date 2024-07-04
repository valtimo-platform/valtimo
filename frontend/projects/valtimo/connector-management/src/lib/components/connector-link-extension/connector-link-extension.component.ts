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

import {Component, OnDestroy} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable, of} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import {TranslateService} from '@ngx-translate/core';
import {ActivatedRoute} from '@angular/router';
import {AlertService} from '@valtimo/components';
import {ObjectSyncConfig} from '../../models';
import {ConnectorManagementStateService} from '../../services/connector-management-state/connector-management-state.service';
import {ObjectApiSyncService} from '../../services/object-api-sync/object-api-sync.service';
import {ConnectorManagementService} from '../../services/connector-management/connector-management.service';
import {ConnectorInstance} from '@valtimo/config';

/**
 * @deprecated Use the new plugin framework
 */
@Component({
  selector: 'valtimo-connector-link-extension',
  templateUrl: './connector-link-extension.component.html',
  styleUrls: ['./connector-link-extension.component.scss'],
})
export class ConnectorLinkExtensionComponent implements OnDestroy {
  readonly loading$ = new BehaviorSubject<boolean>(true);

  readonly objectApiSyncConfig$: Observable<ObjectSyncConfig | null> = combineLatest([
    this.route.params,
    this.translateService.stream('key'),
    this.stateService.refresh$,
  ]).pipe(
    switchMap(([params]) => this.objectApiSyncService.getObjectSyncConfigs(params.name)),
    switchMap(configs =>
      combineLatest([
        of(configs),
        ...configs.map(config =>
          this.connectorManagementService
            .getConnectorInstanceById(config.connectorInstanceId)
            .pipe(catchError(() => of('')))
        ),
      ])
    ),
    map(results => {
      const [, ...instances] = results.filter(result => result) as Array<ConnectorInstance>;
      return (results[0] as Array<ObjectSyncConfig>).map(syncConfig => ({
        ...syncConfig,
        title:
          instances.find(instance => instance.id === syncConfig.connectorInstanceId)?.name ||
          'Objects API',
      }));
    }),
    map(results => (Array.isArray(results) && results.length > 0 ? results[0] : null)),
    tap(() => {
      this.loading$.next(false);
    })
  );

  readonly disabled$!: Observable<boolean>;

  constructor(
    private readonly stateService: ConnectorManagementStateService,
    private readonly objectApiSyncService: ObjectApiSyncService,
    private readonly translateService: TranslateService,
    private readonly route: ActivatedRoute,
    private readonly alertService: AlertService,
    private readonly connectorManagementService: ConnectorManagementService
  ) {
    this.disabled$ = this.stateService.inputDisabled$;
  }

  ngOnDestroy(): void {
    this.stateService.hideExtensionModal();
  }

  openModal(): void {
    this.stateService.showExtensionModal();
  }

  toggleSync(config: ObjectSyncConfig): void {
    this.stateService.disableInput();

    this.objectApiSyncService
      .modifyObjectSyncConfig({...config, enabled: !config.enabled})
      .subscribe(
        () => {
          if (!config.enabled) {
            this.alertService.success(
              this.translateService.instant('connectorManagement.extension.addSyncSuccess')
            );
          } else {
            this.alertService.success(
              this.translateService.instant('connectorManagement.extension.disableSyncSuccess')
            );
          }
          this.stateService.enableInput();
          this.stateService.refresh();
        },
        () => {
          this.stateService.enableInput();
        }
      );
  }

  deleteSync(configId: string): void {
    this.stateService.disableInput();

    this.objectApiSyncService.deleteObjectSyncConfig(configId).subscribe(
      () => {
        this.alertService.success(
          this.translateService.instant('connectorManagement.extension.deleteSyncSuccess')
        );
        this.stateService.enableInput();
        this.stateService.refresh();
      },
      () => {
        this.stateService.enableInput();
      }
    );
  }
}
