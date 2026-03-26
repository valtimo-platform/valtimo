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
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {FormioCustomComponent} from '@valtimo/components';
import {ButtonModule} from 'carbon-components-angular';
import {IkoListComponent} from '../iko-list/iko-list.component';
import {IkoSearchComponent} from '../iko-search/iko-search.component';

@Component({
  selector: 'valtimo-iko-search-formio',
  standalone: true,
  imports: [CommonModule, IkoSearchComponent, IkoListComponent, ButtonModule, TranslateModule],
  templateUrl: './iko-search-formio.component.html',
  styleUrls: ['./iko-search-formio.component.scss'],
})
export class IkoSearchFormioComponent implements FormioCustomComponent<string> {
  @Input() disabled: boolean;
  @Input() ikoViewKey: string;
  @Input() label: string;
  @Output() valueChange = new EventEmitter<string>();

  searchParams: {paramKey: string; filters: Record<string, any>} | null = null;
  selectedLabel: string | null = null;

  private _value: string;

  @Input() set value(val: string) {
    this._value = val;
  }

  get value(): string {
    return this._value;
  }

  onSearchSubmit(event: {paramKey: string; filters: Record<string, any>}): void {
    this.searchParams = event;
  }

  onRowSelected(item: {id: string; label: string}): void {
    this._value = item.id;
    this.selectedLabel = item.label;
    this.valueChange.emit(item.id);
  }

  backToList(): void {
    this.selectedLabel = null;
    this._value = null;
    this.valueChange.emit(null);
  }

  backToSearch(): void {
    this.searchParams = null;
    this.selectedLabel = null;
    this._value = null;
    this.valueChange.emit(null);
  }
}
