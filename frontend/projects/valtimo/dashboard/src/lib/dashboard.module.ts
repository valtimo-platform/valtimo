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
import {CommonModule} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {NgModule} from '@angular/core';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {TranslateHttpLoader} from '@ngx-translate/http-loader';
import {
  AlertModule,
  BpmnJsDiagramModule,
  CarbonListModule,
  ListModule,
  SpinnerModule,
  WidgetModule,
} from '@valtimo/components';
import {TaskModule} from '@valtimo/task';
import {LoadingModule, TabsModule, ThemeModule} from 'carbon-components-angular';
import {DashboardComponent} from './components/dashboard/dashboard.component';
import {WidgetDashboardContentComponent} from './components/widget-dashboard-content/widget-dashboard-content.component';
import {WidgetDashboardComponent} from './components/widget-dashboard/widget-dashboard.component';
import {DATA_SOURCE_TOKEN, DISPLAY_TYPE_TOKEN} from './constants';
import {DashboardRoutingModule} from './dashboard-routing.module';
import {WidgetTranslatePipeModule} from './pipes';

// AoT requires an exported function for factories
export function HttpLoaderFactory(httpClient: HttpClient) {
  return new TranslateHttpLoader(httpClient);
}

@NgModule({
  declarations: [DashboardComponent, WidgetDashboardComponent, WidgetDashboardContentComponent],
  imports: [
    CommonModule,
    DashboardRoutingModule,
    WidgetModule,
    ListModule,
    BpmnJsDiagramModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient],
      },
    }),
    AlertModule,
    TaskModule,
    SpinnerModule,
    TabsModule,
    ThemeModule,
    WidgetTranslatePipeModule,
    LoadingModule,
    CarbonListModule,
  ],
  exports: [DashboardComponent, WidgetDashboardComponent],
  providers: [
    {provide: DISPLAY_TYPE_TOKEN, useValue: null, multi: true},
    {provide: DATA_SOURCE_TOKEN, useValue: null, multi: true},
  ],
})
export class DashboardModule {}
