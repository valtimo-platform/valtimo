/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {initFederation} from '@angular-architects/native-federation';

// Initialize the Native Federation runtime (and its es-module-shims import map)
// BEFORE the application bootstraps. The app's @angular/*, rxjs, zone.js and
// @valtimo/* are emitted as standalone shared chunks and registered in the import
// map here, so the application resolves those bare imports to a single shared
// instance of each (one Angular instance on the page, consistent DI token
// identity).
//
// The actual application bootstrap lives in ./bootstrap and is imported
// dynamically so it only runs once the import map is in place.
initFederation('/assets/federation.manifest.json')
  .catch(err => console.error('Federation init failed', err))
  .then(() => import('./bootstrap'))
  .catch(err => console.error(err));
