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
import {NotificatiesApiConfigurationComponent} from './components/notificaties-api-configuration/notificaties-api-configuration.component';
import {ReceiveNotificatieConfigurationComponent} from './components/receive-notificatie/receive-notificatie-configuration.component';
import {PluginTranslatePipeModule} from '../../pipes';
import {CommonModule} from '@angular/common';
import {
  CarbonMultiInputModule,
  FormModule,
  InputModule,
  ParagraphModule,
  SelectModule,
} from '@valtimo/components';
import {NotificationModule} from 'carbon-components-angular';

@NgModule({
  declarations: [NotificatiesApiConfigurationComponent, ReceiveNotificatieConfigurationComponent],
  imports: [
    CommonModule,
    PluginTranslatePipeModule,
    FormModule,
    InputModule,
    SelectModule,
    ParagraphModule,
    CarbonMultiInputModule,
    NotificationModule,
  ],
  exports: [NotificatiesApiConfigurationComponent, ReceiveNotificatieConfigurationComponent],
})
export class NotificatiesApiPluginModule {}
