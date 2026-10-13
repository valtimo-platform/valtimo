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

package com.ritense.buildingblock.web.rest

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.buildingblock.exception.BuildingBlockReferenceUpdateException
import com.ritense.buildingblock.service.referenceupdate.BuildingBlockReferenceUpdateService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockInUseVersionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateExecuteRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdatePreviewDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdatePreviewRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateResultDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.LockTimeoutException
import jakarta.persistence.OptimisticLockException
import jakarta.persistence.PessimisticLockException
import jakarta.validation.Valid
import org.hibernate.exception.ConstraintViolationException
import org.hibernate.exception.LockAcquisitionException
import org.operaton.bpm.engine.OptimisticLockingException
import org.springframework.dao.ConcurrencyFailureException
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.zalando.problem.Status
import java.sql.SQLException

@RestController
@SkipComponentScan
@RequestMapping("/api/management/v1/building-block/reference-update", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockReferenceUpdateResource(
    private val buildingBlockReferenceUpdateService: BuildingBlockReferenceUpdateService,
) {

    @EndpointDescription(
        en = "List building block versions that are referenced (management)",
        nl = "Bouwblokversies waarnaar verwezen wordt ophalen (beheer)",
    )
    @RunWithoutAuthorization
    @GetMapping("/in-use")
    fun getInUseVersions(
        @RequestParam(value = "key", required = false) key: String?,
    ): ResponseEntity<List<BuildingBlockInUseVersionDto>> {
        return ResponseEntity.ok(buildingBlockReferenceUpdateService.getInUseVersions(key))
    }

    @EndpointDescription(
        en = "List references to a building block version (management)",
        nl = "Verwijzingen naar een bouwblokversie ophalen (beheer)",
    )
    @RunWithoutAuthorization
    @GetMapping("/references/{key}/version/{versionTag}")
    fun getReferences(
        @PathVariable key: String,
        @PathVariable versionTag: String,
    ): ResponseEntity<List<BuildingBlockReferenceDto>> {
        return ResponseEntity.ok(buildingBlockReferenceUpdateService.getReferences(key, versionTag))
    }

    @EndpointDescription(
        en = "Preview a building block reference update (management)",
        nl = "Bijwerken van bouwblokgebruik voorbereiden (beheer)",
    )
    @RunWithoutAuthorization
    @PostMapping("/preview", consumes = [APPLICATION_JSON_UTF8_VALUE])
    fun preview(
        @Valid @RequestBody request: BuildingBlockReferenceUpdatePreviewRequestDto,
    ): ResponseEntity<BuildingBlockReferenceUpdatePreviewDto> {
        return ResponseEntity.ok(buildingBlockReferenceUpdateService.preview(request))
    }

    @EndpointDescription(
        en = "Execute a building block reference update (management)",
        nl = "Bouwblokgebruik bijwerken (beheer)",
    )
    @RunWithoutAuthorization
    @PostMapping("/execute", consumes = [APPLICATION_JSON_UTF8_VALUE])
    fun execute(
        @Valid @RequestBody request: BuildingBlockReferenceUpdateExecuteRequestDto,
    ): ResponseEntity<BuildingBlockReferenceUpdateResultDto> {
        return try {
            ResponseEntity.ok(buildingBlockReferenceUpdateService.execute(request))
        } catch (e: RuntimeException) {
            if (!isConcurrentWriteFailure(e)) {
                throw e
            }
            logger.warn(e) { "Building block reference update failed while writing" }
            throw BuildingBlockReferenceUpdateException(
                "The references could not be updated because they were changed at the same time. Refresh the preview and try again.",
                Status.CONFLICT,
            )
        }
    }

    /** Lock, constraint or aborted-transaction failures, also when wrapped by JPA, the transaction manager or Operaton. */
    private fun isConcurrentWriteFailure(e: Throwable): Boolean =
        generateSequence(e) { it.cause.takeIf { cause -> cause !== it } }
            .take(MAX_CAUSE_DEPTH)
            .any { it.isConcurrencyType() || (it is SQLException && it.isConcurrencyState()) }

    private fun Throwable.isConcurrencyType() =
        this is ConcurrencyFailureException ||
            this is DataIntegrityViolationException ||
            this is PessimisticLockException ||
            this is LockTimeoutException ||
            this is OptimisticLockException ||
            this is ConstraintViolationException ||
            this is LockAcquisitionException ||
            this is OptimisticLockingException

    private fun SQLException.isConcurrencyState() =
        sqlState?.take(2)?.let { it in CONCURRENCY_SQL_STATE_CLASSES } == true || errorCode in MYSQL_LOCK_ERROR_CODES

    private companion object {
        val logger = KotlinLogging.logger {}
        const val MAX_CAUSE_DEPTH = 20

        // 23 integrity violation, 25 invalid transaction state (Postgres 25P02 aborted), 40 rollback/deadlock, 55 lock not available
        val CONCURRENCY_SQL_STATE_CLASSES = setOf("23", "25", "40", "55")

        // Lock wait timeout, deadlock
        val MYSQL_LOCK_ERROR_CODES = setOf(1205, 1213)
    }
}
