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

import com.ritense.team.domain.Team
import com.ritense.valtimo.contract.authentication.Team as TeamInterface

data class TeamListResponseDto(
    val key: String,
    val title: String,
    val userCount: Int,
) {
    companion object {
        fun from(team: TeamInterface) = TeamListResponseDto(
            team.key,
            team.title,
            if (team is Team) team.users.size else 0
        )
    }
}
