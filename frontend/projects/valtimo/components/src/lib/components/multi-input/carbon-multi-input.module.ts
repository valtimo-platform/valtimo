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

import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CarbonMultiInputComponent} from './carbon-multi-input.component';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule as CarbonButtonModule,
  DropdownModule,
  IconModule,
  InputModule as CarbonInputModule,
} from 'carbon-components-angular';
import {ButtonModule} from '../button/button.module';
import {InputLabelModule} from '../input-label/input-label.module';
import {InputModule} from '../input/input.module';
import {
  ArbitraryAmountValueComponent,
  KeyDropdownValueComponent,
  KeyValueComponent,
  KeyValuePathSelectorComponent,
  SingleValueComponent,
} from './components';
import {ValuePathSelectorValueComponent} from './components/value-path-selector-value';

@NgModule({
  declarations: [CarbonMultiInputComponent],
  imports: [
    CommonModule,
    InputLabelModule,
    InputModule,
    ButtonModule,
    TranslateModule,
    CarbonButtonModule,
    IconModule,
    CarbonInputModule,
    DropdownModule,
    KeyValueComponent,
    SingleValueComponent,
    KeyDropdownValueComponent,
    ArbitraryAmountValueComponent,
    KeyValuePathSelectorComponent,
    ValuePathSelectorValueComponent,
  ],
  exports: [CarbonMultiInputComponent],
})
export class CarbonMultiInputModule {}
