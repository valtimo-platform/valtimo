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

import {HttpBackend, HttpClient} from '@angular/common/http';
import {ConfigService} from '../services/config.service';
import {CustomMultiTranslateHttpLoader} from './custom-multi-translate-http-loader';
import {LocalizationService} from '../services/localization.service';

export function CustomMultiTranslateHttpLoaderFactory(
  http: HttpBackend,
  httpClient: HttpClient,
  configService: ConfigService,
  localizationService: LocalizationService
) {
  const translationResources = configService?.config?.translationResources;

  return new CustomMultiTranslateHttpLoader(http, httpClient, localizationService, [
    './valtimo-translation/core/',
    ...(translationResources &&
    Array.isArray(translationResources) &&
    translationResources.length > 0
      ? translationResources
      : []),
  ]);
}
