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
import {MultiInputFormComponent} from './multi-input-form.component';
import {InputLabelModule} from '../input-label/input-label.module';
import {InputModule} from '../input/input.module';
import {ButtonModule} from '../button/button.module';
import {TranslateModule} from '@ngx-translate/core';
import {ParagraphModule} from '../paragraph/paragraph.module';
import {DefaultValuePipe} from './default-value.pipe';

@NgModule({
  declarations: [MultiInputFormComponent],
  imports: [
    CommonModule,
    InputLabelModule,
    InputModule,
    ButtonModule,
    TranslateModule,
    ParagraphModule,
    DefaultValuePipe,
  ],
  exports: [MultiInputFormComponent],
})
export class MultiInputFormModule {}
