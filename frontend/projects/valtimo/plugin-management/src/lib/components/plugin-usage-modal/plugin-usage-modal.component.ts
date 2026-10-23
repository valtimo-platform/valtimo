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
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  LinkModule,
  ModalModule,
  StructuredListModule,
  TagModule,
} from 'carbon-components-angular';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {
  EXTERNAL_PLUGIN_HOST_USAGE_PARENT_TYPES,
  ExternalPluginHostUsage,
  ExternalPluginHostUsageParentType,
} from '@valtimo/plugin';
import {PLUGIN_USAGE_MODAL_TEST_IDS} from '../../constants';

interface PluginUsageRow extends ExternalPluginHostUsage {
  /** Unique within the list; the row's track-by identity and test id suffix. */
  key: string;
  /** Null for a type this UI does not know; the raw type is shown instead. */
  typeLabelKey: string | null;
  typeTagColor: string;
  contractKindKey: string | null;
}

const CONTRACT_JOBS_ROUTE = '/plugin-contract-jobs';

/**
 * Read-only modal shown when an admin tries to delete an external plugin entity (a host or a
 * configuration) that is still in use: by BPMN process links, case tabs, case widgets,
 * building-block mappings, menu pages, contract bindings or open contract jobs. The list mirrors
 * the `usages` payload the backend attaches to a 409 from the corresponding `DELETE` endpoint; only
 * "Close" is offered — there is no force-delete. An open contract job links to its details.
 *
 * The parent supplies the heading + description translation keys so the same modal can be
 * reused for hosts and configurations.
 */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-usage-modal',
  templateUrl: './plugin-usage-modal.component.html',
  styleUrls: ['./plugin-usage-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    ModalModule,
    ButtonModule,
    LinkModule,
    StructuredListModule,
    TagModule,
    ValtimoCdsModalDirective,
  ],
})
export class PluginUsageModalComponent implements OnChanges {
  @Input() public open = false;
  @Input() public titleTranslationKey = '';
  @Input() public descriptionTranslationKey = '';
  @Input() public entityName: string | null = null;
  @Input() public usages: Array<ExternalPluginHostUsage> | null = [];

  @Output() public closeEvent = new EventEmitter<void>();

  public readonly $rows = signal<Array<PluginUsageRow>>([]);

  public readonly CONTRACT_JOBS_ROUTE = CONTRACT_JOBS_ROUTE;

  protected readonly testIds = PLUGIN_USAGE_MODAL_TEST_IDS;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['usages']) {
      this.$rows.set((this.usages ?? []).map((usage, index) => this._toRow(usage, index)));
    }
  }

  public onClose(): void {
    this.closeEvent.emit();
  }

  public trackByKey(_index: number, row: PluginUsageRow): string {
    return row.key;
  }

  private _toRow(usage: ExternalPluginHostUsage, index: number): PluginUsageRow {
    return {
      ...usage,
      key: this._usageKey(usage, index),
      typeLabelKey: this._typeLabelKey(usage.parentType),
      typeTagColor: this._typeTagColor(usage.parentType),
      contractKindKey: this._contractKindKey(usage.parentType),
    };
  }

  private _usageKey(usage: ExternalPluginHostUsage, index: number): string {
    if (usage.processLinkId) return usage.processLinkId;
    if (usage.widgetKey) return `widget-${usage.parentKey}-${usage.tabKey}-${usage.widgetKey}`;
    if (usage.tabKey) return `tab-${usage.parentKey}-${usage.tabKey}`;
    // A menu page has no case or process; the configuration plus the item's title tell it apart
    if (usage.menuItemTitle) return `page-${usage.configurationId}-${usage.menuItemTitle}`;
    if (usage.buildingBlockKey) {
      return `bb-${usage.parentKey}-${usage.buildingBlockKey}-${usage.configurationId}`;
    }
    // A host lists a job between two of its configurations once per party
    if (usage.parentType === 'CONTRACT_JOB' && usage.contractJobId) {
      return `contract-job-${usage.contractJobId}-${usage.configurationId}`;
    }
    // A configuration binds each contract at most once
    if (usage.parentType === 'CONTRACT_BINDING') {
      return `contract-binding-${usage.contract ?? usage.parentKey}-${usage.relatedConfigurationId}`;
    }
    return `${usage.parentType}-${usage.configurationId}-${index}`;
  }

  private _typeLabelKey(parentType: ExternalPluginHostUsageParentType): string | null {
    return (EXTERNAL_PLUGIN_HOST_USAGE_PARENT_TYPES as ReadonlyArray<string>).includes(parentType)
      ? `pluginManagement.usageModal.parentType.${parentType}`
      : null;
  }

  private _typeTagColor(parentType: ExternalPluginHostUsageParentType): string {
    switch (parentType) {
      case 'CASE':
        return 'blue';
      case 'BUILDING_BLOCK':
        return 'purple';
      case 'CONTRACT_BINDING':
        return 'teal';
      case 'CONTRACT_JOB':
        return 'cyan';
      case 'GLOBAL':
      default:
        return 'cool-gray';
    }
  }

  private _contractKindKey(parentType: ExternalPluginHostUsageParentType): string | null {
    switch (parentType) {
      case 'CONTRACT_BINDING':
        return 'pluginManagement.usageModal.contractBinding';
      case 'CONTRACT_JOB':
        return 'pluginManagement.usageModal.contractJob';
      default:
        return null;
    }
  }
}
