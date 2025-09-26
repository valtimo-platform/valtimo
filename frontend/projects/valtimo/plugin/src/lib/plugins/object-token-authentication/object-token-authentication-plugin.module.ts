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

import {ObjectTokenAuthencationConfigurationComponent} from './components/object-token-authentication-configuration/object-token-authencation-configuration.component';
import {CommonModule} from '@angular/common';
import {PluginTranslatePipeModule} from '../../pipes';
import {FormModule, InputModule} from '@valtimo/components';
import {NgModule} from '@angular/core';

@NgModule({
  declarations: [ObjectTokenAuthencationConfigurationComponent],
  imports: [CommonModule, PluginTranslatePipeModule, FormModule, InputModule],
  exports: [ObjectTokenAuthencationConfigurationComponent],
})
export class ObjectTokenAuthenticationPluginModule {}
