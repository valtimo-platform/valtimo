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
import {CommonModule} from '@angular/common';
import {PageHeaderComponent} from './page-header.component';
import {PageTitleModule} from '../page-title/page-title.module';
import {BreadcrumbNavigationModule} from '../breadcrumb-navigation/breadcrumb-navigation.module';
import {RenderPageHeaderDirectiveModule} from '../../directives/render-page-header/render-page-header-directive.module';
import {PageActionsComponent} from '../page-actions/page-actions.component';
import {PageSubtitleComponent} from '../page-subtitle/page-subtitle.component';

@NgModule({
  declarations: [PageHeaderComponent],
  imports: [
    CommonModule,
    PageTitleModule,
    BreadcrumbNavigationModule,
    RenderPageHeaderDirectiveModule,
    PageActionsComponent,
    PageSubtitleComponent,
  ],
  exports: [PageHeaderComponent],
})
export class PageHeaderModule {}
