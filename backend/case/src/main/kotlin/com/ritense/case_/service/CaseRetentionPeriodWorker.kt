package com.ritense.case_.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.document.service.impl.JsonSchemaDocumentService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.HistoryService
import org.springframework.data.domain.Pageable
import org.springframework.scheduling.annotation.Scheduled
import java.util.concurrent.atomic.AtomicBoolean

open class CaseRetentionPeriodWorker(
    private val jsonSchemaDocumentService: JsonSchemaDocumentService,
    private val caseDefinitionRepository: CaseDefinitionRepository,
    private val operatonHistoryService: HistoryService,
) {

    private val running = AtomicBoolean(false)

    @Scheduled(fixedDelayString = "\${valtimo.case.processing.retention.poll-interval:PT1S}")
    fun poll() {
        if (!running.compareAndSet(false, true)) {
            logger.debug { "Document retention period worker skipped run because another execution is still active" }
            return
        }
        try {
            caseDefinitionRepository.findAllByFinalTrue().forEach { case ->
                runWithoutAuthorization {
                    jsonSchemaDocumentService.getRetainedDocumentDefinitionsByName(Pageable.unpaged(), case.id.key).forEach{ doc ->
                        logger.debug { "retained doc found ${doc.retentionDate()} for case ${case.id.key}" }
                        jsonSchemaDocumentService.deleteDocument(doc.id)
                    }
                }
            }
            operatonHistoryService.cleanUpHistoryAsync(true)
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