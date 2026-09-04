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
import {ActivatedRoute, Router, RouterModule} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListModule,
  CarbonPaginatorConfig,
  ColumnConfig,
  ConfirmationModalModule,
  Pagination,
  ValtimoCdsModalDirective,
  ViewType,
} from '@valtimo/components';
import {
  CaseManagementParams,
  getCaseManagementRouteParams,
  GlobalNotificationService,
} from '@valtimo/shared';
import {ChevronDown16, ChevronUp16, Copy16} from '@carbon/icons';
import {
  ButtonModule,
  IconModule,
  IconService,
  ModalModule,
  TagModule,
  TagType,
} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  startWith,
  Subject,
  Subscription,
  switchMap,
  take,
  tap,
  timer,
} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {
  CaseMigrationStatus,
  MigrationExecutionError,
  MigrationExecutionWarning,
  MigrationPlanManagement,
} from '../../../../models';
import {CaseMigrationApiService} from '../../../../services';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../../constants';

type MigrationPlanViewModel = MigrationPlanManagement & {name: string};

/** How often the plan list re-reads status while a run is in progress. */
const POLL_INTERVAL_MS = 3000;

/** Whether the plan has a real run or a dry run currently executing. */
const isRunInProgress = (plan: MigrationPlanViewModel): boolean =>
  plan.status?.status === 'RUNNING' || plan.dryRun?.status === 'RUNNING';

@Component({
  standalone: true,
  selector: 'valtimo-case-management-migration',
  templateUrl: './case-management-migration.component.html',
  styleUrls: ['./case-management-migration.component.scss'],
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
export class CaseManagementMigrationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('statusColumn') public statusColumnTemplate!: TemplateRef<any>;
  @ViewChild('progressColumn') public progressColumnTemplate!: TemplateRef<any>;
  @ViewChild('caseIdColumn') public caseIdColumnTemplate!: TemplateRef<any>;
  @ViewChild('errorColumn') public errorColumnTemplate!: TemplateRef<any>;

  protected readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;

  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);
  public readonly errorFields$ = new BehaviorSubject<ColumnConfig[]>([]);
  public readonly warningFields$ = new BehaviorSubject<ColumnConfig[]>([]);

  // The failed-cases table pages client-side: the full error list lives on the plan status.
  public readonly ERROR_PAGE_SIZE = 10;
  public readonly ERROR_PAGINATOR_CONFIG: CarbonPaginatorConfig = {
    itemsPerPageOptions: [this.ERROR_PAGE_SIZE],
    showPageInput: false,
  };

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'caseManagement.migration.startNow',
      callback: this.onStartPlan.bind(this),
      disabledCallback: (plan: MigrationPlanViewModel) => !plan.triggers.triggeredByButton,
    },
    {label: 'caseManagement.migration.dryRun', callback: this.onDryRunPlan.bind(this)},
    {label: 'interface.edit', callback: this.onEditPlan.bind(this)},
    {label: 'interface.duplicate', callback: this.onDuplicatePlan.bind(this)},
    {label: 'interface.delete', callback: this.onDeletePlan.bind(this), type: 'danger'},
  ];

  public readonly $planToDelete = signal<MigrationPlanViewModel | null>(null);
  public readonly $planToStart = signal<MigrationPlanViewModel | null>(null);
  public readonly $planToDryRun = signal<MigrationPlanViewModel | null>(null);

  private readonly _showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteModal$ = this._showDeleteModal$.asObservable();

  private readonly _showStartModal$ = new BehaviorSubject<boolean>(false);
  public readonly showStartModal$ = this._showStartModal$.asObservable();

  private readonly _showDryRunModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDryRunModal$ = this._showDryRunModal$.asObservable();

  private readonly _showDetailModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDetailModal$ = this._showDetailModal$.asObservable();

  private readonly _params$: Observable<CaseManagementParams | undefined> =
    getCaseManagementRouteParams(this.route).pipe(
      tap(params => (this._params = params)),
      shareReplay(1)
    );

  private readonly _refresh$ = new Subject<void>();
  private readonly _selectedKey$ = new BehaviorSubject<string | null>(null);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  public readonly loading$ = this._loading$.asObservable();

  // True while any plan on this version has a run in progress.
  private readonly _polling$ = new BehaviorSubject<boolean>(false);

  /** Refreshes on a manual action and, while a run is in progress, on a timer — a run is dispatched to a background thread and takes hours, so the start response is only its first moment. Polling stops when nothing runs. */
  public readonly plans$: Observable<MigrationPlanViewModel[]> = this._params$.pipe(
    switchMap(params =>
      !params
        ? of<MigrationPlanViewModel[]>([])
        : merge(
            this._refresh$,
            this._polling$.pipe(
              distinctUntilChanged(),
              switchMap(running => (running ? timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS) : EMPTY))
            )
          ).pipe(
            startWith(undefined),
            switchMap(() => this.fetchPlans(params)),
            // Deduplicated above, so a run that is still going does not resubscribe the timer on every tick.
            tap(plans => this._polling$.next(plans.some(plan => isRunInProgress(plan))))
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

  private readonly _errorPage$ = new BehaviorSubject<number>(1);

  // Case ids whose full stacktrace is expanded. A new Set per change so the OnPush view re-renders.
  private readonly _$expandedErrors = signal<ReadonlySet<string>>(new Set());

  // The current page of failed cases for the selected plan, plus the pagination model the list needs.
  public readonly errorsView$: Observable<{
    items: MigrationExecutionError[];
    pagination: Pagination;
  }> = combineLatest([this.selectedPlan$, this._errorPage$]).pipe(
    map(([plan, page]) => {
      const errors = plan?.status.errors ?? [];
      const start = (page - 1) * this.ERROR_PAGE_SIZE;
      return {
        items: errors.slice(start, start + this.ERROR_PAGE_SIZE),
        pagination: {page, size: this.ERROR_PAGE_SIZE, collectionSize: errors.length},
      };
    })
  );

  private readonly _warningPage$ = new BehaviorSubject<number>(1);

  // Cases the run migrated but did not do everything for. A separate table: a warning is not a failure.
  public readonly warningsView$: Observable<{
    items: MigrationExecutionWarning[];
    pagination: Pagination;
  }> = combineLatest([this.selectedPlan$, this._warningPage$]).pipe(
    map(([plan, page]) => this.pageOf(plan?.status.warnings ?? [], page))
  );

  private readonly _dryRunWarningPage$ = new BehaviorSubject<number>(1);

  // The same for the latest dry run — where an author should discover a plan that would create nothing.
  public readonly dryRunWarningsView$: Observable<{
    items: MigrationExecutionWarning[];
    pagination: Pagination;
  }> = combineLatest([this.selectedPlan$, this._dryRunWarningPage$]).pipe(
    map(([plan, page]) => this.pageOf(plan?.dryRun.warnings ?? [], page))
  );

  private readonly _dryRunErrorPage$ = new BehaviorSubject<number>(1);

  // The current page of would-fail cases from the selected plan's latest dry run.
  public readonly dryRunErrorsView$: Observable<{
    items: MigrationExecutionError[];
    pagination: Pagination;
  }> = combineLatest([this.selectedPlan$, this._dryRunErrorPage$]).pipe(
    map(([plan, page]) => {
      const errors = plan?.dryRun.errors ?? [];
      const start = (page - 1) * this.ERROR_PAGE_SIZE;
      return {
        items: errors.slice(start, start + this.ERROR_PAGE_SIZE),
        pagination: {page, size: this.ERROR_PAGE_SIZE, collectionSize: errors.length},
      };
    })
  );

  private _params: CaseManagementParams | undefined;
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly cd: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly caseMigrationApiService: CaseMigrationApiService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([ChevronDown16, ChevronUp16, Copy16]);
  }

  public ngAfterViewInit(): void {
    this.cd.detectChanges();
    this.setFields();
    this._subscriptions.add(this._params$.subscribe());
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onRowClicked(plan: MigrationPlanViewModel): void {
    // Keeping _selectedKey$ set means the modal keeps live-updating from the polled list while it is open.
    this._errorPage$.next(1);
    this._dryRunErrorPage$.next(1);
    this._warningPage$.next(1);
    this._dryRunWarningPage$.next(1);
    this._$expandedErrors.set(new Set());
    this._selectedKey$.next(plan.migrationKey);
    this._showDetailModal$.next(true);
  }

  public onCloseDetail(): void {
    this._showDetailModal$.next(false);
    this._selectedKey$.next(null);
    this._errorPage$.next(1);
    this._dryRunErrorPage$.next(1);
    this._warningPage$.next(1);
    this._dryRunWarningPage$.next(1);
    this._$expandedErrors.set(new Set());
  }

  public onErrorPageChange(page: number): void {
    this._errorPage$.next(page);
  }

  public onDryRunPageChange(page: number): void {
    this._dryRunErrorPage$.next(page);
  }

  public onWarningPageChange(page: number): void {
    this._warningPage$.next(page);
  }

  public onDryRunWarningPageChange(page: number): void {
    this._dryRunWarningPage$.next(page);
  }

  private pageOf<T>(items: T[], page: number): {items: T[]; pagination: Pagination} {
    const start = (page - 1) * this.ERROR_PAGE_SIZE;
    return {
      items: items.slice(start, start + this.ERROR_PAGE_SIZE),
      pagination: {page, size: this.ERROR_PAGE_SIZE, collectionSize: items.length},
    };
  }

  public isErrorExpanded(caseId: string): boolean {
    return this._$expandedErrors().has(caseId);
  }

  public onToggleError(event: Event, caseId: string): void {
    event.stopPropagation();
    const expanded = new Set(this._$expandedErrors());
    if (expanded.has(caseId)) {
      expanded.delete(caseId);
    } else {
      expanded.add(caseId);
    }
    this._$expandedErrors.set(expanded);
  }

  // Null when no case route applies (e.g. building blocks); the id then renders as plain text.
  public caseDetailLink(caseId: string): string[] | null {
    if (!this._params || !caseId) return null;
    return ['/cases', this._params.caseDefinitionKey, 'document', caseId];
  }

  public shortId(id: string): string {
    return id ? `${id.slice(0, 8)}…` : '-';
  }

  // The first line of a stacktrace is the exception type + message — the useful one-line summary.
  public firstErrorLine(message: string | null): string {
    return message ? message.split('\n')[0].trim() : '-';
  }

  public onCopyError(event: Event, message: string | null): void {
    event.stopPropagation();
    if (!message) return;

    navigator.clipboard?.writeText(message);
    this.globalNotificationService.showToast({
      title: this.translateService.instant('caseManagement.migration.errors.copied'),
      type: 'success',
    });
  }

  public onStartPlan(plan: MigrationPlanViewModel): void {
    // Close the details modal first so the start confirmation isn't stacked behind it.
    this._showDetailModal$.next(false);
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

  public onDryRunPlan(plan: MigrationPlanViewModel): void {
    // Close the details modal first so the dry-run confirmation isn't stacked behind it.
    this._showDetailModal$.next(false);
    this.$planToDryRun.set(plan);
    this._showDryRunModal$.next(true);
  }

  public onDryRunConfirm(plan: MigrationPlanViewModel): void {
    if (!this._params || !plan) return;

    this.caseMigrationApiService
      .startDryRun(this._params, plan.migrationKey)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this._showDryRunModal$.next(false);
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

    combineLatest([
      this.caseMigrationApiService.getPlanJson(params, plan.migrationKey),
      this.plans$,
    ])
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

  private fetchPlans(params: CaseManagementParams): Observable<MigrationPlanViewModel[]> {
    return this.caseMigrationApiService.getPlans(params).pipe(
      // Ignore a failed fetch so the list keeps its last value instead of flashing empty.
      catchError(() => EMPTY),
      map(plans => plans.map(plan => ({...plan, name: plan.title || plan.migrationKey})))
    );
  }

  private setFields(): void {
    this.fields$.next([
      {key: 'name', label: 'caseManagement.migration.columns.plan', viewType: ViewType.TEXT},
      {key: 'source', label: 'caseManagement.migration.columns.source', viewType: ViewType.TEXT},
      {key: 'target', label: 'caseManagement.migration.columns.target', viewType: ViewType.TEXT},
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

    this.errorFields$.next([
      {
        key: 'caseId',
        label: 'caseManagement.migration.errors.caseId',
        viewType: ViewType.TEMPLATE,
        template: this.caseIdColumnTemplate,
        className: 'migration-error__case-column',
      },
      {
        key: 'message',
        label: 'caseManagement.migration.errors.message',
        viewType: ViewType.TEMPLATE,
        template: this.errorColumnTemplate,
      },
    ]);

    // A warning is a sentence, not a stacktrace, so it needs no expand/collapse template.
    this.warningFields$.next([
      {
        key: 'caseId',
        label: 'caseManagement.migration.errors.caseId',
        viewType: ViewType.TEMPLATE,
        template: this.caseIdColumnTemplate,
        className: 'migration-error__case-column',
      },
      {
        key: 'message',
        label: 'caseManagement.migration.warnings.message',
        viewType: ViewType.TEXT,
      },
    ]);
  }
}
