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
import {ConfigService} from '@valtimo/config';
import {BasicExtensionPoint, Extension} from '@valtimo/contract';
import {Injector} from '@angular/core';
import {ConnectorLinkExtensionComponent} from '../components/connector-link-extension/connector-link-extension.component';

export function connectorLinkExtensionInitializer(injector: Injector): () => Promise<any> {
  const configService = injector.get<ConfigService>(ConfigService);
  const logger = injector.get<NGXLogger>(NGXLogger);

  return (): Promise<any> => {
    return new Promise((resolve, reject) => {
      try {
        logger.debug('connector link extension initializer before init');
        const extension = new Extension(
          'ConnectorLink',
          new BasicExtensionPoint(
            'dossier-management',
            'dossier',
            'right-panel',
            ConnectorLinkExtensionComponent
          )
        );
        configService.addExtension(extension);
        logger.debug('connector link extension initializer after init');
        resolve();
      } catch (error) {
        logger.debug('connector link extension initializer error', error);
        reject(error);
      }
    });
  };
}
