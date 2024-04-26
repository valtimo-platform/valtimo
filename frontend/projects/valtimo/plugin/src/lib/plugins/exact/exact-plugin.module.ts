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
import {ButtonModule, FormModule, InputModule} from '@valtimo/components';
import {PluginTranslatePipeModule} from '../../pipes';
import {ExactPluginRoutingModule} from './exact-plugin-routing.module';
import {ExactGetRequestConfigurationComponent} from './components/exact-action-get-request-configuration/exact-get-request-configuration.component';
import {ExactPostRequestConfigurationComponent} from './components/exact-action-post-request-configuration/exact-post-request-configuration.component';
import {ExactPutRequestConfigurationComponent} from './components/exact-action-put-request-configuration/exact-put-request-configuration.component';
import {ExactPluginConfigurationComponent} from './components/exact-plugin-configuration/exact-plugin-configuration.component';
import {ExactRedirectComponent} from './components/exact-redirect/exact-redirect.component';

@NgModule({
  declarations: [
    ExactGetRequestConfigurationComponent,
    ExactPostRequestConfigurationComponent,
    ExactPutRequestConfigurationComponent,
    ExactPluginConfigurationComponent,
    ExactRedirectComponent,
  ],
  imports: [
    CommonModule,
    ExactPluginRoutingModule,
    PluginTranslatePipeModule,
    FormModule,
    InputModule,
    ButtonModule,
    ExactPluginRoutingModule,
  ],
  exports: [],
})
export class ExactPluginModule {}
