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

package com.ritense.marketplace.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/**
 * One install / update / uninstall / upload attempt.
 *
 * Persisted rather than kept in memory for two reasons: an install must survive the user
 * closing the browser (and the node restarting) without becoming invisible, and the row
 * doubles as the audit record of who changed which package to which version — which the
 * marketplace previously had no trace of at all.
 */
@Entity
@Table(name = "marketplace_package_job")
class PackageJob(

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    val id: UUID = UUID.randomUUID(),

    @Column(name = "package_id", nullable = false, updatable = false)
    val packageId: String,

    /**
     * Display name at the time of the operation. Snapshotted so an audit row still reads
     * sensibly after the package disappears from the catalogue.
     */
    @Column(name = "package_name", updatable = false)
    val packageName: String? = null,

    @Column(name = "package_type", updatable = false)
    val packageType: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "operation", nullable = false, updatable = false)
    val operation: PackageOperation,

    @Column(name = "from_version", updatable = false)
    val fromVersion: String? = null,

    @Column(name = "to_version", updatable = false)
    val toVersion: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    var status: PackageJobStatus = PackageJobStatus.PENDING,

    @Enumerated(EnumType.STRING)
    @Column(name = "stage")
    var stage: PackageJobStage? = null,

    @Column(name = "created_by", updatable = false)
    val createdBy: String? = null,

    @Column(name = "created_on", nullable = false, updatable = false)
    val createdOn: Instant,

    @Column(name = "finished_on")
    var finishedOn: Instant? = null,

    @Column(name = "error_message", columnDefinition = "TEXT")
    var errorMessage: String? = null,
) {
    fun markRunning(stage: PackageJobStage) {
        this.status = PackageJobStatus.RUNNING
        this.stage = stage
    }

    fun markSucceeded(finishedOn: Instant) {
        this.status = PackageJobStatus.SUCCEEDED
        this.stage = PackageJobStage.COMPLETED
        this.finishedOn = finishedOn
    }

    fun markFailed(finishedOn: Instant, errorMessage: String?) {
        this.status = PackageJobStatus.FAILED
        this.finishedOn = finishedOn
        // Truncated because the message is a root-cause chain from an arbitrary package;
        // the column is TEXT but an unbounded value is still not worth storing.
        this.errorMessage = errorMessage?.take(MAX_ERROR_LENGTH)
    }

    companion object {
        private const val MAX_ERROR_LENGTH = 4000
    }
}

enum class PackageOperation {
    INSTALL,
    UPDATE,
    UNINSTALL,

    /** A package file supplied by the user instead of fetched from a store. */
    UPLOAD,
}

enum class PackageJobStatus {
    PENDING,
    RUNNING,
    SUCCEEDED,
    FAILED,
}

/**
 * Coarse progress, so the UI can show what is happening during a long install rather
 * than an unqualified spinner. Deliberately coarse: the underlying pf4j and importer
 * calls are single blocking operations that report nothing finer.
 */
enum class PackageJobStage {
    /** Fetching the artifact from the store and verifying its checksum. */
    DOWNLOADING,

    /** Loading and starting the plugin in the running application. */
    DEPLOYING,

    /** Importing a config package's definitions. */
    IMPORTING,

    /** Removing an installed package. */
    REMOVING,

    COMPLETED,
}
