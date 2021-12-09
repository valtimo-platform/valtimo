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

import {NGXLogger} from 'ngx-logger';
import {TranslateService} from '@ngx-translate/core';

export function accountInitializer(
  translate: TranslateService,
  logger: NGXLogger
): () => Promise<any> {
  return (): Promise<any> => {
    return new Promise((resolve, reject) => {
      try {
        logger.debug('Account initializer');
        translate.addLangs(['en', 'nl']);
        let langKey = localStorage.getItem('langKey');
        if (langKey === null) {
          langKey = 'nl';
          localStorage.setItem('langKey', 'nl');
        }
        logger.debug('Using langKey', langKey);
        translate.use(langKey);
        resolve();
      } catch (error) {
        logger.debug('Account initializer error', error);
        reject(error);
      }
    });
  };
}


