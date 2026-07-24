/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {APP_INITIALIZER, Provider} from '@angular/core';

import {StartupPluginLoaderService} from './startup-plugin-loader.service';

/**
 * Provider that loads an app's built-in plugins (Native Federation remotes) at
 * start time, so their plugin specifications and management tabs are registered
 * before the user reaches any plugin/case/building-block screen. Errors are
 * swallowed inside the loader so a missing remote never blocks bootstrap.
 *
 * Each app passes its own list of `remoteEntry.json` URLs; the loading
 * mechanism lives here once, shared by every app. This is also the single place
 * the APP_INITIALIZER wiring lives — when migrating to `provideAppInitializer`
 * (Angular 19+) or adjusting bootstrap timing, change it here only.
 */
export function provideNativeFederationPlugins(remoteEntryUrls: string[]): Provider {
  return {
    provide: APP_INITIALIZER,
    multi: true,
    useFactory: (loader: StartupPluginLoaderService) => () => loader.loadAll(remoteEntryUrls),
    deps: [StartupPluginLoaderService],
  };
}
