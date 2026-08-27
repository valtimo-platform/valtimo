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

package com.ritense.processlink.domain

import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.operaton.bpm.model.bpmn.BpmnModelInstance

data class ProcessLinksCopiedEvent(
    val copiedProcessLinks: List<ProcessLink>,
    val processDefinitionId: String,
    val caseDefinitionId: CaseDefinitionId? = null,
    val basedOnProcessDefinitionId: String? = null,
    val basedOnCaseDefinitionId: CaseDefinitionId? = null,
    /**
     * The BPMN model of the process definition the links were copied to. This event is published
     * while the deployment is still in progress, so the model cannot be read back from the
     * repository service: its resources have not been flushed to the database yet.
     */
    val processDefinitionModelInstance: BpmnModelInstance? = null,
)
