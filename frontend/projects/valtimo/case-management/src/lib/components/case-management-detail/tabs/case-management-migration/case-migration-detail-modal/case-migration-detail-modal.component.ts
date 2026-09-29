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
  Component,
  computed,
  EventEmitter,
  Input,
  Output,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {RouterModule} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CarbonListModule,
  CarbonPaginatorConfig,
  ColumnConfig,
  Pagination,
  ValtimoCdsModalDirective,
  ViewType,
} from '@valtimo/components';
import {GlobalNotificationService} from '@valtimo/shared';
import {ChevronDown16, ChevronUp16, Copy16} from '@carbon/icons';
import {
  ButtonModule,
  IconModule,
  IconService,
  ModalModule,
  TagModule,
} from 'carbon-components-angular';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../../../constants';
import {MigrationPlanViewModel} from '../../../../../models';
import {migrationStatusTagType} from '@valtimo/building-block-management';

/** One plan's run: what it migrated, what it refused, and the same again for its latest dry run. Its paging and expanded stacktraces are its own — the list behind it only says which plan to show. */
@Component({
  standalone: true,
  selector: 'valtimo-case-migration-detail-modal',
  templateUrl: './case-migration-detail-modal.component.html',
  styleUrls: ['./case-migration-detail-modal.component.scss'],
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
  ],
})
export class CaseMigrationDetailModalComponent implements AfterViewInit {
  @ViewChild('caseIdColumn') public caseIdColumnTemplate!: TemplateRef<unknown>;
  @ViewChild('errorColumn') public errorColumnTemplate!: TemplateRef<unknown>;

  @Input() public open = false;
  /** Where a failed case's id links to. Null renders the id as plain text. */
  @Input() public caseDefinitionKey: string | null = null;

  /** The plan on show. Kept live by the list's poll, so this is re-set on every refresh — paging only resets when it is a different plan. */
  @Input() public set plan(value: MigrationPlanViewModel | null) {
    if (value?.migrationKey !== this.$plan()?.migrationKey) this.resetPaging();
    this.$plan.set(value);
  }

  @Output() public readonly closeEvent = new EventEmitter<void>();
  @Output() public readonly startEvent = new EventEmitter<MigrationPlanViewModel>();
  @Output() public readonly dryRunEvent = new EventEmitter<MigrationPlanViewModel>();

  // The failed-cases tables page client-side: the full lists live on the plan status.
  public readonly ERROR_PAGE_SIZE = 10;
  public readonly ERROR_PAGINATOR_CONFIG: CarbonPaginatorConfig = {
    itemsPerPageOptions: [this.ERROR_PAGE_SIZE],
    showPageInput: false,
  };

  public readonly $plan = signal<MigrationPlanViewModel | null>(null);
  public readonly $errorFields = signal<ColumnConfig[]>([]);
  public readonly $warningFields = signal<ColumnConfig[]>([]);

  public readonly $errorsView = computed(() =>
    this.pageOf(this.$plan()?.status.errors ?? [], this.$errorPage())
  );
  public readonly $warningsView = computed(() =>
    this.pageOf(this.$plan()?.status.warnings ?? [], this.$warningPage())
  );
  public readonly $dryRunErrorsView = computed(() =>
    this.pageOf(this.$plan()?.dryRun.errors ?? [], this.$dryRunErrorPage())
  );
  public readonly $dryRunWarningsView = computed(() =>
    this.pageOf(this.$plan()?.dryRun.warnings ?? [], this.$dryRunWarningPage())
  );

  public readonly $errorPage = signal<number>(1);
  public readonly $warningPage = signal<number>(1);
  public readonly $dryRunErrorPage = signal<number>(1);
  public readonly $dryRunWarningPage = signal<number>(1);

  // Case ids whose full stacktrace is expanded. A new Set per change so the OnPush view re-renders.
  private readonly _$expandedErrors = signal<ReadonlySet<string>>(new Set());

  protected readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;
  protected readonly statusTagType = migrationStatusTagType;

  constructor(
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([ChevronDown16, ChevronUp16, Copy16]);
  }

  public ngAfterViewInit(): void {
    this.setFields();
  }

  public onClose(): void {
    this.closeEvent.emit();
  }

  public onErrorPageChange(page: number): void {
    this.$errorPage.set(page);
  }

  public onWarningPageChange(page: number): void {
    this.$warningPage.set(page);
  }

  public onDryRunPageChange(page: number): void {
    this.$dryRunErrorPage.set(page);
  }

  public onDryRunWarningPageChange(page: number): void {
    this.$dryRunWarningPage.set(page);
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

  public onCopyError(event: Event, message: string | null): void {
    event.stopPropagation();
    if (!message) return;

    navigator.clipboard?.writeText(message);
    this.globalNotificationService.showToast({
      title: this.translateService.instant('caseManagement.migration.errors.copied'),
      type: 'success',
    });
  }

  // Null when no case route applies; the id then renders as plain text.
  public caseDetailLink(caseId: string): string[] | null {
    if (!this.caseDefinitionKey || !caseId) return null;
    return ['/cases', this.caseDefinitionKey, 'document', caseId];
  }

  public shortId(id: string): string {
    return id ? `${id.slice(0, 8)}…` : '-';
  }

  /** The server's own summary — the rule that refused the case. Its first stacktrace line is only the wrapper around that. */
  public errorSummary(error: {summary?: string | null; message: string | null}): string {
    return error.summary?.trim() || error.message?.split('\n')[0].trim() || '-';
  }

  private pageOf<T>(items: T[], page: number): {items: T[]; pagination: Pagination} {
    const start = (page - 1) * this.ERROR_PAGE_SIZE;
    return {
      items: items.slice(start, start + this.ERROR_PAGE_SIZE),
      pagination: {page, size: this.ERROR_PAGE_SIZE, collectionSize: items.length},
    };
  }

  private resetPaging(): void {
    this.$errorPage.set(1);
    this.$warningPage.set(1);
    this.$dryRunErrorPage.set(1);
    this.$dryRunWarningPage.set(1);
    this._$expandedErrors.set(new Set());
  }

  private setFields(): void {
    this.$errorFields.set([
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
    this.$warningFields.set([
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
