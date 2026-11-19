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

package com.ritense.form.listener

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.form.domain.FormProcessLink
import com.ritense.form.domain.request.CreateFormDefinitionRequest
import com.ritense.form.exception.FormDefinitionMissingForProcessLinkException
import com.ritense.form.service.FormProcessLinkUsageResolver
import com.ritense.form.service.FormDefinitionService
import com.ritense.form.web.rest.dto.FormProcessLinkUpdateRequestDto
import com.ritense.processlink.domain.ProcessLinksCopiedEvent
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseDefinitionCreatedEvent
import com.ritense.valtimo.contract.event.CaseDefinitionPreDeleteEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
@Component
@SkipComponentScan
class FormCaseEventListener(
    private val formDefinitionService: FormDefinitionService,
    private val processLinkService: ProcessLinkService,
    private val formProcessLinkUsageResolver: FormProcessLinkUsageResolver,
) {

    @EventListener(CaseDefinitionCreatedEvent::class)
    @RunWithoutAuthorization
    fun handleCaseDefinitionCreatedEvent(event: CaseDefinitionCreatedEvent) {
        if (!event.duplicate || event.copyFormDefinitionsAfterProcessLinks == true) return;

        val sourceId = event.basedOnCaseDefinitionId ?: return
        val targetId = event.caseDefinitionId

        copyFormDefinitions(sourceId, targetId)
    }

    @RunWithoutAuthorization
    @EventListener(CaseDefinitionPreDeleteEvent::class)
    fun handleCaseDefinitionPreDeleteEvent(event: CaseDefinitionPreDeleteEvent) {
        formDefinitionService.deleteAllFormDefinitions(event.caseDefinitionId)
    }

    @RunWithoutAuthorization
    @EventListener(ProcessLinksCopiedEvent::class)
    fun handleProcessLinksCopiedEvent(event: ProcessLinksCopiedEvent) {
        lockReferencedFormDefinitions(event)

        if (event.caseDefinitionId == null || event.basedOnCaseDefinitionId == null) return;

        val deployedFormDefinitions = formDefinitionService.getFormDefinitions(event.caseDefinitionId)

        val formDefinitionIdMapping = if (deployedFormDefinitions.isEmpty()) {
            copyFormDefinitions(
                event.basedOnCaseDefinitionId!!,
                event.caseDefinitionId!!
            )
        } else {
            val sourceFormDefinitions = formDefinitionService.getFormDefinitions(event.basedOnCaseDefinitionId)
            deployedFormDefinitions.associate { df -> sourceFormDefinitions.single { it.name == df.name }.id to df.id }
        }

        event.copiedProcessLinks.forEach { processLink ->
            if (processLink !is FormProcessLink) return@forEach

            val formDefinitionId = formDefinitionIdMapping[processLink.formDefinitionId]
                ?: processLink.formDefinitionId.also {
                    if (!formDefinitionService.formDefinitionExistsById(it)) {
                        throw FormDefinitionMissingForProcessLinkException(
                            it,
                            formProcessLinkUsageResolver.resolve(processLink)
                        )
                    }
                }

            val formProcessLinkUpdateRequest = FormProcessLinkUpdateRequestDto(
                processLink.id,
                formDefinitionId,
                processLink.viewModelEnabled,
                processLink.formDisplayType,
                processLink.formSize,
                processLink.subtitles
            )

            processLinkService.updateProcessLink(
                formProcessLinkUpdateRequest,
                event.caseDefinitionId
            )
        }
    }

    private fun lockReferencedFormDefinitions(event: ProcessLinksCopiedEvent) {
        event.copiedProcessLinks
            .filterIsInstance<FormProcessLink>()
            .map { it.formDefinitionId }
            .distinct()
            .filterNot { formDefinitionService.formDefinitionExistsByIdWithLock(it) }
            .forEach { logger.warn { "Copied process link references form definition '$it' which does not exist" } }
    }

    private fun copyFormDefinitions(
        sourceCaseDefinitionId: CaseDefinitionId,
        targetCaseDefinitionId: CaseDefinitionId
    ): Map<UUID, UUID> {
        val formDefinitionIdMapping = mutableMapOf<UUID, UUID>()

        formDefinitionService.getFormDefinitions(sourceCaseDefinitionId).forEach { oldFormDefinition ->
            val newFormDefinition = formDefinitionService.createFormDefinition(
                targetCaseDefinitionId,
                CreateFormDefinitionRequest(
                    oldFormDefinition.name,
                    oldFormDefinition.formDefinition.toString(),
                    oldFormDefinition.isReadOnly
                )
            )
            formDefinitionIdMapping[oldFormDefinition.id] = newFormDefinition.id
        }

        return formDefinitionIdMapping
    }

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
