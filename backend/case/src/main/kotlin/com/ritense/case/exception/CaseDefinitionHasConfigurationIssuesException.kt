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

package com.ritense.case.exception

import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.zalando.problem.AbstractThrowableProblem
import org.zalando.problem.Exceptional
import org.zalando.problem.Status

class CaseDefinitionHasConfigurationIssuesException(title: String?, detail: String?) :
    AbstractThrowableProblem(
        null,
        title,
        Status.BAD_REQUEST,
        detail
    ) {
    // Both title and detail are set on purpose: the frontend only renders a problem's message when
    // it carries a detail next to the title, and falls back to "Error Code: 400" otherwise.
    constructor(caseDefinitionId: CaseDefinitionId, issueTypes: Collection<String>) : this(
        "Failed to create case-definition-draft",
        "Case definition with id $caseDefinitionId has unresolved configuration issues: " +
            "${issueTypes.distinct().sorted().joinToString()}. " +
            "Resolve these before creating a new draft from it."
    )

    override fun getCause(): Exceptional? {
        return null
    }
}
