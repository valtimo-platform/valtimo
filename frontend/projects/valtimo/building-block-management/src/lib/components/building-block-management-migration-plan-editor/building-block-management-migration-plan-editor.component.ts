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
import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {Params, Router} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {BreadcrumbService} from '@valtimo/components';
import {map, Observable, take} from 'rxjs';
import {
  BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_TABS,
} from '../../constants';
import {BuildingBlockManagementApiService, BuildingBlockMigrationApiService} from '../../services';
import {BuildingBlockEntryOwnerType, BuildingBlockMigrationParams} from '../../models';
import {MigrationPlanEditorBaseComponent} from '../migration-plan-editor/migration-plan-editor-base/migration-plan-editor-base.component';
import {MigrationPlanEditorShellComponent} from '../migration-plan-editor/migration-plan-editor-shell/migration-plan-editor-shell.component';
import {BbMigrationGeneralTabComponent} from './bb-migration-general-tab/bb-migration-general-tab.component';

/** The migration plan editor of one building block definition version. Everything but the General tab and how a building block is addressed comes from [MigrationPlanEditorBaseComponent]. */
@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-migration-plan-editor',
  templateUrl: './building-block-management-migration-plan-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    MigrationPlanEditorShellComponent,
    BbMigrationGeneralTabComponent,
  ],
})
export class BuildingBlockManagementMigrationPlanEditorComponent extends MigrationPlanEditorBaseComponent<BuildingBlockMigrationParams> {
  public readonly testIds = BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS;

  // Memoized so the data-migration value-path selectors get a stable context reference each render.
  public readonly $targetContext = computed(() => ({
    buildingBlockKey: this.$targetKey(),
    buildingBlockVersionTag: this.$targetVersionTag(),
  }));

  // The "from" side resolves against the source the plan declares — its key as much as its version.
  public readonly $sourceContext = computed(() => ({
    buildingBlockKey: this.$sourceKey(),
    buildingBlockVersionTag: this.$sourceVersionTag(),
  }));

  protected readonly translationPrefix = 'buildingBlockManagement';
  protected readonly ownerType: BuildingBlockEntryOwnerType = 'BUILDING_BLOCK';
  protected readonly migrationApiService = inject(BuildingBlockMigrationApiService);

  protected readonly NEW_PLAN_TEMPLATE = JSON.stringify(
    {
      title: '',
      key: '',
      source: {key: '', versionTag: ''},
      dataMigration: [],
      processMigration: [],
    },
    null,
    2
  );

  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly router = inject(Router);
  private readonly buildingBlockManagementApiService = inject(BuildingBlockManagementApiService);

  protected readParams(params: Params): BuildingBlockMigrationParams {
    return {
      buildingBlockDefinitionKey: params['buildingBlockDefinitionKey'],
      buildingBlockDefinitionVersionTag: params['buildingBlockDefinitionVersionTag'],
    };
  }

  protected targetKeyOf(params: BuildingBlockMigrationParams): string {
    return params.buildingBlockDefinitionKey;
  }

  protected targetVersionTagOf(params: BuildingBlockMigrationParams): string {
    return params.buildingBlockDefinitionVersionTag;
  }

  /** Every building block key, so a plan can migrate the instances of any of them onto this one. */
  protected loadSourceKeyOptions(): void {
    this.buildingBlockManagementApiService
      .getBuildingBlockDefinitions()
      .pipe(take(1))
      .subscribe({
        next: definitions =>
          this.$sourceKeyOptions.set(
            (definitions ?? [])
              .map(definition => definition.key)
              .filter((key): key is string => !!key)
              .filter((key, index, keys) => keys.indexOf(key) === index)
              .map(key => ({id: key, text: key}))
          ),
        error: () => {},
      });
  }

  protected loadSourceVersionOptions(key: string): void {
    this.buildingBlockManagementApiService
      .getVersionsForBuildingBlock(key, 0, 100, true)
      .pipe(take(1))
      .subscribe({
        next: page =>
          this.$sourceVersionOptions.set(
            (page?.content ?? [])
              .map(version => version?.versionTag)
              .filter((versionTag): versionTag is string => !!versionTag)
              .map(versionTag => ({id: versionTag, text: versionTag}))
          ),
        error: () => this.$sourceVersionOptions.set([]),
      });
  }

  protected linkedProcessDefinitions(
    key: string,
    versionTag: string
  ): Observable<Record<string, string>> {
    return this.buildingBlockManagementApiService
      .getBuildingBlockProcessDefinitions(key, versionTag)
      .pipe(
        map(definitions => {
          const defs: Record<string, string> = {};
          definitions.forEach(definition => {
            if (definition?.key && definition?.id) defs[definition.key] = definition.id;
          });
          return defs;
        })
      );
  }

  protected initBreadcrumbs(): void {
    const base = `/building-block-management/building-block/${this._params.buildingBlockDefinitionKey}/version/${this._params.buildingBlockDefinitionVersionTag}`;

    // The detail screen requires an explicit tab segment, so the breadcrumb targets a concrete tab — the bare version URL matches no route.
    const detailRoute = `${base}/${BUILDING_BLOCK_MANAGEMENT_TABS.GENERAL}`;

    this.breadcrumbService.setThirdBreadcrumb({
      route: [detailRoute],
      content: `${this._params.buildingBlockDefinitionKey} (${this._params.buildingBlockDefinitionVersionTag})`,
      href: detailRoute,
    });

    const migrationRoute = `${base}/${BUILDING_BLOCK_MANAGEMENT_TABS.MIGRATION}`;

    // stream() so the label resolves on a cold direct navigation and follows language changes.
    this._subscriptions.add(
      this.translateService.stream('buildingBlockManagement.tabs.migration').subscribe(content =>
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
      `building-block-management/building-block/${this._params.buildingBlockDefinitionKey}/version/${this._params.buildingBlockDefinitionVersionTag}/${BUILDING_BLOCK_MANAGEMENT_TABS.MIGRATION}`
    );
  }
}
