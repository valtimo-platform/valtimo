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
import {ArrowRight16, Save16} from '@carbon/icons';
import {SelectItem, SelectModule} from '@valtimo/components';
import {
  ButtonModule,
  IconModule,
  IconService,
  LayerModule,
  NotificationModule,
} from 'carbon-components-angular';
import {
  ExternalPluginConfiguration,
  ExternalPluginDefinition,
  ExternalPluginService,
  getExternalPluginDisplayName,
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
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  filter,
  forkJoin,
  map,
  Observable,
  of,
  switchMap,
  take,
} from 'rxjs';
import {CaseManagementService} from '../../../../../../services';
import {
  DanglingPluginConfiguration,
  MappingRow,
  PluginConfigurationPreviewSource,
  PluginMappingStatus,
} from '../../../../../../models/case-deployment.model';

const EMBEDDED_ISSUE_TYPE = 'plugin-process-link';
const EXTERNAL_ISSUE_TYPE = 'external-plugin-process-link';
const EXTERNAL_TASK_FORM_ISSUE_TYPE = 'external-plugin-task-form';
const EXTERNAL_CASE_TAB_ISSUE_TYPE = 'external-plugin-case-tab';

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
  public readonly hasIssue$ = this.configurationIssueService.hasAnyOfIssues$([
    EMBEDDED_ISSUE_TYPE,
    EXTERNAL_ISSUE_TYPE,
    EXTERNAL_TASK_FORM_ISSUE_TYPE,
    EXTERNAL_CASE_TAB_ISSUE_TYPE,
  ]);
  public readonly mappingRows$ = new BehaviorSubject<MappingRow[]>([]);
  public readonly hasUnknownPluginConfigurations$ = new BehaviorSubject<boolean>(false);
  public readonly visible$ = combineLatest([
    this.hasIssue$,
    this.mappingRows$,
    this.hasUnknownPluginConfigurations$,
  ]).pipe(map(([hasIssue, rows, hasUnknown]) => hasIssue && (rows?.length > 0 || hasUnknown)));
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
    private readonly externalPluginService: ExternalPluginService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly iconService: IconService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([Save16, ArrowRight16]);
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

  /**
   * The actual definition version of the currently selected external configuration for the row at
   * [index], `null` when the selection is an exact `pluginId@version` match, embedded, or the row
   * has no selection yet (D3 non-blocking warning).
   */
  public selectedConfigurationVersion(row: MappingRow, index: number): string | null {
    if (!row.mismatchedVersionsById || row.mismatchedVersionsById.size === 0) {
      return null;
    }
    const selectedId = this._selections.get(index);
    if (!selectedId) {
      return null;
    }
    return row.mismatchedVersionsById.get(selectedId) ?? null;
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
    const knownKeyDangling = dangling.filter(d => d.pluginDefinitionKey !== null);
    const hasUnknown = dangling.some(d => d.pluginDefinitionKey === null);
    this.hasUnknownPluginConfigurations$.next(hasUnknown);

    if (knownKeyDangling.length === 0) {
      this.mappingRows$.next([]);
      return;
    }

    const embeddedDangling = knownKeyDangling.filter(d => (d.source ?? 'embedded') === 'embedded');
    const externalDangling = knownKeyDangling.filter(d => d.source === 'external');

    combineLatest([
      this.loadEmbeddedRows(embeddedDangling),
      this.loadExternalRows(externalDangling),
    ])
      .pipe(take(1))
      .subscribe(([embeddedRows, externalRows]) => {
        this._selections.clear();
        this.mappingRows$.next([...embeddedRows, ...externalRows]);
      });
  }

  private loadEmbeddedRows(dangling: DanglingPluginConfiguration[]): Observable<MappingRow[]> {
    if (dangling.length === 0) {
      return of([]);
    }

    return this.pluginManagementService.getPluginDefinitions().pipe(
      take(1),
      switchMap(definitions => {
        const installedKeys = new Set(definitions.map(d => d.key));
        return this.loadPluginConfigurations(dangling, installedKeys);
      })
    );
  }

  private loadPluginConfigurations(
    dangling: DanglingPluginConfiguration[],
    installedKeys: Set<string>
  ): Observable<MappingRow[]> {
    const uniqueKeys = [...new Set(dangling.map(d => d.pluginDefinitionKey).filter(Boolean))];
    const installableKeys = uniqueKeys.filter(k => installedKeys.has(k));

    if (installableKeys.length === 0) {
      return of(this.buildEmbeddedRows(dangling, new Map(), installedKeys));
    }

    const configRequests: Record<string, Observable<PluginConfiguration[]>> = {};
    for (const key of installableKeys) {
      configRequests[key] = this.pluginManagementService
        .getPluginConfigurationsByPluginDefinitionKey(key)
        .pipe(
          take(1),
          catchError(() => of([] as PluginConfiguration[]))
        );
    }

    return forkJoin(configRequests).pipe(
      take(1),
      map(results => {
        const configsByKey = new Map<string, PluginConfiguration[]>(Object.entries(results));
        return this.buildEmbeddedRows(dangling, configsByKey, installedKeys);
      })
    );
  }

  private buildEmbeddedRows(
    dangling: DanglingPluginConfiguration[],
    configsByKey: Map<string, PluginConfiguration[]>,
    installedKeys: Set<string>
  ): MappingRow[] {
    return dangling.map(d => {
      const key = d.pluginDefinitionKey;
      const isInstalled = key ? installedKeys.has(key) : false;
      const available = configsByKey.get(key) || [];

      const status = this.determineStatus(isInstalled, available.length > 0);

      return {
        pluginDefinitionKey: key,
        pluginDefinitionTitle: this.getPluginTitle(key),
        sourcePluginConfigurationIds: d.sourcePluginConfigurationIds,
        selectItems: available.map(c => ({id: c.id, text: c.title})),
        status,
        source: 'embedded' as PluginConfigurationPreviewSource,
        pluginDefinitionVersion: null,
      };
    });
  }

  private loadExternalRows(dangling: DanglingPluginConfiguration[]): Observable<MappingRow[]> {
    if (dangling.length === 0) {
      return of([]);
    }

    return combineLatest([
      this.externalPluginService
        .getConfigurations()
        .pipe(catchError(() => of([] as Array<ExternalPluginConfiguration>))),
      this.externalPluginService
        .getDefinitions()
        .pipe(catchError(() => of([] as Array<ExternalPluginDefinition>))),
    ]).pipe(
      take(1),
      map(([configurations, definitions]) => {
        const definitionById = new Map(definitions.map(d => [d.id, d]));
        const lang = this.translateService.currentLang;

        return dangling.map(d => {
          const matchingConfigurations = configurations.filter(configuration => {
            const definition = definitionById.get(configuration.definitionId);
            return definition?.pluginId === d.pluginDefinitionKey;
          });

          const isInstalled = [...definitionById.values()].some(
            def => def.pluginId === d.pluginDefinitionKey
          );
          const status = this.determineStatus(isInstalled, matchingConfigurations.length > 0);

          const mismatchedVersionsById = new Map<string, string>();
          const selectItems: SelectItem[] = matchingConfigurations.map(configuration => {
            const definition = definitionById.get(configuration.definitionId);
            if (definition && definition.version !== d.pluginDefinitionVersion) {
              mismatchedVersionsById.set(configuration.id, definition.version);
            }
            return {
              id: configuration.id,
              text: definition
                ? `${configuration.title} — ${getExternalPluginDisplayName(definition, lang)}`
                : configuration.title,
            };
          });

          return {
            pluginDefinitionKey: d.pluginDefinitionKey,
            pluginDefinitionTitle: this.getExternalPluginTitle(d, definitionById),
            sourcePluginConfigurationIds: d.sourcePluginConfigurationIds,
            selectItems,
            status,
            source: 'external' as PluginConfigurationPreviewSource,
            pluginDefinitionVersion: d.pluginDefinitionVersion ?? null,
            mismatchedVersionsById,
          };
        });
      })
    );
  }

  private getExternalPluginTitle(
    dangling: DanglingPluginConfiguration,
    definitionById: Map<string, ExternalPluginDefinition>
  ): string {
    if (!dangling.pluginDefinitionKey) {
      return this.translateService.instant(
        'caseManagement.missingPluginConfigurations.unknownPlugin'
      );
    }
    const lang = this.translateService.currentLang;
    const matchingDefinition = [...definitionById.values()].find(
      d =>
        d.pluginId === dangling.pluginDefinitionKey &&
        d.version === dangling.pluginDefinitionVersion
    );
    if (matchingDefinition) {
      return getExternalPluginDisplayName(matchingDefinition, lang);
    }
    return dangling.pluginDefinitionVersion
      ? `${dangling.pluginDefinitionKey} (${dangling.pluginDefinitionVersion})`
      : dangling.pluginDefinitionKey;
  }

  private determineStatus(isInstalled: boolean, hasConfigurations: boolean): PluginMappingStatus {
    if (!isInstalled) {
      return 'not-installed';
    }
    if (!hasConfigurations) {
      return 'no-configurations';
    }
    return 'available';
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
