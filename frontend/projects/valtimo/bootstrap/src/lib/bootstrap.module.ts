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

import {APP_INITIALIZER, Injector, NgModule} from '@angular/core';
import {NGXLogger} from 'ngx-logger';
import {initialize, initializerFactory} from './init';
import {ConfigService} from '@valtimo/config';
import {TranslateService} from '@ngx-translate/core';
import {INITIALIZERS} from '@valtimo/contract';

@NgModule({
  declarations: [],
  imports: [],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initialize,
      multi: true,
      deps: [INITIALIZERS, NGXLogger]
    },
    {
      provide: INITIALIZERS,
      useFactory: initializerFactory,
      deps: [ConfigService, Injector, NGXLogger, TranslateService]
    }
  ],
  exports: []
})
export class BootstrapModule {
}
