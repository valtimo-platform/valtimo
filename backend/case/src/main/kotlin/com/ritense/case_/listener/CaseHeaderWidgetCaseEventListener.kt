/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.case_.listener

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.case_.rest.dto.CaseHeaderWidgetCreateDto
import com.ritense.case_.service.CaseHeaderWidgetService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.event.CaseDefinitionCreatedEvent
import com.ritense.valtimo.contract.event.CaseDefinitionPreDeleteEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Transactional
@Service
@SkipComponentScan
class CaseHeaderWidgetCaseEventListener(
    private val service: CaseHeaderWidgetService
) {

    @RunWithoutAuthorization
    @EventListener(CaseDefinitionCreatedEvent::class)
    fun createCaseHeaderWidgets(event: CaseDefinitionCreatedEvent) {
        if (event.duplicate) {
            val headerWidget = service.findById(event.basedOnCaseDefinitionId!!)
            if (headerWidget != null) {
                service.create(
                    event.caseDefinitionId.key,
                    event.caseDefinitionId.versionTag.toString(),
                    CaseHeaderWidgetCreateDto(
                        type = headerWidget.type,
                        highContrast = headerWidget.highContrast,
                        properties = headerWidget.properties,
                    )
                )
            }
        }
    }

    @RunWithoutAuthorization
    @EventListener(CaseDefinitionPreDeleteEvent::class)
    fun handleCaseDefinitionPreDeleteEvent(event: CaseDefinitionPreDeleteEvent) {
        val headerWidget = service.findById(event.caseDefinitionId)
        if (headerWidget != null) {
            service.delete(event.caseDefinitionId)
        }
    }

}
