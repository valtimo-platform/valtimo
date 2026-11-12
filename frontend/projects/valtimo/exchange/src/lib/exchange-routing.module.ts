/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {RouterModule, Routes} from '@angular/router';
import {AuthGuardService} from '@valtimo/security';
import {ROLE_ADMIN} from '@valtimo/shared';
import {ExchangePageComponent} from './components/exchange-page/exchange-page.component';

const routes: Routes = [
  {
    path: 'exchange',
    component: ExchangePageComponent,
    canActivate: [AuthGuardService],
    // Custom title: an opened item shows its name
    data: {title: 'Exchange', customPageTitle: true, roles: [ROLE_ADMIN]},
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ExchangeRoutingModule {}
