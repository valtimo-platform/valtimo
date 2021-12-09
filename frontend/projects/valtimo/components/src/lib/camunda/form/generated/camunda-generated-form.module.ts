/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import {CamundaGeneratedFormComponent} from './camunda-generated-form.component';
import {ReactiveFormsModule} from '@angular/forms';
import {CamundaStringFormfieldComponent} from './formfield/string/camunda-string-formfield.component';
import {CamundaFormfieldGeneratorDirective} from './formfield/camunda-formfield-generator.directive';
import {CamundaBooleanFormfieldComponent} from './formfield/boolean/camunda-boolean-formfield.component';
import {CamundaDateFormfieldComponent} from './formfield/date/camunda-date-formfield.component';
import {CamundaLongFormfieldComponent} from './formfield/long/camunda-long-formfield.component';
import {CamundaEnumFormfieldComponent} from './formfield/enum/camunda-enum-formfield.component';
import {CamundaTextareaFormfieldComponent} from './formfield/textarea/camunda-textarea-formfield.component';
import {CamundaChoicefieldFormfieldComponent} from './formfield/choicefield/camunda-choicefield-formfield.component';
import {CamundaFormfieldValidationComponent} from './formfield/validation/camunda-formfield-validation.component';

@NgModule({
  declarations: [
    CamundaStringFormfieldComponent,
    CamundaBooleanFormfieldComponent,
    CamundaDateFormfieldComponent,
    CamundaFormfieldGeneratorDirective,
    CamundaLongFormfieldComponent,
    CamundaEnumFormfieldComponent,
    CamundaTextareaFormfieldComponent,
    CamundaChoicefieldFormfieldComponent,
    CamundaFormfieldValidationComponent,
    CamundaGeneratedFormComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  exports: [
    CamundaGeneratedFormComponent
  ],
  entryComponents: [
    CamundaStringFormfieldComponent,
    CamundaBooleanFormfieldComponent,
    CamundaDateFormfieldComponent,
    CamundaLongFormfieldComponent,
    CamundaEnumFormfieldComponent,
    CamundaTextareaFormfieldComponent,
    CamundaChoicefieldFormfieldComponent
  ]
})
export class CamundaGeneratedFormModule {
}
