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
import {PluginTranslatePipeModule} from '../../pipes';
import {
  FormModule,
  InputLabelModule,
  InputModule,
  ParagraphModule,
  RadioModule,
  SelectModule,
} from '@valtimo/components';
import {ZakenApiConfigurationComponent} from './components/zaken-api-configuration/zaken-api-configuration.component';
import {LinkDocumentToZaakConfigurationComponent} from './components/link-document-to-zaak/link-document-to-zaak-configuration.component';
import {LinkUploadedDocumentToZaakConfigurationComponent} from './components/link-uploaded-document-to-zaak/link-uploaded-document-to-zaak-configuration.component';
import {SetZaakStatusConfigurationComponent} from './components/set-zaak-status/set-zaak-status-configuration.component';
import {CreateZaakResultaatConfigurationComponent} from './components/create-zaak-resultaat/create-zaak-resultaat-configuration.component';
import {CreateNatuurlijkPersoonZaakRolComponent} from './components/create-natuurlijk-persoon-zaak-rol/create-natuurlijk-persoon-zaak-rol.component';
import {CreateNietNatuurlijkPersoonZaakRolComponent} from './components/create-niet-natuurlijk-persoon-zaak-rol/create-niet-natuurlijk-persoon-zaak-rol.component';
import {CreateZaakConfigurationComponent} from './components/create-zaak/create-zaak-configuration.component';
import {SetZaakopschortingComponent} from './components/set-zaakopschorting/set-zaakopschorting.component';
import {LoadingModule, ToggleModule} from 'carbon-components-angular';
import {StartHersteltermijnConfigurationComponent} from './components/start-hersteltermijn/start-hersteltermijn-configuration.component';
import {EndHersteltermijnComponent} from './components/end-hersteltermijn/end-hersteltermijn.component';
import {CreateZaakeigenschapComponent} from './components/create-zaakeigenschap/create-zaakeigenschap.component';
import {UpdateZaakeigenschapComponent} from './components/update-zaakeigenschap/update-zaakeigenschap.component';
import {DeleteZaakeigenschapComponent} from './components/delete-zaakeigenschap/delete-zaakeigenschap.component';

@NgModule({
  declarations: [
    ZakenApiConfigurationComponent,
    LinkDocumentToZaakConfigurationComponent,
    LinkUploadedDocumentToZaakConfigurationComponent,
    SetZaakStatusConfigurationComponent,
    CreateZaakResultaatConfigurationComponent,
    CreateNatuurlijkPersoonZaakRolComponent,
    CreateNietNatuurlijkPersoonZaakRolComponent,
    CreateZaakConfigurationComponent,
    SetZaakopschortingComponent,
    StartHersteltermijnConfigurationComponent,
    EndHersteltermijnComponent,
    CreateZaakeigenschapComponent,
    UpdateZaakeigenschapComponent,
    DeleteZaakeigenschapComponent,
  ],
  imports: [
    CommonModule,
    PluginTranslatePipeModule,
    FormModule,
    InputModule,
    SelectModule,
    ParagraphModule,
    ToggleModule,
    InputLabelModule,
    RadioModule,
    LoadingModule,
  ],
  exports: [
    ZakenApiConfigurationComponent,
    LinkDocumentToZaakConfigurationComponent,
    LinkUploadedDocumentToZaakConfigurationComponent,
    SetZaakStatusConfigurationComponent,
    CreateZaakResultaatConfigurationComponent,
    CreateZaakConfigurationComponent,
    CreateNatuurlijkPersoonZaakRolComponent,
    CreateNietNatuurlijkPersoonZaakRolComponent,
    SetZaakopschortingComponent,
    StartHersteltermijnConfigurationComponent,
    EndHersteltermijnComponent,
    CreateZaakeigenschapComponent,
    UpdateZaakeigenschapComponent,
    DeleteZaakeigenschapComponent,
  ],
})
export class ZakenApiPluginModule {}
