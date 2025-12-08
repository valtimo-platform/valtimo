package com.ritense.case_.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.event.DocumentExpired
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.outbox.OutboxService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.domain.Pageable
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.transaction.annotation.Transactional
import java.util.concurrent.atomic.AtomicBoolean

@Transactional
class DocumentRetentionPeriodExpiredWorkerService(
    private val jsonSchemaDocumentService: JsonSchemaDocumentService,
    private val outboxService: OutboxService,
    private val objectMapper: ObjectMapper,
) {

    private val running = AtomicBoolean(false)

    @Scheduled(fixedDelayString = "\${valtimo.case.processing.retention.poll-interval:PT30M}")
    fun poll() {
        if (!running.compareAndSet(false, true)) {
            logger.debug { "Document retention period worker skipped run because another execution is still active" }
            return
        }
        try {
            runWithoutAuthorization {
                jsonSchemaDocumentService.getExpiredDocuments(Pageable.unpaged()).forEach { doc ->
                    logger.debug {
                        "expired doc found ${doc.retentionDate()} for case ${
                            doc.caseTags()?.first()?.key ?: "not found"
                        }"
                    }
                    jsonSchemaDocumentService.deleteDocument(
                        doc.id
                    )
                    outboxService.send {
                        DocumentExpired(
                            doc?.id.toString(),
                            objectMapper.valueToTree(doc)
                        )
                    }
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