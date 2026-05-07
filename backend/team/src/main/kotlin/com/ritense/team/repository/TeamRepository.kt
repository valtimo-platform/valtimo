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

package com.ritense.team.repository

import com.ritense.team.domain.Team
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import org.springframework.data.jpa.repository.Query
import java.util.Optional
import java.util.UUID

interface TeamRepository : JpaRepository<Team, String>, JpaSpecificationExecutor<Team> {
    fun findByTitleContainingIgnoreCase(title: String): List<Team>

    @Query("SELECT t FROM Team t LEFT JOIN FETCH t.users WHERE t.key = :key")
    fun findByKeyWithUsers(key: String): Optional<Team>

    fun deleteByAdHocCaseDocumentId(adHocCaseDocumentId: UUID)
}
