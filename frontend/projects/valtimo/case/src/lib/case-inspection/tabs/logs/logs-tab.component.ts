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

import {CommonModule, DatePipe} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  signal,
  SimpleChanges,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {FormBuilder, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {Page} from '@valtimo/shared';
import {
  ButtonModule,
  DatePicker,
  DatePickerModule,
  DropdownModule,
  IconModule,
  InputModule,
  LayerModule,
  ListItem,
  LoadingModule,
  TagModule,
} from 'carbon-components-angular';
import {
  CASE_INSPECTION_LOG_LEVEL_TAG,
  CaseInspectionLoggingEvent,
  CaseInspectionLogLevel,
  CaseInspectionLogSearchRequest,
} from '../../../models/';
import {CaseInspectionService} from '../../../services';

const PROCESS_INSTANCE_MDC_KEY = 'processInstanceId';

@Component({
  standalone: true,
  selector: 'valtimo-case-inspection-logs',
  templateUrl: './logs-tab.component.html',
  styleUrl: './logs-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    CarbonListModule,
    DatePickerModule,
    DropdownModule,
    IconModule,
    InputModule,
    TagModule,
    LoadingModule,
    LayerModule,
  ],
})
export class CaseInspectionLogsTabComponent implements OnInit, AfterViewInit, OnChanges {
  @ViewChild('afterPicker') private readonly _afterDatePicker?: DatePicker;
  @ViewChild('beforePicker') private readonly _beforeDatePicker?: DatePicker;
  @ViewChild('timestampTemplate') public timestampTemplate!: TemplateRef<any>;
  @ViewChild('levelTemplate') public levelTemplate!: TemplateRef<any>;
  @ViewChild('messageTemplate') public messageTemplate!: TemplateRef<any>;

  @Input() public documentId!: string;
  @Input() public pendingProcessInstanceId: string | null = null;

  public readonly $loading = signal<boolean>(true);
  public readonly $errorMessage = signal<string | null>(null);
  public readonly $rows = signal<CaseInspectionLoggingEvent[]>([]);
  public readonly $selected = signal<CaseInspectionLoggingEvent | null>(null);
  public readonly $selectedIndex = signal<number>(0);
  public readonly $page = signal<number>(1);
  public readonly $totalElements = signal<number>(0);
  public readonly $activeProcessInstanceFilter = signal<string | null>(null);
  public readonly $hasActiveSearch = signal<boolean>(false);

  public readonly pageSize = 10;

  public readonly LEVEL_TAG = CASE_INSPECTION_LOG_LEVEL_TAG;

  public fields: ColumnConfig[] = [];

  public get pagination() {
    return {
      page: this.$page(),
      size: this.pageSize,
      collectionSize: this.$totalElements(),
    };
  }

  public readonly logLevelItems: ListItem[] = [
    {content: CaseInspectionLogLevel.ERROR, selected: false},
    {content: CaseInspectionLogLevel.WARN, selected: false},
    {content: CaseInspectionLogLevel.INFO, selected: false},
    {content: CaseInspectionLogLevel.DEBUG, selected: false},
    {content: CaseInspectionLogLevel.TRACE, selected: false},
  ];

  public readonly formGroup = this.fb.group({
    likeFormattedMessage: this.fb.control<string>(''),
    level: this.fb.control<ListItem | null>(null),
    afterTimestamp: this.fb.control<string>(''),
    beforeTimestamp: this.fb.control<string>(''),
  });

  constructor(
    private readonly caseInspectionService: CaseInspectionService,
    private readonly fb: FormBuilder
  ) {}

  public ngOnInit(): void {
    this.applyPendingProcessInstanceFilter();
    this.load();
  }

  public ngAfterViewInit(): void {
    this.fields = [
      {
        viewType: ViewType.TEMPLATE,
        key: 'timestamp',
        label: 'case.inspection.logs.columns.timestamp',
        template: this.timestampTemplate,
      },
      {
        viewType: ViewType.TEMPLATE,
        key: 'level',
        label: 'case.inspection.logs.columns.level',
        template: this.levelTemplate,
      },
      {
        viewType: ViewType.TEMPLATE,
        key: 'formattedMessage',
        label: 'case.inspection.logs.columns.message',
        template: this.messageTemplate,
      },
    ];
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.documentId && !changes.documentId.firstChange && this.documentId) {
      this.$page.set(1);
      this.applyPendingProcessInstanceFilter();
      this.load();
      return;
    }
    if (changes.pendingProcessInstanceId && !changes.pendingProcessInstanceId.firstChange) {
      this.$page.set(1);
      this.applyPendingProcessInstanceFilter();
      this.load();
    }
  }

  public onAfterDateSelected(event: Date[]): void {
    const value = event[0] ? event[0].toISOString() : '';
    this.formGroup.get('afterTimestamp')?.setValue(value);
  }

  public onBeforeDateSelected(event: Date[]): void {
    const value = event[0] ? event[0].toISOString() : '';
    this.formGroup.get('beforeTimestamp')?.setValue(value);
  }

  public onApplyFilter(): void {
    this.$page.set(1);
    this.load();
  }

  public onResetFilter(): void {
    this.formGroup.reset({
      likeFormattedMessage: '',
      level: null,
      afterTimestamp: '',
      beforeTimestamp: '',
    });
    this._afterDatePicker?.writeValue([]);
    this._beforeDatePicker?.writeValue([]);
    this.$page.set(1);
    this.load();
  }

  public onClearProcessInstanceFilter(): void {
    this.$activeProcessInstanceFilter.set(null);
    this.$page.set(1);
    this.load();
  }

  public onSelectRow(row: CaseInspectionLoggingEvent): void {
    this.$selected.set(row);
    const index = this.$rows().indexOf(row);
    this.$selectedIndex.set(index >= 0 ? index : 0);
  }

  public isSelected(row: CaseInspectionLoggingEvent): boolean {
    return this.$selected() === row;
  }

  public onPageSelected(page: number): void {
    this.$page.set(page);
    this.load();
  }

  public buildPaginationModel(): {
    currentPage: number;
    totalDataLength: number;
    pageLength: number;
  } {
    return {
      currentPage: this.$page(),
      totalDataLength: this.$totalElements(),
      pageLength: this.pageSize,
    };
  }

  private applyPendingProcessInstanceFilter(): void {
    this.$activeProcessInstanceFilter.set(this.pendingProcessInstanceId ?? null);
  }

  private buildSearchRequest(): CaseInspectionLogSearchRequest {
    const value = this.formGroup.getRawValue();
    const request: CaseInspectionLogSearchRequest = {};

    if (value.likeFormattedMessage) {
      request.likeFormattedMessage = value.likeFormattedMessage;
    }
    if (value.level?.content) {
      request.level = String(value.level.content);
    }
    if (value.afterTimestamp) {
      request.afterTimestamp = value.afterTimestamp;
    }
    if (value.beforeTimestamp) {
      request.beforeTimestamp = value.beforeTimestamp;
    }

    const processInstance = this.$activeProcessInstanceFilter();
    if (processInstance) {
      request.additionalProperties = [{key: PROCESS_INSTANCE_MDC_KEY, value: processInstance}];
    }

    this.$hasActiveSearch.set(this.computeHasActiveSearch(request));

    return request;
  }

  private computeHasActiveSearch(request: CaseInspectionLogSearchRequest): boolean {
    return !!(
      request.likeFormattedMessage ||
      request.level ||
      request.afterTimestamp ||
      request.beforeTimestamp ||
      request.additionalProperties?.length
    );
  }

  private load(): void {
    if (!this.documentId) return;

    this.$loading.set(true);
    this.$errorMessage.set(null);

    const request = this.buildSearchRequest();

    this.caseInspectionService
      .searchCaseLogs(this.documentId, request, this.$page() - 1, this.pageSize)
      .subscribe({
        next: (page: Page<CaseInspectionLoggingEvent>) => {
          this.$rows.set(page.content);
          this.$totalElements.set(page.totalElements);
          this.$selected.set(page.content[0] ?? null);
          this.$selectedIndex.set(0);
          this.$loading.set(false);
        },
        error: err => {
          this.$errorMessage.set(err?.error?.message ?? err?.message ?? 'Failed to load logs');
          this.$rows.set([]);
          this.$totalElements.set(0);
          this.$loading.set(false);
        },
      });
  }
}
