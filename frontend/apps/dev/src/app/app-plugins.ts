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

// Local dev builds use this file. Only plugin packages that resolve against the
// @valtimo/* sources are imported here: scripts/copy-dev-plugin-packages.js
// copies them out of node_modules and tsconfig.json maps them to that copy.
// The @valtimo-plugins/* packages are not in the import graph (their transitive
// @valtimo/* imports would not resolve against the workspace links). Release
// builds swap to app-plugins.prod.ts via angular.json fileReplacements; CI
// installs the matching packages from release-plugins.json before building.
import {EpistolaPluginModule, epistolaPluginSpecification} from '@epistola.app/valtimo-plugin';

export const pluginImports: any[] = [EpistolaPluginModule];
export const pluginSpecifications: any[] = [epistolaPluginSpecification];
