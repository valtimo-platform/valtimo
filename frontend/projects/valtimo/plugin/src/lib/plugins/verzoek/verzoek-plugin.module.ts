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
import {VerzoekConfigurationComponent} from './components/verzoek-configuration/verzoek-configuration.component';
import {PluginTranslatePipeModule} from '../../pipes';
import {CommonModule} from '@angular/common';
import {
  ButtonModule as CarbonButtonModule,
  InputModule as CarbonInputModule,
  ModalModule,
} from 'carbon-components-angular';
import {
  ButtonModule,
  CarbonMultiInputModule,
  FormModule,
  InputLabelModule,
  InputModule,
  MultiInputFormModule,
  ParagraphModule,
  RadioModule,
  SelectModule,
  TooltipIconModule,
  ValtimoCdsModalDirectiveModule,
  VModalModule,
} from '@valtimo/components';

@NgModule({
  declarations: [VerzoekConfigurationComponent],
  imports: [
    CommonModule,
    PluginTranslatePipeModule,
    FormModule,
    InputModule,
    SelectModule,
    ParagraphModule,
    MultiInputFormModule,
    RadioModule,
    InputLabelModule,
    ButtonModule,
    ModalModule,
    CarbonInputModule,
    TooltipIconModule,
    CarbonMultiInputModule,
    CarbonButtonModule,
    ValtimoCdsModalDirectiveModule,
    VModalModule,
  ],
  exports: [VerzoekConfigurationComponent],
})
export class VerzoekPluginModule {}
