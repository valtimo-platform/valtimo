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

package com.ritense.externalplugin.repository

import com.ritense.externalplugin.domain.ExternalPluginContractJob
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus
import jakarta.persistence.LockModeType
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.util.UUID

interface ExternalPluginContractJobRepository :
    JpaRepository<ExternalPluginContractJob, UUID>,
    JpaSpecificationExecutor<ExternalPluginContractJob> {

    /** Serialises the provider's completion against the dispatcher's own transitions. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select j from ExternalPluginContractJob j where j.id = :id")
    fun findByIdForUpdate(@Param("id") id: UUID): ExternalPluginContractJob?

    fun findByRequesterConfigurationIdAndIdempotencyKey(
        requesterConfigurationId: UUID,
        idempotencyKey: String,
    ): ExternalPluginContractJob?

    fun findAllByStatusInAndDeadlineBefore(
        statuses: Collection<ExternalPluginContractJobStatus>,
        now: Instant,
        pageable: Pageable,
    ): List<ExternalPluginContractJob>

    fun findAllByStatusInAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
        statuses: Collection<ExternalPluginContractJobStatus>,
        now: Instant,
        pageable: Pageable,
    ): List<ExternalPluginContractJob>

    fun findAllByRequesterConfigurationIdInAndStatusIn(
        configurationIds: Collection<UUID>,
        statuses: Collection<ExternalPluginContractJobStatus>,
    ): List<ExternalPluginContractJob>

    fun findAllByProviderConfigurationIdInAndStatusIn(
        configurationIds: Collection<UUID>,
        statuses: Collection<ExternalPluginContractJobStatus>,
    ): List<ExternalPluginContractJob>

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
        "delete from ExternalPluginContractJob j where j.status in :statuses and j.updatedAt < :cutoff"
    )
    fun deleteAllByStatusInAndUpdatedAtBefore(
        @Param("statuses") statuses: Collection<ExternalPluginContractJobStatus>,
        @Param("cutoff") cutoff: Instant,
    ): Int
}
