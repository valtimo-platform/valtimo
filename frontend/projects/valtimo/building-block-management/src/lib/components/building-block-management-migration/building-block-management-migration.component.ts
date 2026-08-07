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
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {Router, RouterModule} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  ValtimoCdsModalDirective,
  ViewType,
} from '@valtimo/components';
import {
  ButtonModule,
  IconModule,
  ModalModule,
  TagModule,
  TagType,
} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  EMPTY,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  Subject,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS, BUILDING_BLOCK_MANAGEMENT_TABS} from '../../constants';
import {
  BuildingBlockMigrationParams,
  BuildingBlockMigrationStatus,
  MigrationPlanManagement,
} from '../../models';
import {BuildingBlockMigrationApiService, BuildingBlockManagementDetailService} from '../../services';

type MigrationPlanViewModel = MigrationPlanManagement & {name: string};

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-migration',
  templateUrl: './building-block-management-migration.component.html',
  styleUrls: ['./building-block-management-migration.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    CarbonListModule,
    ButtonModule,
    IconModule,
    TagModule,
    ModalModule,
    ValtimoCdsModalDirective,
    ConfirmationModalModule,
  ],
})
export class BuildingBlockManagementMigrationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('statusColumn') public statusColumnTemplate!: TemplateRef<any>;
  @ViewChild('progressColumn') public progressColumnTemplate!: TemplateRef<any>;

  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS;

  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);

  // No "start" and no "dry run": a building block plan is applied by the case migration that moves a
  // building block onto this version, and simulated by that case migration's dry run.
  public readonly ACTION_ITEMS: ActionItem[] = [
    {label: 'interface.edit', callback: this.onEditPlan.bind(this)},
    {label: 'interface.duplicate', callback: this.onDuplicatePlan.bind(this)},
    {label: 'interface.delete', callback: this.onDeletePlan.bind(this), type: 'danger'},
  ];

  public readonly $planToDelete = signal<MigrationPlanViewModel | null>(null);

  private readonly _showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteModal$ = this._showDeleteModal$.asObservable();

  private readonly _showDetailModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDetailModal$ = this._showDetailModal$.asObservable();

  private readonly _params$: Observable<BuildingBlockMigrationParams> = combineLatest([
    this.buildingBlockManagementDetailService.buildingBlockDefinitionKey$,
    this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag$,
  ]).pipe(
    map(([buildingBlockDefinitionKey, buildingBlockDefinitionVersionTag]) => ({
      buildingBlockDefinitionKey,
      buildingBlockDefinitionVersionTag,
    })),
    tap(params => (this._params = params)),
    shareReplay(1)
  );

  private readonly _refresh$ = new Subject<void>();
  private readonly _selectedKey$ = new BehaviorSubject<string | null>(null);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  public readonly loading$ = this._loading$.asObservable();

  // The list is fetched once on load and re-fetched only on a manual action (start / delete /
  // duplicate). No background polling — status reflects the moment the list was last loaded.
  public readonly plans$: Observable<MigrationPlanViewModel[]> = this._params$.pipe(
    switchMap(params =>
      this._refresh$.pipe(
        startWith(undefined),
        switchMap(() => this.fetchPlans(params))
      )
    ),
    tap(() => this._loading$.next(false)),
    shareReplay(1)
  );

  public readonly selectedPlan$: Observable<MigrationPlanViewModel | null> = combineLatest([
    this.plans$,
    this._selectedKey$,
  ]).pipe(
    map(([plans, key]) => plans.find(plan => plan.migrationKey === key) ?? null),
    startWith(null)
  );

  // A plan migrates FROM this version's predecessor (basedOnVersionTag) TO this version, so a version
  // with no predecessor has nothing to migrate from — adding a plan is disabled for it.
  public readonly canAddPlan$: Observable<boolean> =
    this.buildingBlockManagementDetailService.buildingBlockDefinition$.pipe(
      map(definition => !!definition?.basedOnVersionTag),
      catchError(() => of(false)),
      startWith(false),
      shareReplay(1)
    );

  private _params: BuildingBlockMigrationParams | undefined;
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly cd: ChangeDetectorRef,
    private readonly router: Router,
    private readonly buildingBlockMigrationApiService: BuildingBlockMigrationApiService,
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly translateService: TranslateService
  ) {}

  public ngAfterViewInit(): void {
    this.cd.detectChanges();
    this.setFields();
    this._subscriptions.add(this._params$.subscribe());
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onRowClicked(plan: MigrationPlanViewModel): void {
    // Open the read-only details/status modal for the clicked plan. Keeping _selectedKey$ set means
    // the modal's content keeps reflecting the loaded plan list while it is open.
    this._selectedKey$.next(plan.migrationKey);
    this._showDetailModal$.next(true);
  }

  public onCloseDetail(): void {
    this._showDetailModal$.next(false);
    this._selectedKey$.next(null);
  }

  public onAddPlan(): void {
    if (!this._params) return;

    this.router.navigate([
      'building-block-management',
      'building-block',
      this._params.buildingBlockDefinitionKey,
      'version',
      this._params.buildingBlockDefinitionVersionTag,
      BUILDING_BLOCK_MANAGEMENT_TABS.MIGRATION,
      'create',
    ]);
  }

  public onEditPlan(plan: MigrationPlanManagement): void {
    if (!this._params) return;

    this.router.navigate([
      'building-block-management',
      'building-block',
      this._params.buildingBlockDefinitionKey,
      'version',
      this._params.buildingBlockDefinitionVersionTag,
      BUILDING_BLOCK_MANAGEMENT_TABS.MIGRATION,
      plan.migrationKey,
    ]);
  }

  public onDuplicatePlan(plan: MigrationPlanViewModel): void {
    if (!this._params) return;
    const params = this._params;

    combineLatest([this.buildingBlockMigrationApiService.getPlanJson(params, plan.migrationKey), this.plans$])
      .pipe(
        take(1),
        switchMap(([json, plans]) => {
          const existingKeys = new Set(plans.map(existing => existing.migrationKey));
          const baseKey =
            typeof json['key'] === 'string' ? (json['key'] as string) : plan.migrationKey;
          const baseTitle =
            typeof json['title'] === 'string' ? (json['title'] as string) : plan.name;
          const copy = {
            ...json,
            key: this.uniqueKey(baseKey, existingKeys),
            title: `${baseTitle} (${this.translateService.instant('buildingBlockManagement.migration.duplicateSuffix')})`,
          };
          return this.buildingBlockMigrationApiService.savePlan(params, copy);
        }),
        catchError(() => of(null))
      )
      .subscribe(() => this._refresh$.next());
  }

  public onDeletePlan(plan: MigrationPlanViewModel): void {
    this.$planToDelete.set(plan);
    this._showDeleteModal$.next(true);
  }

  public onDeleteConfirm(plan: MigrationPlanViewModel): void {
    if (!this._params || !plan) return;

    this.buildingBlockMigrationApiService
      .deletePlan(this._params, plan.migrationKey)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this._showDeleteModal$.next(false);
        if (this._selectedKey$.value === plan.migrationKey) this._selectedKey$.next(null);
        this._refresh$.next();
      });
  }

  private uniqueKey(base: string, existingKeys: Set<string>): string {
    let candidate = `${base}-copy`;
    let counter = 2;
    while (existingKeys.has(candidate)) candidate = `${base}-copy-${counter++}`;
    return candidate;
  }

  public statusTagType(status: BuildingBlockMigrationStatus): TagType {
    switch (status) {
      case 'RUNNING':
        return 'blue';
      case 'COMPLETED':
        return 'green';
      case 'COMPLETED_WITH_ERRORS':
        return 'red';
      default:
        return 'gray';
    }
  }

  private fetchPlans(params: BuildingBlockMigrationParams): Observable<MigrationPlanViewModel[]> {
    return this.buildingBlockMigrationApiService.getPlans(params).pipe(
      // Ignore a failed fetch so the list keeps its last value instead of flashing empty.
      catchError(() => EMPTY),
      map(plans => plans.map(plan => ({...plan, name: plan.title || plan.migrationKey})))
    );
  }

  private setFields(): void {
    this.fields$.next([
      {key: 'name', label: 'buildingBlockManagement.migration.columns.plan', viewType: ViewType.TEXT},
      {key: 'source', label: 'buildingBlockManagement.migration.columns.source', viewType: ViewType.TEXT},
      {key: 'target', label: 'buildingBlockManagement.migration.columns.target', viewType: ViewType.TEXT},
      {
        key: '',
        label: 'buildingBlockManagement.migration.columns.status',
        viewType: ViewType.TEMPLATE,
        template: this.statusColumnTemplate,
      },
      {
        key: '',
        label: 'buildingBlockManagement.migration.columns.instancesMigrated',
        viewType: ViewType.TEMPLATE,
        template: this.progressColumnTemplate,
      },
    ]);
  }
}
