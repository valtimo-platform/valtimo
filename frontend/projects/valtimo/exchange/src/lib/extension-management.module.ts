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

import {APP_INITIALIZER, NgModule} from '@angular/core';
import {ExtensionOverviewComponent} from './components/extension-overview/extension-overview.component';
import {ExtensionService} from './services/extension.service';
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
  providers: [
    // Load every STARTED backend extension's frontend bundle at app start.
    // The backend (ExtensionPublicResource) serves each extension's Native
    // Federation bundle straight out of its pf4j jar, so simply dropping a
    // plugin jar in the extensions folder makes both its backend beans AND its
    // frontend contributions (plugin specs, case tabs) appear after a restart —
    // no host rebuild. Kept non-blocking: registration is reactive, so a slow or
    // missing remote never holds up bootstrap.
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: (extensionService: ExtensionService) => () => extensionService.loadAll(),
      deps: [ExtensionService],
    },
  ],
})
export class ExtensionManagementModule {}
