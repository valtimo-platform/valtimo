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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {DropdownButtonStyle, DropdownItem} from '../../models';

@Component({
  selector: 'valtimo-searchable-dropdown-select',
  templateUrl: './searchable-dropdown-select.component.html',
  styleUrls: ['./searchable-dropdown-select.component.scss'],
})
export class SearchableDropdownSelectComponent {
  @Input() style: DropdownButtonStyle;
  @Input() items: Array<DropdownItem>;
  @Input() buttonText: string;
  @Input() searchText: string;
  @Input() noResultsText: string;
  @Input() disabled: boolean;
  @Input() selectedText: string;
  @Input() selectedTextValue: string;
  @Input() clearSelectionButtonTitle: string;
  @Input() hasSelection: boolean;
  @Input() width = 250;
  @Input() hasPermission = true;
  @Input() showClearSelection = true;

  @Output() itemSelected = new EventEmitter();
  @Output() clearSelection = new EventEmitter();

  onSelect(id: string): void {
    this.itemSelected.emit(id);
  }

  onClearSelection(): void {
    this.clearSelection.emit();
  }
}
