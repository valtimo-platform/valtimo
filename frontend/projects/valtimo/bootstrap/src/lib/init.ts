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
import {accountInitializer} from '@valtimo/account';
import {Injector} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {menuInitializer} from '@valtimo/components';

export function initialize(initializers: (() => Function)[], logger: NGXLogger): () => Promise<any> {
  return (): Promise<any> => {
    return new Promise(async (resolve, reject) => {
      logger.debug('Initializing application');
      try {
        logger.debug('Running', initializers.length);
        for (const [index, initializer] of initializers.entries()) {
          logger.debug('Executing app initializer:', index, initializer.name);
          await initializer();
          logger.debug('Executed app initializer:', index, initializer.name);
        }
        logger.debug('Application initialized');
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  };
}

export function initializerFactory(
  configService: ConfigService,
  injector: Injector,
  logger: NGXLogger,
  translateService: TranslateService
) {
  logger.debug('Provided app initializers ', configService.initializers);

  const initializersArray = [];

  // Auth-initializer
  initializersArray.push(configService.config.authentication.initializer(injector));

  // Use environment config initializers to be used in app startup.
  configService.initializers.forEach(initializer => {
    initializersArray.push(initializer(injector));
  });

  initializersArray.push(menuInitializer(injector, logger));
  initializersArray.push(accountInitializer(translateService, logger));
  return initializersArray;
}
