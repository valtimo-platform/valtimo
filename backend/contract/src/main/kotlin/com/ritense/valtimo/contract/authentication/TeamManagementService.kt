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

package com.ritense.valtimo.contract.authentication

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface TeamManagementService {

    fun create(team: Team): Team

    fun update(key: String, title: String): Team

    fun delete(key: String)

    fun findTeamKeysByUsername(username: String): List<String>

    fun findByKey(teamKey: String): Team?

    fun findAll(pageable: Pageable): Page<Team>

    fun findAll(titleContains: String? = null, pageable: Pageable = Pageable.unpaged()): Page<Team>

    fun findAllTeamUsernames(
        teamKey: String? = null,
        username: String? = null,
        pageable: Pageable = Pageable.unpaged()
    ): Page<String>

    fun addUserToTeam(username: String, teamKey: String): String

    fun removeUserFromTeam(username: String, teamKey: String)
}