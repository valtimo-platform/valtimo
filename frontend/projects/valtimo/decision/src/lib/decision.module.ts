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
import {DecisionComponent} from './decision.component';
import {DecisionRoutingModule} from './decision-routing.module';
import {DecisionDeployComponent} from './decision-deploy/decision-deploy.component';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {DecisionDisplayComponent} from './decision-display/decision-display.component';
import {DecisionListComponent} from './decision-list/decision-list.component';
import {ListModule, ModalModule, WidgetModule} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';

@NgModule({
  declarations: [DecisionComponent, DecisionDeployComponent, DecisionDisplayComponent, DecisionListComponent],
  imports: [
    DecisionRoutingModule,
    WidgetModule,
    ListModule,
    TranslateModule,
    ModalModule,
    CommonModule,
    FormsModule
  ],
  exports: [DecisionComponent]
})
export class DecisionModule {

}
