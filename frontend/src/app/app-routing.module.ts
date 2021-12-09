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
import {Router, RouterModule, Routes} from '@angular/router';
import {FormioComponent} from './form-io/form-io.component';
import {AuthGuardService} from '@valtimo/security';
import {UploadShowcaseComponent} from './upload-showcase/upload-showcase.component';

const routes: Routes = [
  {
    path: 'form-io',
    component: FormioComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Valtimo - Form.io V.3.27.1'}
  },
  {
    path: 'upload-showcase',
    component: UploadShowcaseComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Upload - Showcase'}
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {

  constructor(
    private router: Router,
  ) {
    this.router.errorHandler = (error: any) => {
      this.router.navigate(['']);
    };
  }
}
