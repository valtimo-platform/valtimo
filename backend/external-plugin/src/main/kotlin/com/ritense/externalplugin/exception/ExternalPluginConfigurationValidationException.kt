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

package com.ritense.externalplugin.exception

/**
 * A configuration create or update the admin can fix in the form: invalid properties, a grant set
 * that does not match the manifest, or a contract binding that is undeclared, incompatible or cyclic.
 * Mapped to a `400 Bad Request` whose `detail` is this message, so the activation and edit screens
 * can show the reason instead of a reference id.
 */
class ExternalPluginConfigurationValidationException(message: String) : RuntimeException(message)
