/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {Component, EventEmitter, Input, Output, ViewEncapsulation} from '@angular/core';
import {MenuItem} from '@valtimo/config';

@Component({
  selector: 'valtimo-menu-item-text',
  templateUrl: './menu-item-text.component.html',
  styleUrls: ['./menu-item-text.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class MenuItemTextComponent {
  @Input() menuItem: MenuItem;
  @Input() accent = false;
  @Input() showOverFlowMenu = false;
  @Output() overflowMenuClosed = new EventEmitter<any>();
  @Output() openInNewTab = new EventEmitter<any>();

  public onOpenChange(open: boolean): void {
    if (!open) {
      this.overflowMenuClosed.emit();
    }
  }

  public onSelectOpenInNewTab(): void {
    this.openInNewTab.emit();
  }
}
