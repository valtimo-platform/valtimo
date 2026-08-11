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

package com.ritense.marketplace.web.rest

import com.ritense.marketplace.domain.PackageJob
import com.ritense.marketplace.domain.PackageJobStage
import com.ritense.marketplace.domain.PackageJobStatus
import com.ritense.marketplace.domain.PackageOperation
import java.time.Instant
import java.util.UUID

/**
 * One entry in the activity trail: what was done, to which package, by whom, and how it
 * ended. Also what the UI polls while an install is in flight.
 */
data class PackageJobDto(
    val id: UUID,
    val packageId: String,
    val packageName: String?,
    val packageType: String?,
    val operation: PackageOperation,
    val fromVersion: String?,
    val toVersion: String?,
    val status: PackageJobStatus,
    val stage: PackageJobStage?,
    val createdBy: String?,
    val createdOn: Instant,
    val finishedOn: Instant?,
    val errorMessage: String?,
) {
    companion object {
        fun of(job: PackageJob) = PackageJobDto(
            id = job.id,
            packageId = job.packageId,
            packageName = job.packageName,
            packageType = job.packageType,
            operation = job.operation,
            fromVersion = job.fromVersion,
            toVersion = job.toVersion,
            status = job.status,
            stage = job.stage,
            createdBy = job.createdBy,
            createdOn = job.createdOn,
            finishedOn = job.finishedOn,
            errorMessage = job.errorMessage,
        )
    }
}

/**
 * A configured package repository, as presented on the stores screen.
 */
data class PackageStoreDto(
    val id: String,
    val url: String?,
    val packageCount: Int,
    val reachable: Boolean,
)

/** Body of a preflight or install request; the version is optional (latest compatible). */
data class PackageVersionRequest(
    val version: String? = null,
)
