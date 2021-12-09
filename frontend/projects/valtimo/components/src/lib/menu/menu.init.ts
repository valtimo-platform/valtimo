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

import {Injector} from '@angular/core';
import {NGXLogger} from 'ngx-logger';
import {MenuService} from './menu.service';

export function menuInitializer(
  injector: Injector,
  logger: NGXLogger
): () => Promise<any> {
  const menuService = injector.get<MenuService>(MenuService);
  return (): Promise<any> => {
    return new Promise((resolve, reject) => {
      try {
        logger.debug('menu initializer before init');
        menuService.init();
        logger.debug('menu initializer after init');
        resolve();
      } catch (error) {
        logger.debug('menu initializer error', error);
        reject(error);
      }
    });
  };
}
