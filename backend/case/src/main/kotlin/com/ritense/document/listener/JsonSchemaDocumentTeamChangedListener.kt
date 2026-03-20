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

package com.ritense.document.listener

import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authentication.TeamDeletedEvent
import com.ritense.valtimo.contract.authentication.TeamUpdatedEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@SkipComponentScan
@Component
class JsonSchemaDocumentTeamChangedListener(
    private val jsonSchemaDocumentRepository: JsonSchemaDocumentRepository,
) {

    @EventListener
    @Transactional
    fun onTeamUpdated(event: TeamUpdatedEvent) {
        jsonSchemaDocumentRepository.updateTeamTitle(event.teamKey, event.newTitle)
    }

    @EventListener
    @Transactional
    fun onTeamDeleted(event: TeamDeletedEvent) {
        jsonSchemaDocumentRepository.clearTeamAssignment(event.teamKey)
    }
}
