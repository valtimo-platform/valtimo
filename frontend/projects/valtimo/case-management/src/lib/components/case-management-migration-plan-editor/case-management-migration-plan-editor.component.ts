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
import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Params, Router} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {BreadcrumbService, SelectItem, ValuePathSelectorPrefix} from '@valtimo/components';
import {CaseManagementParams} from '@valtimo/shared';
import {
  MigrationPlanEditorBaseComponent,
  MigrationPlanEditorShellComponent,
} from '@valtimo/building-block-management';
import {map, Observable, take} from 'rxjs';
import {
  CaseManagementService,
  CaseMigrationApiService,
  StartableItemApiService,
} from '../../services';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../constants';
import {BuildingBlockEntryOwnerType, MigrationPlanManagement} from '../../models';
import {MigrationGeneralTabComponent} from './migration-general-tab/migration-general-tab.component';

/** The migration plan editor of one case definition version. What is added over [MigrationPlanEditorBaseComponent] is what only a case plan has — conditions, triggers, `runAfter`, and `case:` metadata in its value pickers. */
@Component({
  standalone: true,
  selector: 'valtimo-case-management-migration-plan-editor',
  templateUrl: './case-management-migration-plan-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    MigrationPlanEditorShellComponent,
    MigrationGeneralTabComponent,
  ],
})
export class CaseManagementMigrationPlanEditorComponent extends MigrationPlanEditorBaseComponent<
  CaseManagementParams,
  MigrationPlanManagement
> {
  public readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;

  // `case:` is a case plan's alone and stays offered in both directions — the case is migrating either way.
  public override readonly sourcePrefixes = [
    ValuePathSelectorPrefix.DOC,
    ValuePathSelectorPrefix.CASE,
  ];

  // Memoized so the data-migration value-path selectors get a stable context reference each render.
  public readonly $targetContext = computed(() => ({
    caseDefinitionKey: this.$targetKey(),
    caseDefinitionVersionTag: this.$targetVersionTag(),
  }));

  // The "from" side resolves against the source the plan declares — its key as much as its version.
  public readonly $sourceContext = computed(() => ({
    caseDefinitionKey: this.$sourceKey(),
    caseDefinitionVersionTag: this.$sourceVersionTag(),
  }));

  // A condition reads the source version but may test a target-only field, so both sets are offered.
  public readonly $conditionAdditionalVersionTags = computed(() => {
    const targetVersion = this.$targetVersionTag();
    const sameKey = this.$sourceKey() === this.$targetKey();
    return sameKey && targetVersion && targetVersion !== this.$sourceVersionTag()
      ? [targetVersion]
      : [];
  });

  /** What a plan's `runAfter` may point at — the version's other plans. */
  public readonly $runAfterOptions = signal<SelectItem[]>([]);

  protected readonly translationPrefix = 'caseManagement';
  protected readonly ownerType: BuildingBlockEntryOwnerType = 'CASE';
  protected readonly migrationApiService = inject(CaseMigrationApiService);

  protected readonly NEW_PLAN_TEMPLATE = JSON.stringify(
    {
      title: '',
      key: '',
      source: {key: '', versionTag: ''},
      migrationTriggers: {triggeredByButton: true},
      conditions: [],
      dataMigration: [],
      processMigration: [],
    },
    null,
    2
  );

  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly router = inject(Router);
  private readonly caseManagementService = inject(CaseManagementService);
  private readonly startableItemApiService = inject(StartableItemApiService);

  protected readParams(params: Params): CaseManagementParams {
    return {
      caseDefinitionKey: params['caseDefinitionKey'],
      caseDefinitionVersionTag: params['caseDefinitionVersionTag'],
    };
  }

  protected targetKeyOf(params: CaseManagementParams): string {
    return params.caseDefinitionKey;
  }

  protected targetVersionTagOf(params: CaseManagementParams): string {
    return params.caseDefinitionVersionTag;
  }

  protected override onPlansLoaded(others: MigrationPlanManagement[]): void {
    this.$runAfterOptions.set(
      others.map(plan => ({id: plan.migrationKey, text: plan.title || plan.migrationKey}))
    );
  }

  /** Every case definition key, so a plan can migrate instances of any of them. */
  protected loadSourceKeyOptions(): void {
    this.caseManagementService
      .getCaseDefinitions({size: 500})
      .pipe(take(1))
      .subscribe({
        next: page =>
          this.$sourceKeyOptions.set(
            (page?.content ?? [])
              .map(definition => definition.caseDefinitionKey)
              // One row per case definition *version*, so the same key comes back repeatedly.
              .filter((key, index, keys) => !!key && keys.indexOf(key) === index)
              .map(key => ({id: key, text: key}))
          ),
        error: () => {},
      });
  }

  protected loadSourceVersionOptions(key: string): void {
    this.caseManagementService
      .getCaseDefinitionVersions(key)
      .pipe(take(1))
      .subscribe({
        next: versions =>
          this.$sourceVersionOptions.set(
            this.withDeclaredSource(
              key,
              (versions ?? [])
                .map(version => version?.versionTag)
                .filter((versionTag): versionTag is string => !!versionTag)
                .map(versionTag => ({id: versionTag, text: versionTag}))
            )
          ),
        error: () => this.$sourceVersionOptions.set(this.withDeclaredSource(key, [])),
      });
  }

  protected linkedProcessDefinitions(
    caseDefinitionKey: string,
    versionTag: string
  ): Observable<Record<string, string>> {
    return this.startableItemApiService
      .getLinkedProcessDefinitions({
        caseDefinitionKey,
        caseDefinitionVersionTag: versionTag,
      })
      .pipe(
        map(links => {
          const defs: Record<string, string> = {};
          links.forEach(link => {
            const definition = link.processDefinition;
            if (definition?.key && definition?.id) defs[definition.key] = definition.id;
          });
          return defs;
        })
      );
  }

  protected initBreadcrumbs(): void {
    const route = `/case-management/case/${this._params.caseDefinitionKey}/version/${this._params.caseDefinitionVersionTag}`;

    this.breadcrumbService.setThirdBreadcrumb({
      route: [route],
      content: `${this._params.caseDefinitionKey} (${this._params.caseDefinitionVersionTag})`,
      href: route,
    });

    const migrationRoute = `${route}/migration`;

    // stream() so the label resolves on a cold direct navigation and follows language changes.
    this._subscriptions.add(
      this.translateService.stream('caseManagement.tabs.migration').subscribe(content =>
        this.breadcrumbService.setFourthBreadcrumb({
          route: [migrationRoute],
          content,
          href: migrationRoute,
        })
      )
    );
  }

  protected clearBreadcrumbs(): void {
    this.breadcrumbService.clearThirdBreadcrumb();
    this.breadcrumbService.clearFourthBreadcrumb();
  }

  protected navigateBack(): void {
    this.router.navigateByUrl(
      `case-management/case/${this._params.caseDefinitionKey}/version/${this._params.caseDefinitionVersionTag}/migration`
    );
  }

  /** The plan's own source, even when nobody deploys it any more — deleting a case version leaves every plan migrating from it naming a version this list no longer has, and the picker rendered the word `undefined` rather than saying so. */
  private withDeclaredSource(key: string, options: SelectItem[]): SelectItem[] {
    const declared = this.$sourceVersionTag();
    if (!declared || this.$sourceKey() !== key || options.some(option => option.id === declared)) {
      return options;
    }

    return [
      ...options,
      {
        id: declared,
        text: this.translateService.instant('caseManagement.migration.editor.sourceNotDeployed', {
          versionTag: declared,
        }),
      },
    ];
  }
}
