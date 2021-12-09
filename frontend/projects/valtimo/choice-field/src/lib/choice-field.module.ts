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
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {AlertModule, FieldAutoFocusModule, ListModule, WidgetModule} from '@valtimo/components';
import {ChoiceFieldRoutingModule} from './choice-field-routing.module';
import {ChoiceFieldListComponent} from './choice-field-list/choice-field-list.component';
import {ChoiceFieldDetailComponent} from './choice-field-detail/choice-field-detail.component';
import {ChoiceFieldCreateComponent} from './choice-field-create/choice-field-create.component';
import {ChoiceFieldValueListComponent} from './choice-field-value-list/choice-field-value-list.component';
import {ChoiceFieldValueCreateComponent} from './choice-field-value-create/choice-field-value-create.component';
import {ChoiceFieldValueDetailComponent} from './choice-field-value-detail/choice-field-value-detail.component';
import {TranslateModule} from '@ngx-translate/core';

@NgModule({
  declarations: [
    ChoiceFieldListComponent,
    ChoiceFieldDetailComponent,
    ChoiceFieldCreateComponent,
    ChoiceFieldValueListComponent,
    ChoiceFieldValueCreateComponent,
    ChoiceFieldValueDetailComponent
  ],
  imports: [
    CommonModule,
    ListModule,
    WidgetModule,
    FieldAutoFocusModule,
    FormsModule,
    ReactiveFormsModule,
    ChoiceFieldRoutingModule,
    AlertModule,
    TranslateModule
  ],
  exports: []
})
export class ChoiceFieldModule {

}
