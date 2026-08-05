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

package com.ritense.valtimo.operaton.authorization

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationEntityMapper
import com.ritense.authorization.AuthorizationEntityMapperResult
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonTimer
import com.ritense.valtimo.operaton.repository.OperatonExecutionRepository
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Root

/**
 * Maps a timer onto the process instance it belongs to, so conditions on a timer permission can
 * refer to the execution and, through the mappers on the execution, to the case it is part of.
 */
class OperatonTimerExecutionMapper(
    private val operatonExecutionRepository: OperatonExecutionRepository,
) : AuthorizationEntityMapper<OperatonTimer, OperatonExecution> {

    override fun mapRelated(entity: OperatonTimer): List<OperatonExecution> {
        // The process-instance-level execution row has the process instance id as its own id.
        return runWithoutAuthorization {
            entity.processInstanceId
                ?.let { operatonExecutionRepository.findById(it).orElse(null) }
                ?.let { listOf(it) }
                ?: emptyList()
        }
    }

    override fun mapQuery(
        root: Root<OperatonTimer>,
        query: AbstractQuery<*>,
        criteriaBuilder: CriteriaBuilder
    ): AuthorizationEntityMapperResult<OperatonExecution> {
        throw UnsupportedOperationException("OperatonTimer is not a JPA entity and cannot be queried")
    }

    override fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean {
        return fromClass == OperatonTimer::class.java && toClass == OperatonExecution::class.java
    }
}
