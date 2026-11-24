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

package com.ritense.outbox

import org.springframework.security.core.context.SecurityContextHolder

/**
 * Provides the current user's identity and roles for enriching outbox CloudEvents.
 *
 * This class exists because the outbox module is intentionally isolated from other
 * Valtimo modules. It can be overridden by providing a custom [UserProvider] bean.
 */
open class UserProvider {
    open fun getCurrentUserLogin(): String? =
        SecurityContextHolder.getContext().authentication?.name

    open fun getCurrentUserRoles(): List<String> =
        SecurityContextHolder.getContext().authentication
            ?.authorities
            ?.mapNotNull { it.authority }
            ?: emptyList()
}