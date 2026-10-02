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

package com.ritense.processlink.web.rest

import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.web.rest.dto.ProcessLinkResponseDto
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.processautofill.service.ProcessDefinitionAutofillService
import com.ritense.valtimo.processautofill.web.rest.dto.AutofilledElementDto
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.impl.util.IoUtil
import java.nio.charset.StandardCharsets

/**
 * Assembles the parts a process definition management response shares: its process links, its
 * BPMN XML and its autofilled elements. Used by both the case-definition and the (case-unlinked)
 * process-definition management resources so this logic is not duplicated across them.
 */
class ProcessDefinitionResponseAssembler(
    private val processLinkService: ProcessLinkService,
    private val repositoryService: RepositoryService,
    private val processDefinitionAutofillService: ProcessDefinitionAutofillService,
) {

    fun processLinks(definition: OperatonProcessDefinition): List<ProcessLinkResponseDto> {
        return processLinkService.getProcessLinks(definition.id).map {
            processLinkService.getProcessLinkMapper(it.processLinkType).toProcessLinkResponseDto(it)
        }
    }

    fun autofilledElements(definition: OperatonProcessDefinition): List<AutofilledElementDto> {
        return processDefinitionAutofillService
            .findByProcessDefinitionId(definition.id)
            .map { AutofilledElementDto.from(it) }
    }

    fun bpmnXml(definition: OperatonProcessDefinition): String {
        val xml = String(
            IoUtil.readInputStream(
                repositoryService.getProcessModel(definition.id),
                "processModelBpmn20Xml"
            ), StandardCharsets.UTF_8
        )
        return if (definition.isSuspended()) {
            xml.replace("isExecutable=\"true\"", "isExecutable=\"false\"")
        } else {
            xml
        }
    }
}
