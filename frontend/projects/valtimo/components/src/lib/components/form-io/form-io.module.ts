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
import {FormioAppConfig, FormioModule} from '@formio/angular';
import {getFormioAppConfig} from './formio-config';
import {FormIoUploaderComponent} from './components/form-io-uploader/form-io-uploader.component';
import {DropzoneModule} from '../dropzone/dropzone.module';
import {TranslateModule} from '@ngx-translate/core';
import {DocumentModule} from '@valtimo/document';
import {FormIoDomService} from './services/form-io-dom.service';
import {FileSizeModule} from '../file-size/file-size.module';
import {ResourceModule} from '@valtimo/resource';
import {RouterModule} from '@angular/router';
import {FormIoCurrentUserComponent} from './components/form-io-current-user/form-io-current-user.component';
import {ConfigService} from '@valtimo/shared';
import {FormIoIbanComponent} from './components/form-io-iban/iban.component';
import {ReactiveFormsModule} from '@angular/forms';
import {FormioValueResolverSelectorComponent} from './components/formio-value-resolver-selector/formio-value-resolver-selector.component';
import {FormioDummyComponent} from './components/form-io-dummy/dummy.component';
import {LayerModule} from 'carbon-components-angular';
import {FormIoCurrencyComponent} from './components/form-io-currency/currency.component';

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
    FormioValueResolverSelectorComponent,
    LayerModule,
  ],
  declarations: [
    FormioComponent,
    FormioBuilderComponent,
    FormIoUploaderComponent,
    FormIoCurrentUserComponent,
    FormIoIbanComponent,
    FormIoCurrencyComponent,
    FormioDummyComponent,
  ],
  exports: [
    FormioComponent,
    FormioBuilderComponent,
    FormIoUploaderComponent,
    FormIoCurrentUserComponent,
    FormIoIbanComponent,
    FormIoCurrencyComponent,
    FormioDummyComponent,
  ],
  providers: [
    FormIoDomService,
    {
      provide: FormioAppConfig,
      deps: [ConfigService],
      useFactory: (configService: ConfigService) => getFormioAppConfig(configService.config),
    },
  ],
})
export class FormIoModule {}
