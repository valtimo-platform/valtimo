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

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnDestroy,
  OnInit,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  IconService,
  LayerModule,
  ListItem,
  TagModule,
} from 'carbon-components-angular';
import {Renew16} from '@carbon/icons';
import {
  CarbonListModule,
  CarbonPaginatorConfig,
  ColumnConfig,
  Pagination,
  ViewType,
} from '@valtimo/components';
import {
  EXTERNAL_PLUGIN_CONTRACT_JOB_STATUSES,
  ExternalPluginConfiguration,
  ExternalPluginContractJobStatus,
  ExternalPluginContractJobSummary,
  ExternalPluginService,
} from '@valtimo/plugin';
import {Subscription} from 'rxjs';
import {PluginContractJobDetailModalComponent} from '../plugin-contract-job-detail-modal/plugin-contract-job-detail-modal.component';
import {PLUGIN_CONTRACT_JOBS_PAGE_TEST_IDS} from '../../constants';
import {contractJobStatusTagType} from '../../utils';

interface ContractJobRow extends ExternalPluginContractJobSummary {
  statusTagType: string;
  /** `errorCode`, followed by the provider's own code when it reported one. */
  errorLabel: string;
}

interface FilterListItem extends ListItem {
  value: string;
}

const DEFAULT_PAGE_SIZE = 10;

/** Opens the detail modal of this job; set while the modal is open, so the URL can be shared. */
const JOB_ID_QUERY_PARAM = 'jobId';

/**
 * The contract job ledger: every asynchronous request one plugin configuration made of another,
 * with its state, deadline and delivery attempts, filterable by status and by the configuration on
 * either side. A row (or the `jobId` query parameter) opens the job's details.
 */
@Component({
  standalone: true,
  templateUrl: './plugin-contract-jobs-page.component.html',
  styleUrls: ['./plugin-contract-jobs-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    DropdownModule,
    IconModule,
    LayerModule,
    TagModule,
    CarbonListModule,
    PluginContractJobDetailModalComponent,
  ],
})
export class PluginContractJobsPageComponent implements OnInit, OnDestroy {
  @ViewChild('statusTpl', {static: true}) public statusTpl!: TemplateRef<unknown>;
  @ViewChild('createdAtTpl', {static: true}) public createdAtTpl!: TemplateRef<unknown>;
  @ViewChild('deadlineTpl', {static: true}) public deadlineTpl!: TemplateRef<unknown>;
  @ViewChild('attemptsTpl', {static: true}) public attemptsTpl!: TemplateRef<unknown>;
  @ViewChild('errorTpl', {static: true}) public errorTpl!: TemplateRef<unknown>;

  public fields: ColumnConfig[] = [];

  public readonly $loading = signal(true);
  public readonly $rows = signal<Array<ContractJobRow>>([]);
  public readonly $page = signal(1);
  public readonly $pagination = computed<Pagination>(() => ({
    page: this.$page(),
    size: this.PAGE_SIZE,
    collectionSize: this._$totalElements(),
  }));
  public readonly $selectedJobId = signal<string | null>(null);
  public readonly $detailOpen = signal(false);

  public readonly $statusItems = computed<Array<FilterListItem>>(() => {
    this._$lang();
    const selected = this._$statusFilter();
    return [
      this._allItem('pluginManagement.contractJobs.filterAll', !selected),
      ...EXTERNAL_PLUGIN_CONTRACT_JOB_STATUSES.map(status => ({
        content: this._translateService.instant(`pluginManagement.contractJobs.status.${status}`),
        selected: selected === status,
        value: status,
      })),
    ];
  });

  public readonly $configurationItems = computed<Array<FilterListItem>>(() => {
    this._$lang();
    const selected = this._$configurationFilter();
    return [
      this._allItem('pluginManagement.contractJobs.filterAllConfigurations', !selected),
      ...this._$configurations().map(configuration => ({
        content: configuration.title,
        selected: selected === configuration.id,
        value: configuration.id,
      })),
    ];
  });

  public readonly DATE_FORMAT = 'dd-MM-yyyy HH:mm';
  public readonly PAGE_SIZE = DEFAULT_PAGE_SIZE;
  public readonly paginatorConfig: CarbonPaginatorConfig = {
    itemsPerPageOptions: [DEFAULT_PAGE_SIZE],
    showPageInput: false,
  };

  protected readonly testIds = PLUGIN_CONTRACT_JOBS_PAGE_TEST_IDS;

  private _loadSubscription: Subscription | null = null;

  private readonly _$totalElements = signal(0);
  private readonly _$statusFilter = signal<ExternalPluginContractJobStatus | null>(null);
  private readonly _$configurationFilter = signal<string | null>(null);
  private readonly _$configurations = signal<Array<ExternalPluginConfiguration>>([]);
  private readonly _$lang = signal('');
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _translateService: TranslateService,
    private readonly _iconService: IconService,
    private readonly _route: ActivatedRoute,
    private readonly _router: Router
  ) {
    this._iconService.registerAll([Renew16]);
  }

  public ngOnInit(): void {
    this._initFields();
    this._$lang.set(this._translateService.currentLang ?? '');
    this._subscriptions.add(
      this._translateService.onLangChange.subscribe(({lang}) => this._$lang.set(lang))
    );
    this._subscriptions.add(
      this._route.queryParamMap.subscribe(params =>
        this._showJobFromQueryParam(params.get(JOB_ID_QUERY_PARAM))
      )
    );
    this._loadConfigurations();
    this._load();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._loadSubscription?.unsubscribe();
  }

  public onStatusSelected(event: {item?: FilterListItem}): void {
    this._$statusFilter.set((event?.item?.value as ExternalPluginContractJobStatus) || null);
    this._reloadFromFirstPage();
  }

  public onConfigurationSelected(event: {item?: FilterListItem}): void {
    this._$configurationFilter.set(event?.item?.value || null);
    this._reloadFromFirstPage();
  }

  public onPaginationClicked(page: number): void {
    this.$page.set(page);
    this._load();
  }

  public onRefresh(): void {
    this._load();
  }

  public onRowClicked(row: ContractJobRow): void {
    this._setJobIdQueryParam(row.id);
  }

  public onDetailClose(): void {
    this.$detailOpen.set(false);
    this._setJobIdQueryParam(null);
  }

  public onJobChanged(): void {
    this._load();
  }

  private _allItem(translationKey: string, selected: boolean): FilterListItem {
    return {content: this._translateService.instant(translationKey), selected, value: ''};
  }

  private _initFields(): void {
    this.fields = [
      {
        key: 'contract',
        label: 'pluginManagement.contractJobs.columns.contract',
        viewType: ViewType.TEXT,
      },
      {
        key: 'operation',
        label: 'pluginManagement.contractJobs.columns.operation',
        viewType: ViewType.TEXT,
      },
      {
        key: 'requesterTitle',
        label: 'pluginManagement.contractJobs.columns.requester',
        viewType: ViewType.TEXT,
      },
      {
        key: 'providerTitle',
        label: 'pluginManagement.contractJobs.columns.provider',
        viewType: ViewType.TEXT,
      },
      {
        key: 'status',
        label: 'pluginManagement.contractJobs.columns.status',
        viewType: ViewType.TEMPLATE,
        template: this.statusTpl,
      },
      {
        key: 'createdAt',
        label: 'pluginManagement.contractJobs.columns.createdAt',
        viewType: ViewType.TEMPLATE,
        template: this.createdAtTpl,
      },
      {
        key: 'deadline',
        label: 'pluginManagement.contractJobs.columns.deadline',
        viewType: ViewType.TEMPLATE,
        template: this.deadlineTpl,
      },
      {
        key: 'deliveryAttempts',
        label: 'pluginManagement.contractJobs.columns.attempts',
        viewType: ViewType.TEMPLATE,
        template: this.attemptsTpl,
      },
      {
        key: 'errorCode',
        label: 'pluginManagement.contractJobs.columns.error',
        viewType: ViewType.TEMPLATE,
        template: this.errorTpl,
      },
    ];
  }

  private _showJobFromQueryParam(jobId: string | null): void {
    if (!jobId) {
      this.$detailOpen.set(false);
      return;
    }

    this.$selectedJobId.set(jobId);
    this.$detailOpen.set(true);
  }

  private _setJobIdQueryParam(jobId: string | null): void {
    this._router.navigate([], {
      relativeTo: this._route,
      queryParams: {[JOB_ID_QUERY_PARAM]: jobId},
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private _loadConfigurations(): void {
    this._externalPluginService
      .getConfigurations()
      .subscribe(configurations =>
        this._$configurations.set(
          [...(configurations ?? [])].sort((a, b) => a.title.localeCompare(b.title))
        )
      );
  }

  private _reloadFromFirstPage(): void {
    this.$page.set(1);
    this._load();
  }

  private _load(): void {
    this._loadSubscription?.unsubscribe();
    this.$loading.set(true);
    this._loadSubscription = this._externalPluginService
      .getContractJobs({
        page: this.$page() - 1,
        size: this.PAGE_SIZE,
        status: this._$statusFilter() ?? undefined,
        configurationId: this._$configurationFilter() ?? undefined,
      })
      .subscribe({
        next: result => {
          const content = result?.content ?? [];
          // Spring's VIA_DTO page serialization nests the totals under `page`
          const totalElements = result?.totalElements ?? result?.['page']?.totalElements ?? 0;
          const lastPage = Math.max(1, Math.ceil(totalElements / this.PAGE_SIZE));

          // Jobs left the page since it was opened: purged, or moved out of the status filter
          if (content.length === 0 && this.$page() > lastPage) {
            this.$page.set(lastPage);
            this._load();
            return;
          }

          this.$rows.set(content.map(job => this._toRow(job)));
          this._$totalElements.set(totalElements);
          this.$loading.set(false);
        },
        error: () => {
          this.$rows.set([]);
          this._$totalElements.set(0);
          this.$loading.set(false);
        },
      });
  }

  private _toRow(job: ExternalPluginContractJobSummary): ContractJobRow {
    return {
      ...job,
      requesterTitle: job.requesterTitle ?? job.requesterConfigurationId,
      providerTitle: job.providerTitle ?? job.providerConfigurationId,
      statusTagType: contractJobStatusTagType(job.status),
      errorLabel: [job.errorCode, job.providerErrorCode].filter(code => !!code).join(' · '),
    };
  }
}
