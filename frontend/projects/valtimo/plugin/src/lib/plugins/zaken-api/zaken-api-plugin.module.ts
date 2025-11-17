/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {
  ButtonModule,
  DatePickerInputModule, DatePickerModule,
  DialogModule,
  IconModule,
  LoadingModule, TimePickerModule,
  ToggleModule,
} from 'carbon-components-angular';
import {TranslateModule} from '@ngx-translate/core';
import {ZakenApiConfigurationComponent} from './components/zaken-api-configuration/zaken-api-configuration.component';
import {LinkDocumentToZaakConfigurationComponent} from './components/link-document-to-zaak/link-document-to-zaak-configuration.component';
import {LinkUploadedDocumentToZaakConfigurationComponent} from './components/link-uploaded-document-to-zaak/link-uploaded-document-to-zaak-configuration.component';
import {SetZaakStatusConfigurationComponent} from './components/set-zaak-status/set-zaak-status-configuration.component';
import {CreateZaakResultaatConfigurationComponent} from './components/create-zaak-resultaat/create-zaak-resultaat-configuration.component';
import {CreateMedewerkerZaakRolComponent} from './components/create-medewerker-zaak-rol/create-medewerker-zaak-rol.component';
import {CreateNatuurlijkPersoonZaakRolComponent} from './components/create-natuurlijk-persoon-zaak-rol/create-natuurlijk-persoon-zaak-rol.component';
import {CreateNietNatuurlijkPersoonZaakRolComponent} from './components/create-niet-natuurlijk-persoon-zaak-rol/create-niet-natuurlijk-persoon-zaak-rol.component';
import {CreateOrganisatorischeEenheidZaakRolComponent} from './components/create-organisatorische-eenheid-zaak-rol/create-organisatorische-eenheid-zaak-rol.component';
import {CreateVestigingZaakRolComponent} from './components/create-vestiging-zaak-rol/create-vestiging-zaak-rol.component';
import {DeleteZaakRolComponent} from './components/delete-zaak-rol/delete-zaak-rol.component';
import {CreateZaakConfigurationComponent} from './components/create-zaak/create-zaak-configuration.component';
import {SetZaakopschortingComponent} from './components/set-zaakopschorting/set-zaakopschorting.component';
import {StartHersteltermijnConfigurationComponent} from './components/start-hersteltermijn/start-hersteltermijn-configuration.component';
import {EndHersteltermijnComponent} from './components/end-hersteltermijn/end-hersteltermijn.component';
import {CreateZaakeigenschapComponent} from './components/create-zaakeigenschap/create-zaakeigenschap.component';
import {UpdateZaakeigenschapComponent} from './components/update-zaakeigenschap/update-zaakeigenschap.component';
import {DeleteZaakeigenschapComponent} from './components/delete-zaakeigenschap/delete-zaakeigenschap.component';
import {CreateZaakObjectConfigurationComponent} from './components/create-zaak-object/create-zaak-object-configuration.component';
import {RelateerZakenComponent} from './components/relateer-zaken/relateer-zaken.component';
import {PatchZaakConfigurationComponent} from './components/patch-zaak/patch-zaak-configuration.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';

@NgModule({
  declarations: [
    ZakenApiConfigurationComponent,
    LinkDocumentToZaakConfigurationComponent,
    LinkUploadedDocumentToZaakConfigurationComponent,
    SetZaakStatusConfigurationComponent,
    CreateZaakResultaatConfigurationComponent,
    DeleteZaakRolComponent,
    CreateMedewerkerZaakRolComponent,
    CreateNatuurlijkPersoonZaakRolComponent,
    CreateNietNatuurlijkPersoonZaakRolComponent,
    CreateOrganisatorischeEenheidZaakRolComponent,
    CreateVestigingZaakRolComponent,
    CreateZaakConfigurationComponent,
    SetZaakopschortingComponent,
    StartHersteltermijnConfigurationComponent,
    EndHersteltermijnComponent,
    CreateZaakeigenschapComponent,
    UpdateZaakeigenschapComponent,
    DeleteZaakeigenschapComponent,
    CreateZaakObjectConfigurationComponent,
    RelateerZakenComponent,
    PatchZaakConfigurationComponent,
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
    ButtonModule,
    DialogModule,
    IconModule,
    TranslateModule,
    DatePickerInputModule,
    DatePickerModule,
    FormsModule,
    ReactiveFormsModule,
    TimePickerModule,
  ],
  exports: [
    ZakenApiConfigurationComponent,
    LinkDocumentToZaakConfigurationComponent,
    LinkUploadedDocumentToZaakConfigurationComponent,
    SetZaakStatusConfigurationComponent,
    CreateZaakResultaatConfigurationComponent,
    CreateZaakConfigurationComponent,
    DeleteZaakRolComponent,
    CreateMedewerkerZaakRolComponent,
    CreateNatuurlijkPersoonZaakRolComponent,
    CreateNietNatuurlijkPersoonZaakRolComponent,
    CreateOrganisatorischeEenheidZaakRolComponent,
    CreateVestigingZaakRolComponent,
    SetZaakopschortingComponent,
    StartHersteltermijnConfigurationComponent,
    EndHersteltermijnComponent,
    CreateZaakeigenschapComponent,
    UpdateZaakeigenschapComponent,
    DeleteZaakeigenschapComponent,
    CreateZaakObjectConfigurationComponent,
    RelateerZakenComponent,
  ],
})
export class ZakenApiPluginModule {}
