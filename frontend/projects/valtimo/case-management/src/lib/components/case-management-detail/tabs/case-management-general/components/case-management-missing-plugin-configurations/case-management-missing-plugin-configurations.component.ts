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

import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ArrowRight16, Save16, WarningAltFilled16} from '@carbon/icons';
import {SelectModule} from '@valtimo/components';
import {
  ButtonModule,
  IconModule,
  IconService,
  LayerModule,
  NotificationModule,
} from 'carbon-components-angular';
import {
  PluginConfiguration,
  PluginManagementService,
  PluginTranslationService,
} from '@valtimo/plugin';
import {
  CaseManagementParams,
  ConfigurationIssueService,
  getCaseManagementRouteParams,
  GlobalNotificationService,
} from '@valtimo/shared';
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, take} from 'rxjs';
import {CaseManagementService} from '../../../../../../services';
import {
  DanglingPluginConfiguration,
  MappingRow,
  PluginMappingStatus,
} from '../../../../../../models/case-deployment.model';

@Component({
  selector: 'valtimo-case-management-missing-plugin-configurations',
  templateUrl: './case-management-missing-plugin-configurations.component.html',
  styleUrls: ['./case-management-missing-plugin-configurations.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    LayerModule,
    NotificationModule,
    SelectModule,
  ],
})
export class CaseManagementMissingPluginConfigurationsComponent implements OnInit {
  public readonly hasIssue$ = this.configurationIssueService.hasIssue$('plugin-process-link');
  public readonly mappingRows$ = new BehaviorSubject<MappingRow[]>([]);
  public readonly visibleRows$ = combineLatest([this.hasIssue$, this.mappingRows$]).pipe(
    map(([hasIssue, rows]) => (hasIssue && rows?.length ? rows : null))
  );
  public readonly saving$ = new BehaviorSubject<boolean>(false);
  private readonly _selections = new Map<number, string | null>();
  private readonly destroyRef = inject(DestroyRef);

  private _caseDefinitionKey: string;
  private _caseDefinitionVersionTag: string;

  private readonly _params$: Observable<CaseManagementParams | undefined> =
    getCaseManagementRouteParams(this.route);

  constructor(
    private readonly caseManagementService: CaseManagementService,
    private readonly configurationIssueService: ConfigurationIssueService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly iconService: IconService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([WarningAltFilled16, Save16, ArrowRight16]);
  }

  public ngOnInit(): void {
    this._params$
      .pipe(
        filter(
          (params): params is CaseManagementParams =>
            !!params?.caseDefinitionKey && !!params?.caseDefinitionVersionTag
        ),
        switchMap(params => {
          this._caseDefinitionKey = params.caseDefinitionKey;
          this._caseDefinitionVersionTag = params.caseDefinitionVersionTag;
          return this.caseManagementService.getDanglingPluginConfigurations(
            this._caseDefinitionKey,
            this._caseDefinitionVersionTag
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(dangling => this.loadMappingRows(dangling));
  }

  public onMappingChange(index: number, selectedId: string | number): void {
    this._selections.set(index, selectedId ? String(selectedId) : null);
  }

  public save(): void {
    const mappings: Record<string, string> = {};
    const rows = this.mappingRows$.value;
    for (let i = 0; i < rows.length; i++) {
      const selectedId = this._selections.get(i);
      if (selectedId) {
        for (const sourceId of rows[i].sourcePluginConfigurationIds) {
          mappings[sourceId] = selectedId;
        }
      }
    }

    if (Object.keys(mappings).length === 0) return;

    this.saving$.next(true);
    this.caseManagementService
      .resolvePluginConfigurationMappings(
        this._caseDefinitionKey,
        this._caseDefinitionVersionTag,
        mappings
      )
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving$.next(false);
          this.globalNotificationService.showToast({
            title: this.translateService.instant(
              'caseManagement.missingPluginConfigurations.saveSuccess'
            ),
            type: 'success',
          });
          this.caseManagementService
            .getDanglingPluginConfigurations(
              this._caseDefinitionKey,
              this._caseDefinitionVersionTag
            )
            .pipe(take(1))
            .subscribe(dangling => this.loadMappingRows(dangling));
        },
        error: () => {
          this.saving$.next(false);
          this.globalNotificationService.showToast({
            title: this.translateService.instant(
              'caseManagement.missingPluginConfigurations.saveError'
            ),
            type: 'error',
          });
        },
      });
  }

  private loadMappingRows(dangling: DanglingPluginConfiguration[]): void {
    if (dangling.length === 0) {
      this.mappingRows$.next([]);
      return;
    }

    this.pluginManagementService
      .getPluginDefinitions()
      .pipe(take(1))
      .subscribe(definitions => {
        const installedKeys = new Set(definitions.map(d => d.key));
        this.loadPluginConfigurations(dangling, installedKeys);
      });
  }

  private loadPluginConfigurations(
    dangling: DanglingPluginConfiguration[],
    installedKeys: Set<string>
  ): void {
    const uniqueKeys = [...new Set(dangling.map(d => d.pluginDefinitionKey).filter(Boolean))];
    const installableKeys = uniqueKeys.filter(k => installedKeys.has(k));
    const configsByKey = new Map<string, PluginConfiguration[]>();
    let remaining = installableKeys.length;

    if (remaining === 0) {
      this.buildRows(dangling, configsByKey, installedKeys);
      return;
    }

    for (const key of installableKeys) {
      this.pluginManagementService
        .getPluginConfigurationsByPluginDefinitionKey(key)
        .pipe(take(1))
        .subscribe({
          next: configs => {
            configsByKey.set(key, configs);
            remaining--;
            if (remaining === 0) this.buildRows(dangling, configsByKey, installedKeys);
          },
          error: () => {
            configsByKey.set(key, []);
            remaining--;
            if (remaining === 0) this.buildRows(dangling, configsByKey, installedKeys);
          },
        });
    }
  }

  private buildRows(
    dangling: DanglingPluginConfiguration[],
    configsByKey: Map<string, PluginConfiguration[]>,
    installedKeys: Set<string>
  ): void {
    this._selections.clear();
    this.mappingRows$.next(
      dangling.map(d => {
        const key = d.pluginDefinitionKey;
        const isInstalled = key ? installedKeys.has(key) : false;
        const available = configsByKey.get(key) || [];

        let status: PluginMappingStatus;
        if (!isInstalled) {
          status = 'not-installed';
        } else if (available.length === 0) {
          status = 'no-configurations';
        } else {
          status = 'available';
        }

        return {
          pluginDefinitionKey: key,
          pluginDefinitionTitle: this.getPluginTitle(key),
          sourcePluginConfigurationIds: d.sourcePluginConfigurationIds,
          selectItems: available.map(c => ({id: c.id, text: c.title})),
          status,
        };
      })
    );
  }

  private getPluginTitle(pluginDefinitionKey: string | null): string {
    if (!pluginDefinitionKey) {
      return this.translateService.instant(
        'caseManagement.missingPluginConfigurations.unknownPlugin'
      );
    }
    const translated = this.pluginTranslationService.instant('title', pluginDefinitionKey);
    if (translated === `${pluginDefinitionKey}.title`) {
      return pluginDefinitionKey;
    }
    return translated;
  }
}
