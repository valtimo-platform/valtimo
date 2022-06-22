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
import {OpenZaakConfigurationComponent} from './components/open-zaak-configuration/open-zaak-configuration.component';
import {
  FormModule,
  InputModule,
  TitleModule,
  SelectModule,
  InputLabelModule,
  ParagraphModule,
} from '@valtimo/user-interface';
import {SpinnerModule} from '@valtimo/components';
import {CreateZaakConfigurationComponent} from './components/create-zaak-configuration/create-zaak-configuration.component';
import {SetBesluitConfigurationComponent} from './components/set-besluit-configuration/set-besluit-configuration.component';
import {SetResultaatConfigurationComponent} from './components/set-resultaat-configuration/set-resultaat-configuration.component';
import {SetStatusConfigurationComponent} from './components/set-status-configuration/set-status-configuration.component';
import {PluginTranslatePipeModule} from '../../pipes';
import {SelectZaakTypeComponent} from './components/select-zaak-type/select-zaak-type.component';

@NgModule({
  declarations: [
    OpenZaakConfigurationComponent,
    CreateZaakConfigurationComponent,
    SetBesluitConfigurationComponent,
    SetResultaatConfigurationComponent,
    SetStatusConfigurationComponent,
    SelectZaakTypeComponent,
  ],
  imports: [
    CommonModule,
    TitleModule,
    FormModule,
    InputModule,
    PluginTranslatePipeModule,
    SelectModule,
    InputLabelModule,
    ParagraphModule,
  ],
  exports: [
    OpenZaakConfigurationComponent,
    CreateZaakConfigurationComponent,
    SetBesluitConfigurationComponent,
    SetResultaatConfigurationComponent,
    SetStatusConfigurationComponent,
    SelectZaakTypeComponent,
  ],
})
export class OpenZaakPluginModule {}
