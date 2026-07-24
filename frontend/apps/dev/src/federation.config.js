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

// The NF builder resolves this file relative to the build target's tsConfig
// directory (src/), so it must live here next to tsconfig.app.json. The shared
// host federation setup lives in one place; see that factory for the design.
const {createValtimoFederationConfig} = require('../../../scripts/federation/valtimo-federation.config');

module.exports = createValtimoFederationConfig();
