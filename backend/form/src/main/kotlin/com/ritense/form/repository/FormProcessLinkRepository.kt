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
package com.ritense.form.repository

import com.ritense.form.domain.FormProcessLink
import com.ritense.processlink.repository.BaseProcessLinkRepository
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface FormProcessLinkRepository : BaseProcessLinkRepository<FormProcessLink> {
    @Lock(LockModeType.PESSIMISTIC_READ)
    fun findByFormDefinitionId(formDefinitionId: UUID): List<FormProcessLink>

    @Lock(LockModeType.PESSIMISTIC_READ)
    fun findByFormDefinitionIdIn(formDefinitionIds: Collection<UUID>): List<FormProcessLink>

    @Query(
        "SELECT COUNT(l) > 0 FROM FormProcessLink l WHERE l.processDefinitionId IN :processDefinitionIds " +
            "AND NOT EXISTS (SELECT f.id FROM FormIoFormDefinition f WHERE f.id = l.formDefinitionId)"
    )
    fun existsDanglingByProcessDefinitionIdIn(
        @Param("processDefinitionIds") processDefinitionIds: Collection<String>
    ): Boolean
}
