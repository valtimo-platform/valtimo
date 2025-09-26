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
import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {ROLE_ADMIN} from '@valtimo/config';
import {AuthGuardService} from '@valtimo/security';
import {TemplateOverviewComponent} from './components/overview/template-overview.component';
import {TemplateEditorComponent} from './components/editor/template-editor.component';

const routes: Routes = [
  {
    path: 'template',
    component: TemplateOverviewComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Templates', templates: [ROLE_ADMIN]},
  },
  {
    path: 'template/:id',
    component: TemplateEditorComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Template details',
      templates: [ROLE_ADMIN],
      customPageTitle: true,
    },
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TemplateManagementRoutingModule {}
