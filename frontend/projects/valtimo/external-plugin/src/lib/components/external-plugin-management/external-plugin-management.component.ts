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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, signal} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {ButtonModule, IconModule} from 'carbon-components-angular';
import {BehaviorSubject, Observable, switchMap, tap} from 'rxjs';
import {EXTERNAL_PLUGIN_MANAGEMENT_TEST_IDS} from '../../constants';
import {
  ExternalPluginConfiguration,
  ExternalPluginConfigurationCreateRequest,
  ExternalPluginDefinition,
  ExternalPluginHost,
  ExternalPluginHostCreateRequest,
} from '../../models';
import {ExternalPluginService} from '../../services';
import {ExternalPluginConfigurationModalComponent} from '../external-plugin-configuration-modal/external-plugin-configuration-modal.component';
import {ExternalPluginHostModalComponent} from '../external-plugin-host-modal/external-plugin-host-modal.component';

@Component({
  standalone: true,
  templateUrl: './external-plugin-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    CarbonListModule,
    ButtonModule,
    IconModule,
    ExternalPluginHostModalComponent,
    ExternalPluginConfigurationModalComponent,
  ],
})
export class ExternalPluginManagementComponent {
  public readonly $hostModalOpen = signal<boolean>(false);
  public readonly $configurationModalOpen = signal<boolean>(false);

  public readonly hostFields: Array<ColumnConfig> = [
    {key: 'name', label: 'externalPlugin.host.name', viewType: ViewType.TEXT},
    {key: 'baseUrl', label: 'externalPlugin.host.baseUrl', viewType: ViewType.TEXT},
    {key: 'status', label: 'externalPlugin.host.status', viewType: ViewType.TEXT},
    {key: 'lastHealthCheck', label: 'externalPlugin.host.lastHealthCheck', viewType: ViewType.TEXT},
  ];

  public readonly definitionFields: Array<ColumnConfig> = [
    {key: 'pluginId', label: 'externalPlugin.definition.pluginId', viewType: ViewType.TEXT},
    {key: 'version', label: 'externalPlugin.definition.version', viewType: ViewType.TEXT},
    {key: 'name', label: 'externalPlugin.definition.name', viewType: ViewType.TEXT},
    {key: 'provider', label: 'externalPlugin.definition.provider', viewType: ViewType.TEXT},
    {key: 'status', label: 'externalPlugin.definition.status', viewType: ViewType.TEXT},
  ];

  public readonly configurationFields: Array<ColumnConfig> = [
    {key: 'title', label: 'externalPlugin.configuration.titleField', viewType: ViewType.TEXT},
    {
      key: 'definitionId',
      label: 'externalPlugin.configuration.definitionId',
      viewType: ViewType.TEXT,
    },
    {key: 'createdAt', label: 'externalPlugin.configuration.createdAt', viewType: ViewType.TEXT},
  ];

  protected readonly testIds = EXTERNAL_PLUGIN_MANAGEMENT_TEST_IDS;

  private readonly _refreshHosts$ = new BehaviorSubject<null>(null);
  private readonly _refreshDefinitions$ = new BehaviorSubject<null>(null);
  private readonly _refreshConfigurations$ = new BehaviorSubject<null>(null);

  public readonly $hostsLoading = signal<boolean>(true);
  public readonly $definitionsLoading = signal<boolean>(true);
  public readonly $configurationsLoading = signal<boolean>(true);

  public readonly hosts$: Observable<Array<ExternalPluginHost>> = this._refreshHosts$.pipe(
    tap(() => this.$hostsLoading.set(true)),
    switchMap(() =>
      this.externalPluginService.getHosts().pipe(tap(() => this.$hostsLoading.set(false)))
    )
  );

  public readonly definitions$: Observable<Array<ExternalPluginDefinition>> =
    this._refreshDefinitions$.pipe(
      tap(() => this.$definitionsLoading.set(true)),
      switchMap(() =>
        this.externalPluginService
          .getDefinitions()
          .pipe(tap(() => this.$definitionsLoading.set(false)))
      )
    );

  public readonly configurations$: Observable<Array<ExternalPluginConfiguration>> =
    this._refreshConfigurations$.pipe(
      tap(() => this.$configurationsLoading.set(true)),
      switchMap(() =>
        this.externalPluginService
          .getConfigurations()
          .pipe(tap(() => this.$configurationsLoading.set(false)))
      )
    );

  constructor(private readonly externalPluginService: ExternalPluginService) {}

  public openHostModal(): void {
    this.$hostModalOpen.set(true);
  }

  public closeHostModal(): void {
    this.$hostModalOpen.set(false);
  }

  public submitHost(request: ExternalPluginHostCreateRequest): void {
    this.externalPluginService.createHost(request).subscribe(() => {
      this.$hostModalOpen.set(false);
      this._refreshHosts$.next(null);
    });
  }

  public openConfigurationModal(): void {
    this.$configurationModalOpen.set(true);
  }

  public closeConfigurationModal(): void {
    this.$configurationModalOpen.set(false);
  }

  public submitConfiguration(request: ExternalPluginConfigurationCreateRequest): void {
    this.externalPluginService.createConfiguration(request).subscribe(() => {
      this.$configurationModalOpen.set(false);
      this._refreshConfigurations$.next(null);
    });
  }
}
