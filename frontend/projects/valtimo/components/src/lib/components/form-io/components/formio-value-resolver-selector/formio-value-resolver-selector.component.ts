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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormioCustomComponent} from '../../../../modules';
import {CommonModule} from '@angular/common';
import {ValuePathSelectorComponent} from '../../../value-path-selector/value-path-selector.component';
import {ValuePathSelectorPrefix} from '../../../../models';
import {BehaviorSubject, map} from 'rxjs';
import {formioParams$} from '../form-io-builder/form-io-builder.utils';
import {InputModule, LayerModule} from 'carbon-components-angular';
import {filter} from 'rxjs/operators';

@Component({
  selector: 'valtimo-formio-value-resolver-selector',
  templateUrl: './formio-value-resolver-selector.component.html',
  standalone: true,
  imports: [CommonModule, ValuePathSelectorComponent, LayerModule, InputModule],
})
export class FormioValueResolverSelectorComponent implements FormioCustomComponent<string> {
  @Input() public readonly disabled: boolean;
  @Input() public label = '';
  @Input() public resolverType: 'source' | 'target' = 'source';
  @Output() public readonly valueChange = new EventEmitter<string>();

  public readonly defaultValue$ = new BehaviorSubject<string>('');
  public readonly context$ = formioParams$.pipe(map(params => params?.context));
  public readonly caseDefinitionKey$ = formioParams$.pipe(
    filter(params => !!params),
    map(params => params?.caseDefinitionKey));
  public readonly caseDefinitionVersionTag$ = formioParams$.pipe(
    filter(params => !!params),
    map(params => params?.caseDefinitionVersionTag)
  );
  public readonly buildingBlockDefinitionKey$ = formioParams$.pipe(
    filter(params => !!params),
    map(params => params?.buildingBlockDefinitionKey)
  );
  public readonly buildingBlockDefinitionVersionTag$ = formioParams$.pipe(
    filter(params => !!params),
    map(params => params?.buildingBlockDefinitionVersionTag)
  );
  public readonly isIndependentContext$ = this.context$.pipe(
    map(context => context !== 'case' && context !== 'buildingBlock')
  );
  private _value!: string;
  @Input() public set value(value: string) {
    if (!value) return;
    this.defaultValue$.next(value);
    this._value = value;
  }

  public get value(): string {
    return this._value;
  }

  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;

  public onValueChange(value: string): void {
    if (value !== this._value) {
      this._value = value;
      this.valueChange.emit(value);
    }
  }
}
