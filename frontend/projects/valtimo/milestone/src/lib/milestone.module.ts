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
import {MilestoneComponent} from './milestone.component';
import {MilestoneSetCreateComponent} from './milestone-set-create/milestone-set-create.component';
import {RouterModule} from '@angular/router';
import {MilestoneRoutingModule} from './milestone-routing.module';
import {MilestoneListComponent} from './milestone-list/milestone-list.component';
import {CommonModule} from '@angular/common';
import {ListModule, WidgetModule} from '@valtimo/components';
import {MilestoneCreateComponent} from './milestone-create/milestone-create.component';
import {MilestoneEditComponent} from './milestone-edit/milestone-edit.component';
import {MilestoneSetEditComponent} from './milestone-set-edit/milestone-set-edit.component';
import {ReactiveFormsModule} from '@angular/forms';
import {ColorPickerModule} from 'ngx-color-picker';
import {TranslateModule} from '@ngx-translate/core';

@NgModule({
  declarations: [
    MilestoneComponent,
    MilestoneSetCreateComponent,
    MilestoneListComponent,
    MilestoneCreateComponent,
    MilestoneEditComponent,
    MilestoneSetEditComponent,
  ],
  imports: [
    RouterModule,
    MilestoneRoutingModule,
    CommonModule,
    ListModule,
    WidgetModule,
    ReactiveFormsModule,
    ColorPickerModule,
    TranslateModule,
  ],
  exports: [MilestoneComponent],
})
export class MilestoneModule {}
