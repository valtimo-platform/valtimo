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
import {CaseMigrationRoutingModule} from './case-migration-routing.module';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {
  CarbonMultiInputModule,
  ConfirmationModalModule,
  RenderInPageHeaderDirectiveModule,
  TooltipIconModule,
  WidgetModule,
} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {CaseMigrationComponent} from './components/case-migration-component/case-migration.component';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  InputModule,
  NotificationModule,
} from 'carbon-components-angular';

@NgModule({
  declarations: [CaseMigrationComponent],
  imports: [
    CommonModule,
    CaseMigrationRoutingModule,
    ReactiveFormsModule,
    WidgetModule,
    FormsModule,
    TranslateModule,
    DropdownModule,
    RenderInPageHeaderDirectiveModule,
    InputModule,
    TooltipIconModule,
    ButtonModule,
    IconModule,
    CarbonMultiInputModule,
    ConfirmationModalModule,
    NotificationModule,
  ],
})
export class CaseMigrationModule {}
