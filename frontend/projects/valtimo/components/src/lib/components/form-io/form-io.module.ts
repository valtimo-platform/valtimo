/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {FormioComponent} from './components/form-io/form-io.component';
import {FormioBuilderComponent} from './components/form-io-builder/form-io-builder.component';
import {FormioModule} from '@formio/angular';
import {DropzoneModule} from '../dropzone/dropzone.module';
import {TranslateModule} from '@ngx-translate/core';
import {DocumentModule} from '@valtimo/document';
import {FileSizeModule} from '../file-size/file-size.module';
import {ResourceModule} from '@valtimo/resource';
import {RouterModule} from '@angular/router';
import {ReactiveFormsModule} from '@angular/forms';
import {LayerModule} from 'carbon-components-angular';

@NgModule({
  imports: [
    CommonModule,
    FormioModule,
    DropzoneModule,
    TranslateModule,
    DocumentModule,
    FileSizeModule,
    ResourceModule,
    RouterModule,
    ReactiveFormsModule,
    LayerModule,
  ],
  declarations: [FormioComponent, FormioBuilderComponent],
  exports: [FormioComponent, FormioBuilderComponent],
  providers: [],
})
export class FormIoModule {}
