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
import {SmartDocumentsConfigurationComponent} from './components/smart-documents-configuration/smart-documents-configuration.component';
import {PluginTranslatePipeModule} from '../../pipes';
import {FormModule, InputModule, SelectModule, MultiInputModule} from '@valtimo/user-interface';
import {GenerateDocumentConfigurationComponent} from './components/generate-document-configuration/generate-document-configuration.component';

@NgModule({
  declarations: [SmartDocumentsConfigurationComponent, GenerateDocumentConfigurationComponent],
  imports: [
    CommonModule,
    PluginTranslatePipeModule,
    FormModule,
    InputModule,
    SelectModule,
    MultiInputModule,
  ],
  exports: [SmartDocumentsConfigurationComponent, GenerateDocumentConfigurationComponent],
})
export class SmartDocumentsPluginModule {}
