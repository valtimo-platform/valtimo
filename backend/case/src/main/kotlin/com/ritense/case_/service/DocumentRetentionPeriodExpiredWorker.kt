package com.ritense.case_.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.event.DocumentExpired
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.outbox.OutboxService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import java.util.concurrent.atomic.AtomicBoolean

@Transactional(propagation = Propagation.NEVER)
class DocumentRetentionPeriodExpiredWorker(
    private val transactionTemplate: TransactionTemplate,
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
            jsonSchemaDocumentService.getExpiredDocuments().forEach { document ->
                try {
                    transactionTemplate.execute {
                        runWithoutAuthorization {
                            logger.debug { "expired doc found ${document.retentionDate()}" }
                            jsonSchemaDocumentService.deleteDocument(document.id)
                            outboxService.send {
                                DocumentExpired(document.id.toString(), objectMapper.valueToTree(document))
                            }
                        }
                    }
                } catch (ex: Exception) {
                    logger.error(ex) { "Error processing expired document $document" }
                }
            }
        } catch (ex: Exception) {
            logger.error(ex) { "Unexpected error while processing expired documents for retention" }
        } finally {
            running.set(false)
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}