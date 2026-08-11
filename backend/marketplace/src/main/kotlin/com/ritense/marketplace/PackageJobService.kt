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

package com.ritense.marketplace

import com.ritense.marketplace.domain.PackageJob
import com.ritense.marketplace.domain.PackageJobStage
import com.ritense.marketplace.domain.PackageJobStatus
import com.ritense.marketplace.domain.PackageOperation
import com.ritense.marketplace.repository.PackageJobRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.utils.SecurityUtils
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.annotation.PreDestroy
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Runs package operations as tracked background jobs.
 *
 * Installing used to be a blocking HTTP request: the browser held the connection for the
 * whole download-and-deploy, a navigation away orphaned the operation, and a failure was
 * a toast that vanished. Here the request only submits, and the resulting [PackageJob]
 * carries the outcome — so progress is pollable, failures are readable afterwards, and
 * the row is also the audit record.
 *
 * Execution is deliberately SINGLE-THREADED. pf4j's plugin registry and the config
 * importer are not safe to drive concurrently, and two installs racing on the same
 * plugins directory is a genuine corruption risk; the queue also makes "update all"
 * behave predictably.
 */
@Component
@SkipComponentScan
class PackageJobService(
    private val packageUpdateManager: PackageUpdateManager,
    private val packageJobStore: PackageJobStore,
    private val packageJobRepository: PackageJobRepository,
) {

    private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "marketplace-package-job").apply { isDaemon = true }
    }

    /**
     * Reset jobs left RUNNING by a previous process. Without this a job that was in
     * flight when the node went down stays "running" forever in the activity list.
     */
    fun failOrphanedJobs() {
        val orphaned = packageJobStore.findUnfinished()
        if (orphaned.isEmpty()) {
            return
        }
        logger.warn { "Failing ${orphaned.size} package job(s) left unfinished by a previous run" }
        orphaned.forEach {
            packageJobStore.fail(it.id, "Interrupted: Valtimo restarted while this operation was running")
        }
    }

    fun submitInstall(packageId: String, version: String): PackageJob =
        submit(packageId, PackageOperation.INSTALL, toVersion = version) {
            packageUpdateManager.installPackage(packageId, version)
        }

    fun submitUpdate(packageId: String, version: String): PackageJob =
        submit(packageId, PackageOperation.UPDATE, toVersion = version) {
            packageUpdateManager.updatePackage(packageId, version)
        }

    fun submitUninstall(packageId: String): PackageJob =
        submit(packageId, PackageOperation.UNINSTALL) {
            packageUpdateManager.uninstallPackage(packageId)
        }

    /**
     * Record an already-completed upload. The file has to be consumed inside the request
     * (the multipart stream does not outlive it), so unlike the other operations this is
     * not queued — the job exists purely as the audit record.
     */
    fun recordUpload(
        packageId: String,
        packageName: String?,
        packageType: String?,
        version: String?,
        error: String?,
    ): PackageJob = packageJobStore.recordCompleted(
        packageId = packageId,
        packageName = packageName,
        packageType = packageType,
        operation = PackageOperation.UPLOAD,
        toVersion = version,
        error = error,
    )

    fun getJob(id: UUID): PackageJob? = packageJobStore.find(id)

    fun getJobs(pageable: Pageable): Page<PackageJob> =
        packageJobRepository.findAllByOrderByCreatedOnDesc(pageable)

    fun getJobs(packageId: String, pageable: Pageable): Page<PackageJob> =
        packageJobRepository.findAllByPackageIdOrderByCreatedOnDesc(packageId, pageable)

    private fun submit(
        packageId: String,
        operation: PackageOperation,
        toVersion: String? = null,
        action: () -> Unit,
    ): PackageJob {
        val pkg = packageUpdateManager.findPackage(packageId)
        val job = packageJobStore.create(
            packageId = packageId,
            packageName = pkg?.name,
            packageType = pkg?.type,
            operation = operation,
            fromVersion = packageUpdateManager.installedVersionOfPackage(packageId),
            toVersion = toVersion,
            // Captured on the request thread: the job runs on a pool thread where the
            // security context is not available.
            createdBy = SecurityUtils.getCurrentUserLogin(),
        )
        executor.submit { run(job.id, operation, pkg?.type, action) }
        return job
    }

    private fun run(jobId: UUID, operation: PackageOperation, packageType: String?, action: () -> Unit) {
        try {
            packageJobStore.start(jobId, stageFor(operation, packageType))
            action()
            packageJobStore.succeed(jobId)
        } catch (e: Exception) {
            logger.error(e) { "Package job $jobId failed" }
            packageJobStore.fail(jobId, rootCauseMessage(e))
        } catch (e: Throwable) {
            // A package that fails to link throws NoClassDefFoundError rather than an
            // Exception. Letting it escape would kill the single worker thread and
            // silently stall every later job, so it is caught and recorded too.
            logger.error(e) { "Package job $jobId failed with an unrecoverable error" }
            packageJobStore.fail(jobId, rootCauseMessage(e))
        }
    }

    /**
     * The stage a job spends most of its time in. Install and update both download before
     * deploying; the download dominates, so it is reported as the stage rather than
     * pretending to track finer progress the underlying calls do not expose.
     */
    private fun stageFor(operation: PackageOperation, packageType: String?): PackageJobStage =
        when (operation) {
            PackageOperation.UNINSTALL -> PackageJobStage.REMOVING
            PackageOperation.UPLOAD ->
                if (isConfigType(packageType)) PackageJobStage.IMPORTING else PackageJobStage.DEPLOYING
            else -> PackageJobStage.DOWNLOADING
        }

    private fun rootCauseMessage(throwable: Throwable): String {
        var cause: Throwable = throwable
        while (cause.cause != null && cause.cause !== cause) {
            cause = cause.cause!!
        }
        return "${cause::class.simpleName}: ${cause.message ?: "no message"}"
    }

    @PreDestroy
    fun shutdown() {
        executor.shutdown()
        // Bounded wait: a download in flight should be allowed to finish, but shutdown
        // must not hang on it. Anything still running is picked up as orphaned on the
        // next start.
        if (!executor.awaitTermination(SHUTDOWN_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            executor.shutdownNow()
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        private const val SHUTDOWN_TIMEOUT_SECONDS = 20L

        private fun isConfigType(type: String?): Boolean =
            type == "case" || type == "building-block"
    }
}

/**
 * Transactional persistence for [PackageJob], split out from [PackageJobService] on
 * purpose: the job runs on a pool thread with no ambient transaction, and each state
 * transition has to commit on its own so a poll from the browser can see it. Calling
 * these as separate bean methods is what makes the `@Transactional` proxy apply — a
 * private method on the service would silently run without one.
 */
@Component
@SkipComponentScan
class PackageJobStore(
    private val packageJobRepository: PackageJobRepository,
) {

    @Transactional
    fun create(
        packageId: String,
        packageName: String?,
        packageType: String?,
        operation: PackageOperation,
        fromVersion: String?,
        toVersion: String?,
        createdBy: String?,
    ): PackageJob = packageJobRepository.saveAndFlush(
        PackageJob(
            packageId = packageId,
            packageName = packageName,
            packageType = packageType,
            operation = operation,
            fromVersion = fromVersion,
            toVersion = toVersion,
            createdBy = createdBy,
            createdOn = Instant.now(),
        )
    )

    @Transactional
    fun recordCompleted(
        packageId: String,
        packageName: String?,
        packageType: String?,
        operation: PackageOperation,
        toVersion: String?,
        error: String?,
    ): PackageJob {
        val now = Instant.now()
        val job = PackageJob(
            packageId = packageId,
            packageName = packageName,
            packageType = packageType,
            operation = operation,
            toVersion = toVersion,
            createdBy = SecurityUtils.getCurrentUserLogin(),
            createdOn = now,
        )
        if (error == null) {
            job.markSucceeded(now)
        } else {
            job.markFailed(now, error)
        }
        return packageJobRepository.saveAndFlush(job)
    }

    @Transactional(readOnly = true)
    fun find(id: UUID): PackageJob? = packageJobRepository.findById(id).orElse(null)

    @Transactional(readOnly = true)
    fun findUnfinished(): List<PackageJob> =
        packageJobRepository.findAllByStatusIn(listOf(PackageJobStatus.PENDING, PackageJobStatus.RUNNING))

    @Transactional
    fun start(id: UUID, stage: PackageJobStage) {
        update(id) { it.markRunning(stage) }
    }

    @Transactional
    fun succeed(id: UUID) {
        update(id) { it.markSucceeded(Instant.now()) }
    }

    @Transactional
    fun fail(id: UUID, message: String?) {
        update(id) { it.markFailed(Instant.now(), message) }
    }

    private fun update(id: UUID, mutation: (PackageJob) -> Unit) {
        val job = packageJobRepository.findById(id).orElse(null) ?: return
        mutation(job)
        packageJobRepository.saveAndFlush(job)
    }
}
