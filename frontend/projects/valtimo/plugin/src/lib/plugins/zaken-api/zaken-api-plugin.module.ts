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
import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
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
  DatePickerInputModule,
  DatePickerModule,
  DialogModule,
  IconModule,
  LoadingModule,
  NotificationModule,
  TimePickerModule,
  ToggleModule,
} from 'carbon-components-angular';

import {PluginTranslatePipeModule} from '../../pipes';
import {CreateMedewerkerZaakRolComponent} from './components/create-medewerker-zaak-rol/create-medewerker-zaak-rol.component';
import {CreateNatuurlijkPersoonZaakRolComponent} from './components/create-natuurlijk-persoon-zaak-rol/create-natuurlijk-persoon-zaak-rol.component';
import {CreateNietNatuurlijkPersoonZaakRolComponent} from './components/create-niet-natuurlijk-persoon-zaak-rol/create-niet-natuurlijk-persoon-zaak-rol.component';
import {CreateOrganisatorischeEenheidZaakRolComponent} from './components/create-organisatorische-eenheid-zaak-rol/create-organisatorische-eenheid-zaak-rol.component';
import {CreateVestigingZaakRolComponent} from './components/create-vestiging-zaak-rol/create-vestiging-zaak-rol.component';
import {CreateZaakObjectConfigurationComponent} from './components/create-zaak-object/create-zaak-object-configuration.component';
import {CreateZaakResultaatConfigurationComponent} from './components/create-zaak-resultaat/create-zaak-resultaat-configuration.component';
import {CreateZaakConfigurationComponent} from './components/create-zaak/create-zaak-configuration.component';
import {CreateZaakeigenschapComponent} from './components/create-zaakeigenschap/create-zaakeigenschap.component';
import {DeleteZaakRolComponent} from './components/delete-zaak-rol/delete-zaak-rol.component';
import {DeleteZaakeigenschapComponent} from './components/delete-zaakeigenschap/delete-zaakeigenschap.component';
import {EndHersteltermijnComponent} from './components/end-hersteltermijn/end-hersteltermijn.component';
import {GetZaakInformatieobjectenComponent} from './components/get-zaak-informatieobjecten/get-zaak-informatieobjecten.component';
import {GetZaakbesluitenConfigurationComponent} from './components/get-zaakbesluiten/get-zaakbesluiten-configuration.component';
import {LinkDocumentToZaakConfigurationComponent} from './components/link-document-to-zaak/link-document-to-zaak-configuration.component';
import {LinkUploadedDocumentToZaakConfigurationComponent} from './components/link-uploaded-document-to-zaak/link-uploaded-document-to-zaak-configuration.component';
import {PatchZaakConfigurationComponent} from './components/patch-zaak/patch-zaak-configuration.component';
import {RelateerZakenComponent} from './components/relateer-zaken/relateer-zaken.component';
import {SetZaakStatusConfigurationComponent} from './components/set-zaak-status/set-zaak-status-configuration.component';
import {SetZaakopschortingComponent} from './components/set-zaakopschorting/set-zaakopschorting.component';
import {StartHersteltermijnConfigurationComponent} from './components/start-hersteltermijn/start-hersteltermijn-configuration.component';
import {UpdateZaakeigenschapComponent} from './components/update-zaakeigenschap/update-zaakeigenschap.component';
import {ZakenApiConfigurationComponent} from './components/zaken-api-configuration/zaken-api-configuration.component';

@NgModule({
  declarations: [
    ZakenApiConfigurationComponent,
    LinkDocumentToZaakConfigurationComponent,
    LinkUploadedDocumentToZaakConfigurationComponent,
    GetZaakInformatieobjectenComponent,
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
    GetZaakbesluitenConfigurationComponent,
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
    NotificationModule,
    ReactiveFormsModule,
    TimePickerModule,
  ],
  exports: [
    ZakenApiConfigurationComponent,
    LinkDocumentToZaakConfigurationComponent,
    LinkUploadedDocumentToZaakConfigurationComponent,
    GetZaakInformatieobjectenComponent,
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
    GetZaakbesluitenConfigurationComponent,
  ],
})
export class ZakenApiPluginModule {}
