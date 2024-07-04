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
import {CustomerListComponent} from './components/customer-list/customer-list.component';
import {
  WidgetModule,
  ListModule,
  SpinnerModule,
  FilterSidebarModule,
  PageModule,
  ParagraphModule,
  TableModule,
  TitleModule,
} from '@valtimo/components';
import {CustomerRoutingModule} from './customer-routing.module';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {FormsModule} from '@angular/forms';
import {CasesListComponent} from './components/cases-list/cases-list.component';

/**
 * @deprecated Will be replace by new plugins
 */
@NgModule({
  imports: [
    CommonModule,
    WidgetModule,
    CustomerRoutingModule,
    ListModule,
    SpinnerModule,
    TranslateModule,
    FilterSidebarModule,
    FormsModule,
    PageModule,
    TitleModule,
    ParagraphModule,
    TableModule,
  ],
  declarations: [CustomerListComponent, CasesListComponent],
  exports: [CustomerListComponent, CasesListComponent],
})
export class CustomerModule {}
