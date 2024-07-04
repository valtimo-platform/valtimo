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

import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {TranslationManagementComponent} from './components/translation-management/translation-management.component';
import {TranslationManagementRoutingModule} from './translation-management-routing.module';
import {TranslateModule} from '@ngx-translate/core';
import {
  CarbonMultiInputModule,
  ConfirmationModalModule,
  MultiInputFormModule,
  RenderInPageHeaderDirectiveModule,
} from '@valtimo/components';
import {ButtonModule, IconModule, LoadingModule} from 'carbon-components-angular';

@NgModule({
  declarations: [TranslationManagementComponent],
  imports: [
    CommonModule,
    TranslateModule,
    TranslationManagementRoutingModule,
    MultiInputFormModule,
    CarbonMultiInputModule,
    LoadingModule,
    RenderInPageHeaderDirectiveModule,
    ButtonModule,
    IconModule,
    ConfirmationModalModule,
  ],
  exports: [],
})
export class TranslationManagementModule {}
