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
import {FormsModule} from '@angular/forms';
import {InputComponent} from './input.component';
import {TranslateModule} from '@ngx-translate/core';
import {InputLabelModule} from '../input-label/input-label.module';
import {ButtonModule} from '../button/button.module';
import {DigitOnlyDirective} from '../../directives/digit-only/digit-only.directive';
import {CheckboxModule, InputModule as CarbonInputModule} from 'carbon-components-angular';

@NgModule({
  declarations: [InputComponent, DigitOnlyDirective],
  imports: [
    CommonModule,
    TranslateModule,
    FormsModule,
    InputLabelModule,
    ButtonModule,
    CheckboxModule,
    CarbonInputModule,
  ],
  exports: [InputComponent],
})
export class InputModule {}
