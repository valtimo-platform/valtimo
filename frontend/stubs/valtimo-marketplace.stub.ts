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

import {NgModule} from '@angular/core';

/**
 * No-op fallback for the OPTIONAL `@valtimo/marketplace` package.
 *
 * The root tsconfig maps `@valtimo/marketplace` to the real library first and to
 * this file second; TypeScript uses the first path that exists. So when the
 * marketplace package is present the real module is used, and when it is removed
 * from the workspace this empty module is used instead — letting apps that opt
 * into the marketplace feature (dev, gzac) still build and `npm start` without it.
 *
 * Keep this in sync with the public surface the apps import from
 * `@valtimo/marketplace` (currently only `PackageManagementModule`).
 */
@NgModule({})
export class PackageManagementModule {}
