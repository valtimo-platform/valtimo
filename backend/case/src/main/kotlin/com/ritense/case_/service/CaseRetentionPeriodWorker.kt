package com.ritense.case_.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.service.impl.JsonSchemaDocumentService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.domain.Pageable
import org.springframework.scheduling.annotation.Scheduled
import java.util.concurrent.atomic.AtomicBoolean

open class CaseRetentionPeriodWorker(
    private val jsonSchemaDocumentService: JsonSchemaDocumentService
) {

    private val running = AtomicBoolean(false)

    @Scheduled(fixedDelayString = "\${valtimo.case.processing.retention.poll-interval:PT1S}")
    fun poll() {
        if (!running.compareAndSet(false, true)) {
            logger.debug { "Document retention period worker skipped run because another execution is still active" }
            return
        }
        try {
            runWithoutAuthorization {
                jsonSchemaDocumentService.getRetainedDocuments(Pageable.unpaged()).forEach { doc ->
                    logger.debug { "retained doc found ${doc.retentionDate()} for case ${doc.caseTags()?.first()?.key?:"not found"}" }
                    jsonSchemaDocumentService.deleteDocument(
                        doc.id,
                        "com.ritense.valtimo.document.retained"
                    )
                }
            }
        } catch (ex: Exception) {
            logger.error(ex) { "Unexpected error while processing inbound notificaties api events" }
        } finally {
            running.set(false)
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}