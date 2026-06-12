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
import {ButtonModule, IconModule, IconService, LayerModule} from 'carbon-components-angular';
import {Launch16} from '@carbon/icons';
import {IkoRowSelectedEvent, IkoSearchFormioValue, IkoSearchParams, PropertyMapping} from '../../models';
import {IkoListComponent} from '../iko-list/iko-list.component';
import {IkoSearchComponent} from '../iko-search/iko-search.component';

@Component({
  selector: 'valtimo-iko-search-formio',
  standalone: true,
  imports: [
    CommonModule,
    IkoSearchComponent,
    IkoListComponent,
    ButtonModule,
    IconModule,
    TranslateModule,
    LayerModule,
  ],
  templateUrl: './iko-search-formio.component.html',
  styleUrls: ['./iko-search-formio.component.scss'],
})
export class IkoSearchFormioComponent implements FormioCustomComponent<IkoSearchFormioValue> {
  @Input() public disabled: boolean;
  @Input() public ikoViewKey: string;
  @Input() public label: string;
  @Input() public resultListLabel: string;
  @Input() public selectedLabel: string;
  @Input() public openInNewTabLabel: string;
  @Input() public openInNewTabUrl: string;
  @Input() public propertyMappings: PropertyMapping[];

  @Input() public set value(val: IkoSearchFormioValue) {
    this._value = val;
  }

  public get value(): IkoSearchFormioValue {
    return this._value;
  }

  @Output() public valueChange = new EventEmitter<IkoSearchFormioValue>();

  public searchParams: IkoSearchParams | null = null;
  public selectedItemLabel: string | null = null;

  private _value: IkoSearchFormioValue;

  constructor(private readonly iconService: IconService) {
    this.iconService.register(Launch16);
  }

  public onSearchSubmit(event: IkoSearchParams): void {
    this.searchParams = event;
  }

  public onRowSelected(item: IkoRowSelectedEvent): void {
    const resolved = this.resolvePropertyMappings(item.rowData);
    this._value = {id: item.id, ...resolved};
    this.selectedItemLabel = item.label;
    this.valueChange.emit(this._value);
  }

  public onOpenInNewTab(): void {
    if (this.openInNewTabUrl && this._value?.id) {
      const url = this.openInNewTabUrl.replace('{id}', this._value.id);
      window.open(url, '_blank');
    }
  }

  public backToList(): void {
    this.selectedItemLabel = null;
    this._value = null;
    this.valueChange.emit(null);
  }

  public backToSearch(): void {
    this.searchParams = null;
    this.selectedItemLabel = null;
    this._value = null;
    this.valueChange.emit(null);
  }

  private resolvePropertyMappings(rowData: Record<string, any>): Record<string, any> {
    if (!this.propertyMappings?.length) return {};

    const resolved: Record<string, any> = {};
    for (const mapping of this.propertyMappings) {
      if (mapping.propertyName && mapping.ikoProperty) {
        resolved[mapping.propertyName] = rowData[mapping.ikoProperty] ?? null;
      }
    }
    return resolved;
  }
}
