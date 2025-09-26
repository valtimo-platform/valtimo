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
import {ObjectRoutingModule} from './object-routing.module';
import {ObjectListComponent} from './components/object-list/object-list.component';
import {TranslateModule} from '@ngx-translate/core';
import {AsyncPipe, CommonModule} from '@angular/common';
import {
  ConfirmationModalModule,
  FormIoModule,
  ListModule,
  SearchFieldsModule,
  SpinnerModule,
  ValtimoCdsModalDirectiveModule,
  WidgetModule,
  TooltipIconModule,
  CarbonListModule,
} from '@valtimo/components';
import {ObjectDetailContainerComponent} from './components/object-detail-container/object-detail-container.component';
import {ObjectDetailComponent} from './components/object-detail-container/tabs/object-detail/object-detail.component';
import {
  ButtonModule,
  IconModule,
  InputModule,
  LoadingModule,
  ModalModule,
} from 'carbon-components-angular';
import {ReactiveFormsModule} from '@angular/forms';

@NgModule({
  declarations: [ObjectListComponent, ObjectDetailContainerComponent, ObjectDetailComponent],
  imports: [
    CommonModule,
    ObjectRoutingModule,
    TranslateModule,
    AsyncPipe,
    WidgetModule,
    ListModule,
    ButtonModule,
    IconModule,
    SpinnerModule,
    LoadingModule,
    FormIoModule,
    ModalModule,
    ReactiveFormsModule,
    InputModule,
    TooltipIconModule,
    ConfirmationModalModule,
    SearchFieldsModule,
    ValtimoCdsModalDirectiveModule,
    CarbonListModule,
  ],
  exports: [],
})
export class ObjectModule {}
