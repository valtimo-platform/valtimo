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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  ModalModule,
  StructuredListModule,
  TagModule,
} from 'carbon-components-angular';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ExternalPluginHostUsage, ExternalPluginHostUsageParentType} from '@valtimo/plugin';

/**
 * Read-only modal shown when an admin tries to delete an external plugin entity (a host or a
 * configuration) that is still referenced by one or more BPMN process links. The list mirrors
 * the `usages` payload the backend would attach to a 409 from the corresponding `DELETE`
 * endpoint; only "Close" is offered — there is no force-delete.
 *
 * The parent supplies the heading + description translation keys so the same modal can be
 * reused for hosts and configurations (and any future entity with the same usage shape).
 */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-usage-modal',
  templateUrl: './plugin-usage-modal.component.html',
  styleUrls: ['./plugin-usage-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    StructuredListModule,
    TagModule,
    ValtimoCdsModalDirective,
  ],
})
export class PluginUsageModalComponent {
  @Input() public open = false;
  @Input() public titleTranslationKey = '';
  @Input() public descriptionTranslationKey = '';
  @Input() public entityName: string | null = null;
  @Input() public usages: Array<ExternalPluginHostUsage> = [];

  @Output() public closeEvent = new EventEmitter<void>();

  public onClose(): void {
    this.closeEvent.emit();
  }

  public trackByProcessLink(_index: number, usage: ExternalPluginHostUsage): string {
    return usage.processLinkId;
  }

  public parentTypeTagColor(parentType: ExternalPluginHostUsageParentType): string {
    switch (parentType) {
      case 'CASE':
        return 'blue';
      case 'BUILDING_BLOCK':
        return 'purple';
      case 'GLOBAL':
      default:
        return 'cool-gray';
    }
  }
}
