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
import {RouterModule, Routes} from '@angular/router';
import {CommonModule} from '@angular/common';
import {ErrorComponent} from './error.component';
import {HttpErrorInterceptor} from './http-error.interceptor';
import {HTTP_INTERCEPTORS} from '@angular/common/http';

const routes: Routes = [
  {path: '403', component: ErrorComponent, data: {title: 'Access Forbidden', error: 403}},
  {path: '404', component: ErrorComponent, data: {title: 'Not Found', error: 404}},
  {path: '500', component: ErrorComponent, data: {title: 'Internal Server Error', error: 500}},
  {path: '503', component: ErrorComponent, data: {title: 'Service Unavailable', error: 503}}
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule],
  providers: [{provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true}]
})
export class ErrorRoutingModule {
}
