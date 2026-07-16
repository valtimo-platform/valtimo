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
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {CommonModule, DatePipe} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  IconService,
  LayerModule,
  ModalModule,
  TagModule,
} from 'carbon-components-angular';
import {Close16} from '@carbon/icons';
import {
  CarbonListModule,
  CarbonPaginatorConfig,
  ColumnConfig,
  Pagination,
  ValtimoCdsModalDirective,
  ViewType,
} from '@valtimo/components';
import {ExternalPluginService, PluginLogEntry} from '@valtimo/plugin';
import {ListItem} from 'carbon-components-angular';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  standalone: true,
  selector: 'valtimo-plugin-log-modal',
  templateUrl: './plugin-log-modal.component.html',
  styleUrls: ['./plugin-log-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    DropdownModule,
    LayerModule,
    TagModule,
    CarbonListModule,
    IconModule,
    ValtimoCdsModalDirective,
    DatePipe,
  ],
})
export class PluginLogModalComponent implements OnChanges {
  @Input() public open = false;
  @Input() public configurationId: string | null = null;
  @Input() public configurationTitle: string = '';

  @Output() public closeModal = new EventEmitter<void>();

  @ViewChild('timestampTpl', {static: true}) public timestampTpl!: TemplateRef<any>;
  @ViewChild('levelTpl', {static: true}) public levelTpl!: TemplateRef<any>;
  @ViewChild('sourceTpl', {static: true}) public sourceTpl!: TemplateRef<any>;

  public readonly _$loading = signal(false);
  public readonly _$rows = signal<PluginLogEntry[]>([]);
  public readonly _$selectedRow = signal<PluginLogEntry | null>(null);
  public readonly _$totalElements = signal(0);

  public fields: ColumnConfig[] = [];
  public page = 1;
  public pageSize = DEFAULT_PAGE_SIZE;

  public readonly paginatorConfig: CarbonPaginatorConfig = {
    itemsPerPageOptions: [DEFAULT_PAGE_SIZE],
    showPageInput: false,
  };

  public levelItems: Partial<ListItem>[] = [];
  public sourceItems: Partial<ListItem>[] = [];

  private _levelFilter = '';
  private _sourceFilter = '';

  private readonly _externalPluginService = inject(ExternalPluginService);
  private readonly _iconService = inject(IconService);
  private readonly _cdr = inject(ChangeDetectorRef);

  constructor() {
    this._iconService.register(Close16);
  }

  public get pagination(): Pagination {
    return {
      page: this.page,
      size: this.pageSize,
      collectionSize: this._$totalElements(),
    };
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open && this.configurationId) {
      this._initFields();
      this._resetFilters();
      this._$selectedRow.set(null);
      this._loadLogs();
    }
  }

  public onClose(): void {
    this.closeModal.emit();
  }

  public onPaginationClicked(page: number): void {
    this.page = page;
    this._loadLogs();
  }

  public onRowClicked(row: PluginLogEntry): void {
    this._$selectedRow.set(row);
    this._cdr.markForCheck();
  }

  public onLevelSelected(event: {item: {value: string}}): void {
    this._levelFilter = event?.item?.value ?? '';
    this.page = 1;
    this._loadLogs();
  }

  public onSourceSelected(event: {item: {value: string}}): void {
    this._sourceFilter = event?.item?.value ?? '';
    this.page = 1;
    this._loadLogs();
  }

  public closeDetail(): void {
    this._$selectedRow.set(null);
  }

  public levelTagType(level: string): string {
    switch (level) {
      case 'info': return 'blue';
      case 'warn': return 'warm-gray';
      case 'error': return 'red';
      case 'debug': return 'cool-gray';
      default: return 'warm-gray';
    }
  }

  public sourceTagType(source: string): string {
    switch (source) {
      case 'plugin': return 'purple';
      case 'gzac_api': return 'teal';
      case 'http_request': return 'cyan';
      default: return 'warm-gray';
    }
  }

  public formatData(data: unknown): string {
    if (!data) return '';
    return JSON.stringify(data, null, 2);
  }

  private _resetFilters(): void {
    this._levelFilter = '';
    this._sourceFilter = '';
    this.page = 1;
    this.pageSize = DEFAULT_PAGE_SIZE;

    this.levelItems = [
      {content: 'All', selected: true, value: ''},
      {content: 'Info', selected: false, value: 'info'},
      {content: 'Warn', selected: false, value: 'warn'},
      {content: 'Error', selected: false, value: 'error'},
      {content: 'Debug', selected: false, value: 'debug'},
    ];

    this.sourceItems = [
      {content: 'All', selected: true, value: ''},
      {content: 'Plugin', selected: false, value: 'plugin'},
      {content: 'GZAC API', selected: false, value: 'gzac_api'},
      {content: 'HTTP Request', selected: false, value: 'http_request'},
    ];
  }

  private _initFields(): void {
    this.fields = [
      {key: 'createdAt', label: 'pluginManagement.logs.columns.timestamp', viewType: ViewType.TEMPLATE, template: this.timestampTpl},
      {key: 'level', label: 'pluginManagement.logs.columns.level', viewType: ViewType.TEMPLATE, template: this.levelTpl},
      {key: 'source', label: 'pluginManagement.logs.columns.source', viewType: ViewType.TEMPLATE, template: this.sourceTpl},
      {key: 'message', label: 'pluginManagement.logs.columns.message', viewType: ViewType.TEXT},
    ];
  }

  private _loadLogs(): void {
    if (!this.configurationId) return;
    this._$loading.set(true);
    this._externalPluginService
      .getConfigurationLogs(this.configurationId, {
        page: this.page - 1,
        size: this.pageSize,
        level: this._levelFilter || undefined,
        source: this._sourceFilter || undefined,
      })
      .subscribe({
        next: result => {
          this._$rows.set(result.content);
          this._$totalElements.set(result.totalElements);
          this._$loading.set(false);
        },
        error: () => {
          this._$rows.set([]);
          this._$totalElements.set(0);
          this._$loading.set(false);
        },
      });
  }
}
