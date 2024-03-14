/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {ModalModule, WidgetModule, SpinnerModule} from '@valtimo/components';
import {CommonModule} from '@angular/common';
import {OpenZaakTypeLinkExtensionComponent} from './open-zaak-extension/open-zaak-type-link-extension.component';
import {EmailExtensionComponent} from './email-extension/email-extension.component';
import {NotificationModule} from "carbon-components-angular";

@NgModule({
  declarations: [OpenZaakTypeLinkExtensionComponent, EmailExtensionComponent],
  imports: [
    FormsModule,
    TranslateModule,
    ModalModule,
    ReactiveFormsModule,
    WidgetModule,
    CommonModule,
    SpinnerModule,
    NotificationModule,
  ],
  exports: [],
})
export class OpenZaakModule {}
