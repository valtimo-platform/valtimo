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
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  ViewType,
} from '@valtimo/components';
import {CaseManagementParams, getCaseManagementRouteParams} from '@valtimo/shared';
import {ButtonModule, IconModule, TagModule, TagType} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
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
import {CaseMigrationStatus, MigrationPlanManagement} from '../../../../models';
import {CaseMigrationApiService} from '../../../../services';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../../constants';

type MigrationPlanViewModel = MigrationPlanManagement & {name: string};

@Component({
  standalone: true,
  selector: 'valtimo-case-management-migration',
  templateUrl: './case-management-migration.component.html',
  styleUrls: ['./case-management-migration.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    CarbonListModule,
    ButtonModule,
    IconModule,
    TagModule,
    ConfirmationModalModule,
  ],
})
export class CaseManagementMigrationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('statusColumn') public statusColumnTemplate!: TemplateRef<any>;
  @ViewChild('progressColumn') public progressColumnTemplate!: TemplateRef<any>;

  protected readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;

  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);

  public readonly ACTION_ITEMS: ActionItem[] = [
    {label: 'caseManagement.migration.startNow', callback: this.onStartPlan.bind(this)},
    {label: 'interface.edit', callback: this.onEditPlan.bind(this)},
    {label: 'interface.duplicate', callback: this.onDuplicatePlan.bind(this)},
    {label: 'interface.delete', callback: this.onDeletePlan.bind(this), type: 'danger'},
  ];

  public readonly $planToDelete = signal<MigrationPlanViewModel | null>(null);
  public readonly $planToStart = signal<MigrationPlanViewModel | null>(null);

  private readonly _showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteModal$ = this._showDeleteModal$.asObservable();

  private readonly _showStartModal$ = new BehaviorSubject<boolean>(false);
  public readonly showStartModal$ = this._showStartModal$.asObservable();

  private readonly _params$: Observable<CaseManagementParams | undefined> =
    getCaseManagementRouteParams(this.route).pipe(
      tap(params => (this._params = params)),
      shareReplay(1)
    );

  private readonly _refresh$ = new Subject<void>();
  private readonly _selectedKey$ = new BehaviorSubject<string | null>(null);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  public readonly loading$ = this._loading$.asObservable();

  public readonly plans$: Observable<MigrationPlanViewModel[]> = this._params$.pipe(
    switchMap(params =>
      !params
        ? of<MigrationPlanViewModel[]>([])
        : this._refresh$.pipe(
            startWith(undefined),
            switchMap(() =>
              this.caseMigrationApiService.getPlans(params).pipe(catchError(() => of([])))
            ),
            map(plans => plans.map(plan => ({...plan, name: plan.title || plan.migrationKey})))
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

  private _params: CaseManagementParams | undefined;
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly cd: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly caseMigrationApiService: CaseMigrationApiService,
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
    this._selectedKey$.next(
      this._selectedKey$.value === plan.migrationKey ? null : plan.migrationKey
    );
  }

  public onCloseDetail(): void {
    this._selectedKey$.next(null);
  }

  public onStartPlan(plan: MigrationPlanViewModel): void {
    this.$planToStart.set(plan);
    this._showStartModal$.next(true);
  }

  public onStartConfirm(plan: MigrationPlanViewModel): void {
    if (!this._params || !plan) return;

    this.caseMigrationApiService
      .startMigration(this._params, plan.migrationKey)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this._showStartModal$.next(false);
        this._refresh$.next();
      });
  }

  public onAddPlan(): void {
    if (!this._params) return;

    this.router.navigate([
      'case-management',
      'case',
      this._params.caseDefinitionKey,
      'version',
      this._params.caseDefinitionVersionTag,
      'migration',
      'create',
    ]);
  }

  public onEditPlan(plan: MigrationPlanManagement): void {
    if (!this._params) return;

    this.router.navigate([
      'case-management',
      'case',
      this._params.caseDefinitionKey,
      'version',
      this._params.caseDefinitionVersionTag,
      'migration',
      plan.migrationKey,
    ]);
  }

  public onDuplicatePlan(plan: MigrationPlanViewModel): void {
    if (!this._params) return;
    const params = this._params;

    combineLatest([this.caseMigrationApiService.getPlanJson(params, plan.migrationKey), this.plans$])
      .pipe(
        take(1),
        switchMap(([json, plans]) => {
          const existingKeys = new Set(plans.map(existing => existing.migrationKey));
          const baseKey = typeof json['key'] === 'string' ? (json['key'] as string) : plan.migrationKey;
          const baseTitle = typeof json['title'] === 'string' ? (json['title'] as string) : plan.name;
          const copy = {
            ...json,
            key: this.uniqueKey(baseKey, existingKeys),
            title: `${baseTitle} (${this.translateService.instant('caseManagement.migration.duplicateSuffix')})`,
          };
          return this.caseMigrationApiService.savePlan(params, copy);
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

    this.caseMigrationApiService
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

  public statusTagType(status: CaseMigrationStatus): TagType {
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

  private setFields(): void {
    this.fields$.next([
      {key: 'name', label: 'caseManagement.migration.columns.plan', viewType: ViewType.TEXT},
      {
        key: '',
        label: 'caseManagement.migration.columns.status',
        viewType: ViewType.TEMPLATE,
        template: this.statusColumnTemplate,
      },
      {
        key: '',
        label: 'caseManagement.migration.columns.progress',
        viewType: ViewType.TEMPLATE,
        template: this.progressColumnTemplate,
      },
    ]);
  }
}
