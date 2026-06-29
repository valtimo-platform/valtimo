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

import {NGXLogger} from 'ngx-logger';
import {TranslateService} from '@ngx-translate/core';
import {accountInitializer} from '@valtimo/account';
import {Injector} from '@angular/core';
import {ConfigService} from '@valtimo/shared';
import {
  AdminSettingsService,
  hasSavedMenuConfiguration,
  menuInitializer,
  resolveMenuConfiguration,
} from '@valtimo/components';
import {initializeCsp} from '@valtimo/security';
import {HttpClient} from '@angular/common/http';
import {DomSanitizer} from '@angular/platform-browser';
import {firstValueFrom} from 'rxjs';

export function initialize(
  // eslint-disable-next-line
  initializers: (() => Function)[],
  logger: NGXLogger
): () => Promise<any> {
  return (): Promise<any> =>
    new Promise<void>(async (resolve, reject) => {
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
}

export function initializerFactory(
  configService: ConfigService,
  injector: Injector,
  logger: NGXLogger,
  translateService: TranslateService,
  document: Document,
  domSanitizer: DomSanitizer
) {
  logger.debug('Provided app initializers ', configService.initializers);

  const initializersArray = [];

  // Auth-initializer
  initializersArray.push(configService.config.authentication.initializer(injector));

  // Fetch feature toggle overrides from the backend and patch them into the config
  // before other initializers run, so all reactive consumers see the correct merged values.
  initializersArray.push(async () => {
    try {
      const adminSettingsService = injector.get(AdminSettingsService);
      const overrides = await firstValueFrom(adminSettingsService.getFeatureToggleOverrides());
      if (overrides && Object.keys(overrides).length > 0) {
        configService.patchFeatureToggles(overrides);
        logger.debug('Feature toggle overrides applied', overrides);
      }
    } catch (error) {
      logger.warn('Failed to fetch feature toggle overrides, using defaults', error);
    }
  });

  // Fetch accent colors from the backend and apply them as CSS custom properties
  // before other initializers run, so the UI renders with the correct colors immediately.
  initializersArray.push(async () => {
    try {
      const adminSettingsService = injector.get(AdminSettingsService);
      const colors = await firstValueFrom(adminSettingsService.getAccentColors());
      if (colors && Object.keys(colors).length > 0) {
        adminSettingsService.applyAccentColors(colors);
        logger.debug('Accent colors applied', colors);
      }
    } catch (error) {
      logger.warn('Failed to fetch accent colors, using defaults', error);
    }
  });

  // Initialize CSP after auth so we can fetch external plugin hosts and add their
  // origins to frame-src before the meta tag is inserted (CSP meta is immutable once parsed).
  initializersArray.push(async () => {
    let pluginHostOrigins: string[] = [];
    try {
      const http = injector.get(HttpClient);
      const apiBase = configService.config?.valtimoApi?.endpointUri;
      if (apiBase) {
        const hosts = await firstValueFrom(
          http.get<Array<{baseUrl?: string}>>(`${apiBase}management/v1/external-plugin/host`)
        );
        pluginHostOrigins = hosts
          .map(h => {
            try {
              return new URL(h.baseUrl).origin;
            } catch {
              return null;
            }
          })
          .filter((o): o is string => !!o);
      }
    } catch (error) {
      logger.debug('No external plugin hosts found for CSP augmentation:', error);
    }

    await initializeCsp(logger, configService, document, domSanitizer, pluginHostOrigins)();
  });

  // Fetch the persisted menu configuration and, when one exists, resolve it into MenuItem[] and
  // patch config.menu.menuItems BEFORE the menu initializer runs (mirrors the feature-toggle/accent
  // patches above). When the DB has no saved config (every existing installation) or the call
  // errors, do nothing — config.menu is left untouched so the static environment.ts menu (custom
  // links included) renders byte-identically. Backwards compatible by construction.
  initializersArray.push(async () => {
    try {
      const adminSettingsService = injector.get(AdminSettingsService);
      const dto = await firstValueFrom(adminSettingsService.getMenuConfiguration());
      if (hasSavedMenuConfiguration(dto)) {
        configService.config.menu.menuItems = resolveMenuConfiguration(dto.configuration);
        logger.debug('Persisted menu configuration applied');
      }
    } catch (error) {
      logger.warn('Failed to fetch menu configuration, using default menu', error);
    }
  });

  // Use environment config initializers to be used in app startup.
  configService.initializers.forEach(initializer => {
    initializersArray.push(initializer(injector));
  });

  initializersArray.push(menuInitializer(injector, logger));
  initializersArray.push(accountInitializer(translateService, logger, configService));
  return initializersArray;
}
