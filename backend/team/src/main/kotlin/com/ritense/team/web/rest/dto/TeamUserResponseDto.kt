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

package com.ritense.team.web.rest.dto

import com.ritense.valtimo.contract.authentication.ManageableUser

data class TeamUserResponseDto(
    val username: String,
    val fullName: String?,
    val email: String?,
) {
    companion object {
        fun from(user: ManageableUser) = TeamUserResponseDto(
            username = user.username,
            fullName = user.fullName,
            email = user.email,
        )

        /**
         * Builds a response for a team member that is known by username only. The user may no longer exist in the
         * identity provider, in which case the username is shown as its name instead of failing the whole request.
         * That keeps the member identifiable, so it can still be removed from the team.
         */
        fun from(username: String, user: ManageableUser?) = user?.let { from(it) }
            ?: TeamUserResponseDto(username = username, fullName = username, email = null)
    }
}
