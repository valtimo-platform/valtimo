/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.authorization.web.request

/**
 * Input constraints shared by the request objects that carry an authorization resource type name.
 *
 * These reject obviously malformed input early. They are a second line of defence only. The control
 * that matters is the allowlist applied by
 * [com.ritense.authorization.AuthorizationResourceTypeResolver].
 */
internal object PermissionResourceConstraints {

    /**
     * A fully qualified Java class name: dot separated identifiers.
     */
    const val RESOURCE_NAME_PATTERN = "^[a-zA-Z_$][a-zA-Z\\d_$]*(\\.[a-zA-Z_$][a-zA-Z\\d_$]*)*$"

    const val RESOURCE_MAX_LENGTH = 512
}
