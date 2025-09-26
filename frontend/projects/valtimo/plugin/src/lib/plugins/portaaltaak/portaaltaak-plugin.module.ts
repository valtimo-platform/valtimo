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
import {PortaaltaakConfigurationComponent} from './components/portaaltaak-configuration/portaaltaak-configuration.component';
import {PluginTranslatePipeModule} from '../../pipes';
import {CommonModule} from '@angular/common';
import {
  FormModule,
  InputModule,
  CarbonMultiInputModule,
  ParagraphModule,
  SelectModule,
} from '@valtimo/components';
import {CreatePortalTaskComponent} from './components/create-portal-task/create-portal-task.component';
import {CompletePortalTaskComponent} from './components/complete-portal-task/complete-portal-task.component';

@NgModule({
  declarations: [
    PortaaltaakConfigurationComponent,
    CreatePortalTaskComponent,
    CompletePortalTaskComponent,
  ],
  imports: [
    CommonModule,
    PluginTranslatePipeModule,
    FormModule,
    InputModule,
    SelectModule,
    ParagraphModule,
    CarbonMultiInputModule,
  ],
  exports: [
    PortaaltaakConfigurationComponent,
    CreatePortalTaskComponent,
    CompletePortalTaskComponent,
  ],
})
export class PortaaltaakPluginModule {}
