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
import {ExtensionOverviewComponent} from './components/extension-overview/extension-overview.component';
import {AsyncPipe, NgIf, NgTemplateOutlet} from '@angular/common';
import {
  ButtonModule,
  LayerModule,
  LoadingModule,
  ModalModule,
  TagModule,
  TilesModule,
} from 'carbon-components-angular';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule} from '@valtimo/components';
import {ExtensionManagementRoutingModule} from './extension-management-routing.module';
import {PluginTranslatePipeModule} from "@valtimo/plugin";

@NgModule({
  declarations: [ExtensionOverviewComponent],
  imports: [
    ExtensionManagementRoutingModule,
    AsyncPipe,
    NgIf,
    LayerModule,
    NgTemplateOutlet,
    TranslateModule,
    CarbonListModule,
    TagModule,
    TilesModule,
    LoadingModule,
    ButtonModule,
    ModalModule,
    PluginTranslatePipeModule,
  ],
})
export class ExtensionManagementModule {}
