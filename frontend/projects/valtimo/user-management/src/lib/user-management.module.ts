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
import {UserManagementRoutingModule} from './user-management-routing.module';
import {AlertModule, FieldAutoFocusModule, FilterSidebarModule, ListModule, WidgetModule} from '@valtimo/components';
import {UserListComponent} from './user-list/user-list.component';
import {UserDetailComponent} from './user-detail/user-detail.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {UserCreateComponent} from './user-create/user-create.component';
import {TranslateModule} from '@ngx-translate/core';

@NgModule({
  declarations: [UserListComponent, UserDetailComponent, UserCreateComponent],
  imports: [
    CommonModule,
    UserManagementRoutingModule,
    ListModule,
    WidgetModule,
    FieldAutoFocusModule,
    FilterSidebarModule,
    FormsModule,
    ReactiveFormsModule,
    AlertModule,
    TranslateModule
  ],
  exports: []
})
export class UserManagementModule {

}
