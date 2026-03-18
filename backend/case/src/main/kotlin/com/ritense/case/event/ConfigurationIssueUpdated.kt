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

package com.ritense.case.event

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.outbox.domain.BaseEvent

class ConfigurationIssueUpdated(
    caseDefinitionKey: String,
    caseDefinitionVersionTag: String
) : BaseEvent(
    type = TYPE,
    resultType = "com.ritense.case.domain.CaseDefinitionConfigurationIssue",
    resultId = caseDefinitionKey,
    result = ObjectMapper().createObjectNode().apply {
        put("caseDefinitionKey", caseDefinitionKey)
        put("caseDefinitionVersionTag", caseDefinitionVersionTag)
    }
) {
    companion object {
        const val TYPE = "com.ritense.valtimo.case.configuration-issue.updated"
    }
}
