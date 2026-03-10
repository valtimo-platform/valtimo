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

package com.ritense.verzoek

import com.fasterxml.jackson.module.kotlin.convertValue
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.case.service.CaseDefinitionService
import com.ritense.document.service.DocumentService
import com.ritense.documentenapi.client.DocumentInformatieObject
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.plugin.service.PluginService
import com.ritense.processdocument.service.impl.OperatonProcessJsonSchemaDocumentAssociationService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.zakenapi.domain.ZaakInformatieObject
import com.ritense.zakenapi.link.ZaakInstanceLinkService
import com.ritense.zakenapi.service.ZaakTypeLinkService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.core.env.Environment
import org.operaton.bpm.engine.RuntimeService
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.net.URI

@SkipComponentScan
@Component
@Transactional
class DocumentVerzoekPluginEventListener(
    private val zaakTypeLinkService: ZaakTypeLinkService,
    private val caseDefinitionService: CaseDefinitionService,
    private val zaakInstanceLinkService: ZaakInstanceLinkService,
    private val runtimeService: RuntimeService,
    private val processDocumentService: OperatonProcessJsonSchemaDocumentAssociationService,
    private val documentService: DocumentService,
    private val pluginService: PluginService,
    private val environment: Environment,
) {

    @Transactional
    @RunWithoutAuthorization
    @EventListener(NotificatiesApiNotificationReceivedEvent::class)
    fun handleEvent(event: NotificatiesApiNotificationReceivedEvent) {
        if (!event.kanaal.equals("zaken", ignoreCase = true)) {
            logger.debug { "DocumentVerzoekPlugin is ignoring Notificaties API event: Event kanaal '${event.kanaal}' doesn't match 'zaken'" }
            return
        }
        // Accept both 'zaakType' and 'zaaktype' as provided by the Notificaties API
        val zaakType = event.kenmerken["zaakType"] ?: event.kenmerken["zaaktype"]
        if (zaakType == null) {
            logger.debug { "DocumentVerzoekPlugin is ignoring Notificaties API event: Event 'zaakType' is null" }
            return
        }
        if (event.resource?.equals("zaakinformatieobject", ignoreCase = true) != true) {
            logger.debug { "DocumentVerzoekPlugin is ignoring Notificaties API event: Event 'resource' is not zaakinformatieobject" }
            return
        }
        if (!event.actie.equals("create", ignoreCase = true)) {
            logger.debug { "DocumentVerzoekPlugin is ignoring Notificaties API event: Event actie '${event.actie}' doesn't match 'create'" }
            return
        }

        val plugin: DocumentVerzoekPlugin? = pluginService.createInstance(
            DocumentVerzoekPlugin::class.java
        ) { properties ->
            !properties["docTypes"].isEmpty
        }

        if (plugin == null) {
            logger.warn { "DocumentVerzoekPlugin is ignoring Notificaties API event: No DocumentVerzoekPlugin found matching zaakType '$zaakType' in documentVerzoekProperties" }
            return
        }
        // Find the matching CaseDefinition for the incoming zaakType
        handleNewDocumentEvent(event, plugin)

    }

    private fun handleNewDocumentEvent(
        event: NotificatiesApiNotificationReceivedEvent,
        plugin: DocumentVerzoekPlugin,
    ) {
        val (zaakUrl, resourceUrl) = if (environment.activeProfiles.contains("dev")) {
            event.hoofdObject!!.replace(
                "host.docker.internal",
                "localhost"
            ) to event.resourceUrl.replace("host.docker.internal", "localhost")
        } else {
            event.hoofdObject!! to event.resourceUrl
        }

        zaakInstanceLinkService.getByZaakInstanceUrl(URI(zaakUrl)).let { zaak ->
            plugin.zakenApiPlugin.getZaakInformatieObjectByUrl(
                URI(resourceUrl),
                zaak.documentId
            )?.let { zaakInformatieObject ->
                plugin.documentenApiPlugin.getInformatieObject(
                    zaakInformatieObject.informatieobject,
                    zaak.documentId
                ).let { informatieObject ->
                    logger.info { "DocumentVerzoekPlugin: informatieObject '${informatieObject.informatieobjecttype}'" }
                    if (plugin.docTypes.any { docType ->
                        docType.type == informatieObject.informatieobjecttype
                    }) {
                        logger.info { "DocumentVerzoekPlugin: document type '${informatieObject.informatieobjecttype}' is allowed" }
                        sendMessage(
                            zaak.documentId.toString(),
                            plugin.eventMessage,
                            zaakInformatieObject,
                            informatieObject
                        )
                    }
                }
            }
                ?: logger.warn { "DocumentVerzoekPlugin is ignoring Notificaties API event: No InformatieObject found for zaakInstanceUrl '${event.resourceUrl}'" }
        }
    }

    private fun sendMessage(
        documentId: String,
        eventMessage: String,
        zaakInformatieObject: ZaakInformatieObject,
        informatieObject: DocumentInformatieObject?,
    ) {
        documentService.get(documentId).let { doc ->
            processDocumentService.findProcessDocumentInstances(doc.id()).forEach { procInst ->
                procInst.id?.let { procInst ->
                    val response = runtimeService.createMessageCorrelation(eventMessage)
                        .processInstanceId(procInst.processInstanceId().toString())
                        .setVariable("zaakInformatieObject", objectMapper.convertValue(zaakInformatieObject))
                        .setVariable("informatieObject", objectMapper.convertValue(informatieObject))
                        .correlateAll()
                    logger.info { "DocumentVerzoekPlugin: message '${eventMessage}' sent to process instance '${procInst.processInstanceId()}' with response '${response}'" }
                }
            }
        }
    }

    companion object {
        val logger = KotlinLogging.logger {}
        private val objectMapper = jacksonObjectMapper().findAndRegisterModules()
    }
}
