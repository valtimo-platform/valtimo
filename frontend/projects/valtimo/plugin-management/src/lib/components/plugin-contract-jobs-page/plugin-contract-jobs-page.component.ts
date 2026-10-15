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
  OnDestroy,
  OnInit,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {CommonModule} from '@angular/common';
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
  ExternalPluginContractJobStatus,
  ExternalPluginContractJobSummary,
  ExternalPluginService,
} from '@valtimo/plugin';
import {Subscription} from 'rxjs';
import {PluginContractJobDetailModalComponent} from '../plugin-contract-job-detail-modal/plugin-contract-job-detail-modal.component';
import {PLUGIN_CONTRACT_JOBS_PAGE_TEST_IDS} from '../../constants';
import {contractJobStatusTagType} from '../../utils';

const DEFAULT_PAGE_SIZE = 10;

/**
 * The contract job ledger: every asynchronous request one plugin configuration made of another,
 * with its state, deadline and delivery attempts. Row click opens the request and result JSON.
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
  public page = 1;
  public statusItems: Array<Partial<ListItem>> = [];

  public readonly $loading = signal(true);
  public readonly $rows = signal<Array<ExternalPluginContractJobSummary>>([]);
  public readonly $selectedJobId = signal<string | null>(null);
  public readonly $detailOpen = signal(false);

  public readonly DATE_FORMAT = 'dd-MM-yyyy HH:mm';
  public readonly PAGE_SIZE = DEFAULT_PAGE_SIZE;
  public readonly paginatorConfig: CarbonPaginatorConfig = {
    itemsPerPageOptions: [DEFAULT_PAGE_SIZE],
    showPageInput: false,
  };

  protected readonly testIds = PLUGIN_CONTRACT_JOBS_PAGE_TEST_IDS;

  private _statusFilter: ExternalPluginContractJobStatus | null = null;
  private _loadSubscription: Subscription | null = null;
  private readonly _$totalElements = signal(0);
  private readonly _subscriptions = new Subscription();

  public get pagination(): Pagination {
    return {page: this.page, size: this.PAGE_SIZE, collectionSize: this._$totalElements()};
  }

  constructor(
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _translateService: TranslateService,
    private readonly _iconService: IconService
  ) {
    this._iconService.registerAll([Renew16]);
  }

  public ngOnInit(): void {
    this._initFields();
    this._buildStatusItems();
    this._subscriptions.add(
      this._translateService.onLangChange.subscribe(() => this._buildStatusItems())
    );
    this._load();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._loadSubscription?.unsubscribe();
  }

  public onStatusSelected(event: {item?: {value?: string}}): void {
    this._statusFilter = (event?.item?.value as ExternalPluginContractJobStatus) || null;
    this.page = 1;
    this._buildStatusItems();
    this._load();
  }

  public onPaginationClicked(page: number): void {
    this.page = page;
    this._load();
  }

  public onRefresh(): void {
    this._load();
  }

  public onRowClicked(row: ExternalPluginContractJobSummary): void {
    this.$selectedJobId.set(row.id);
    this.$detailOpen.set(true);
  }

  public onDetailClose(): void {
    this.$detailOpen.set(false);
  }

  public statusTagType(status: string): string {
    return contractJobStatusTagType(status);
  }

  private _buildStatusItems(): void {
    this.statusItems = [
      {
        content: this._translateService.instant('pluginManagement.contractJobs.filterAll'),
        selected: !this._statusFilter,
        value: '',
      },
      ...EXTERNAL_PLUGIN_CONTRACT_JOB_STATUSES.map(status => ({
        content: this._translateService.instant(`pluginManagement.contractJobs.status.${status}`),
        selected: this._statusFilter === status,
        value: status,
      })),
    ];
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

  private _load(): void {
    this._loadSubscription?.unsubscribe();
    this.$loading.set(true);
    this._loadSubscription = this._externalPluginService
      .getContractJobs({
        page: this.page - 1,
        size: this.PAGE_SIZE,
        status: this._statusFilter ?? undefined,
      })
      .subscribe({
        next: result => {
          this.$rows.set(
            (result?.content ?? []).map(job => ({
              ...job,
              requesterTitle: job.requesterTitle ?? job.requesterConfigurationId,
              providerTitle: job.providerTitle ?? job.providerConfigurationId,
            }))
          );
          // Spring's VIA_DTO page serialization nests the totals under `page`
          this._$totalElements.set(result?.totalElements ?? result?.['page']?.totalElements ?? 0);
          this.$loading.set(false);
        },
        error: () => {
          this.$rows.set([]);
          this._$totalElements.set(0);
          this.$loading.set(false);
        },
      });
  }
}
