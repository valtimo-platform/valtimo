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

import com.fasterxml.jackson.core.JsonPointer
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.module.kotlin.contains
import com.fasterxml.jackson.module.kotlin.treeToValue
import com.ritense.authorization.AuthorizationContext
import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.case.service.CaseDefinitionService
import com.ritense.catalogiapi.service.ZaaktypeUrlProvider
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.domain.patch.JsonPatchService
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.document.service.DocumentService
import com.ritense.logging.withLoggingContext
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.notificatiesapi.exception.NotificatiesNotificationEventException
import com.ritense.objectenapi.ObjectenApiPlugin
import com.ritense.objectenapi.client.ObjectWrapper
import com.ritense.objectmanagement.domain.ObjectManagement
import com.ritense.objectmanagement.service.ObjectManagementService
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.processdocument.domain.impl.request.StartProcessForDocumentRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.patch.JsonPatchBuilder
import com.ritense.verzoek.domain.CopyStrategy
import com.ritense.verzoek.domain.VerzoekProperties
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.net.URI
import kotlin.collections.any
import com.ritense.processdocument.resolver.DocumentJsonValueResolverFactory.Companion.PREFIX as DOC_PREFIX
import com.ritense.valueresolver.ProcessVariableValueResolverFactory.Companion.PREFIX as PV_PREFIX

@SkipComponentScan
@Component
@Transactional
class DocumentVerzoekPluginEventListener(
    private val pluginService: PluginService
    ) {

    @Transactional
    @RunWithoutAuthorization
    @EventListener(NotificatiesApiNotificationReceivedEvent::class)
    fun createNotificatieFromEvent(event: NotificatiesApiNotificationReceivedEvent) {
        logger.info { "DocumentVerzoekPluginEventListener createNotificatieFromEvent: Received event: $event" }
//        val documentVerzoekPlugin = pluginService.createInstance(DocumentVerzoekPlugin::class.java)
//        { properties ->
//            properties["documentVerzoekProperties"]
//                .any { it["objectManagementId"].textValue() == objectManagement.id.toString() }
//        }
        val plugin: DocumentVerzoekPlugin? = pluginService.createInstance(
            DocumentVerzoekPlugin::class.java
        ) { properties ->
            properties["documentVerzoekProperties"]
                .any { it.contains("caseDefinitionKey") }
            // properties is a JsonNode with the plugin configuration JSON
//           properties["documentVerzoekProperties"]
//                ?.elements()
//                ?.asSequence()
//                ?.any { verzoek ->
//                    logger.info { "verzoek: $verzoek" }
//                    !verzoek["caseDefinitionKey"].isEmpty
//                } == true
        }
        if (plugin == null) {
            logger.debug { "Document VerzoekPlugin is ignoring Notificaties API event: No DocumentVerzoekPlugin found that uses iets" }
            return
        }
    }

    companion object {
        val logger = KotlinLogging.logger {}
    }
}
