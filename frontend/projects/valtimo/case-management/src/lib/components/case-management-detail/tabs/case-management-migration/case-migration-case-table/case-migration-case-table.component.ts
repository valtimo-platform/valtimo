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
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  Input,
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
  ViewType,
} from '@valtimo/components';
import {GlobalNotificationService} from '@valtimo/shared';
import {ChevronDown16, ChevronUp16, Copy16} from '@carbon/icons';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../../../constants';
import {MigrationExecutionError, MigrationExecutionWarning} from '../../../../../models';

/** The cases one run refused or warned about. Its page and expanded stacktraces are its own, so a fresh table starts on page 1 with nothing expanded. */
@Component({
  standalone: true,
  selector: 'valtimo-case-migration-case-table',
  templateUrl: './case-migration-case-table.component.html',
  styleUrls: ['./case-migration-case-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CarbonListModule, RouterModule, ButtonModule, IconModule, TranslateModule],
})
export class CaseMigrationCaseTableComponent implements AfterViewInit {
  @ViewChild('caseIdColumn') public caseIdColumnTemplate!: TemplateRef<unknown>;
  @ViewChild('errorColumn') public errorColumnTemplate!: TemplateRef<unknown>;

  /** An error carries a stacktrace to expand and copy; a warning is a sentence. */
  @Input() public kind: 'error' | 'warning' = 'error';

  /** Where a case's id links to. Null renders the id as plain text. */
  @Input() public caseDefinitionKey: string | null = null;

  /** Re-set by the list's poll while the modal is open; the page stays. */
  @Input() public set items(value: (MigrationExecutionError | MigrationExecutionWarning)[]) {
    this._$items.set(value ?? []);
  }

  // Pages client-side: the full list lives on the plan status.
  public readonly ERROR_PAGE_SIZE = 10;
  public readonly ERROR_PAGINATOR_CONFIG: CarbonPaginatorConfig = {
    itemsPerPageOptions: [this.ERROR_PAGE_SIZE],
    showPageInput: false,
  };

  public readonly $fields = signal<ColumnConfig[]>([]);
  public readonly $page = signal<number>(1);
  public readonly $view = computed(() => this.pageOf(this._$items(), this.$page()));

  protected readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;

  private readonly _$items = signal<(MigrationExecutionError | MigrationExecutionWarning)[]>([]);
  // Case ids whose full stacktrace is expanded. A new Set per change so the OnPush view re-renders.
  private readonly _$expanded = signal<ReadonlySet<string>>(new Set());

  constructor(
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([ChevronDown16, ChevronUp16, Copy16]);
  }

  // After view init, not on init: this signal write is the extra pass that lets the list drop its skeleton, which it only does once its own view is initialised.
  public ngAfterViewInit(): void {
    this.setFields();
  }

  public onPageChange(page: number): void {
    this.$page.set(page);
  }

  public isErrorExpanded(caseId: string): boolean {
    return this._$expanded().has(caseId);
  }

  public onToggleError(event: Event, caseId: string): void {
    event.stopPropagation();
    const expanded = new Set(this._$expanded());
    if (expanded.has(caseId)) {
      expanded.delete(caseId);
    } else {
      expanded.add(caseId);
    }
    this._$expanded.set(expanded);
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

  private setFields(): void {
    const caseIdColumn: ColumnConfig = {
      key: 'caseId',
      label: 'caseManagement.migration.errors.caseId',
      viewType: ViewType.TEMPLATE,
      template: this.caseIdColumnTemplate,
      className: 'migration-error__case-column',
    };

    this.$fields.set(
      this.kind === 'error'
        ? [
            caseIdColumn,
            {
              key: 'message',
              label: 'caseManagement.migration.errors.message',
              viewType: ViewType.TEMPLATE,
              template: this.errorColumnTemplate,
            },
          ]
        : // A warning is a sentence, not a stacktrace, so it needs no expand/collapse template.
          [
            caseIdColumn,
            {
              key: 'message',
              label: 'caseManagement.migration.warnings.message',
              viewType: ViewType.TEXT,
            },
          ]
    );
  }
}
