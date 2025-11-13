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
//    private val operatonHistoryService: HistoryService,
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
//                    val retained = jsonSchemaDocumentService.getRetainedDocumentDefinitionsByName(Pageable.unpaged(), case.id.key)
//                    jsonSchemaDocumentService.de

                    jsonSchemaDocumentService.getRetainedDocumentDefinitionsByName(Pageable.unpaged(), case.id.key).forEach{ doc ->
                        logger.debug { "------ retained doc found ${doc.retentionDate()} for case ${case.id.key}" }

                        jsonSchemaDocumentService.deleteDocument(doc.id)
//                        val removalTime = java.util.Date.from(java.time.Instant.parse("2026-12-31T23:59:59Z"))
//                        setRemovalTime("239152af-c06d-11f0-8edf-02f9a38bc30e", removalTime)
                    }
                }
            }
        } catch (ex: Exception) {
            logger.error(ex) { "Unexpected error while processing inbound notificaties api events" }
        } finally {
            running.set(false)
        }
    }

//    fun setRemovalTime(processInstanceId: String, removalTime: java.util.Date) {
//        denyAuthorization()

//        operatonHistoryService
//            .setRemovalTimeToHistoricProcessInstances()
//            .absoluteRemovalTime(removalTime)
//            .byIds(processInstanceId)
//            .hierarchical()
//            .executeAsync()
//    }

//    private fun denyAuthorization() {
//        authorizationService.requirePermission(
//            EntityAuthorizationRequest(
//                OperatonProcessDefinition::class.java,
//                deny()
//            )
//        )
//    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}