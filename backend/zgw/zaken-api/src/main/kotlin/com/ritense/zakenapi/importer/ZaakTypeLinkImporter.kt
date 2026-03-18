/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

package com.ritense.processdocument.importer

import com.fasterxml.jackson.core.JsonProcessingException
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.ZGW_ZAAK_TYPE_LINK
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import com.ritense.zakenapi.service.ZaakTypeLinkService
import com.ritense.zakenapi.web.rest.request.CreateZaakTypeLinkRequest
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.annotation.Transactional

@Transactional
class ZaakTypeLinkImporter(
    private val objectMapper: ObjectMapper,
    private val zaakTypeLinkService: ZaakTypeLinkService,
    private val applicationEventPublisher: ApplicationEventPublisher,
    private val pluginConfigurationRepository: PluginConfigurationRepository
) : Importer {

    override fun type() = ZGW_ZAAK_TYPE_LINK

    override fun dependsOn() = setOf(DOCUMENT_DEFINITION)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val caseDefinitionId = request.caseDefinitionId!!
        val content = request.content.toString(Charsets.UTF_8)
        val config: CreateZaakTypeLinkRequest = getJson(content)
        deploy(caseDefinitionId, content)
        checkForConfigurationIssues(caseDefinitionId, config)
    }

    @Throws(JsonProcessingException::class)
    fun deploy(caseDefinitionId: CaseDefinitionId, content: String) {
        val zaakTypeLinkConfig: CreateZaakTypeLinkRequest = getJson(content)

        zaakTypeLinkService.createZaakTypeLink(caseDefinitionId, zaakTypeLinkConfig)
    }

    private fun checkForConfigurationIssues(
        caseDefinitionId: CaseDefinitionId,
        config: CreateZaakTypeLinkRequest
    ) {
        val pluginConfigId = config.zakenApiPluginConfigurationId
        val hasIssue = pluginConfigId != null &&
            !pluginConfigurationRepository.existsById(PluginConfigurationId.existingId(pluginConfigId))

        if (hasIssue) {
            applicationEventPublisher.publishEvent(
                CaseConfigurationIssueDetectedEvent(caseDefinitionId, ISSUE_TYPE)
            )
        } else {
            applicationEventPublisher.publishEvent(
                CaseConfigurationIssueResolvedEvent(caseDefinitionId, ISSUE_TYPE)
            )
        }
    }

    private fun getJson(rawJson: String): CreateZaakTypeLinkRequest {
        return objectMapper.readValue<CreateZaakTypeLinkRequest>(rawJson)
    }

    companion object {
        private val FILENAME_REGEX = """/zgw/zaak-type-link/([^/]+)\.zaak-type-link\.json""".toRegex()
        const val ISSUE_TYPE = "zaak-type-link"
    }
}