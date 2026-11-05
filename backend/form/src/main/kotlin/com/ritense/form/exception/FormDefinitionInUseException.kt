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
package com.ritense.form.exception

import com.ritense.form.domain.FormProcessLink
import org.zalando.problem.AbstractThrowableProblem
import org.zalando.problem.Exceptional
import org.zalando.problem.Status
import java.util.UUID

class FormDefinitionInUseException(
    formDefinitionId: UUID,
    processLinks: Collection<FormProcessLink>,
) : AbstractThrowableProblem(
    null,
    "Form definition is in use",
    Status.CONFLICT,
    "One or more process links reference this form definition. " +
        "Remove the references before deleting the form definition.",
    null,
    null,
    mapOf(
        "formDefinitionId" to formDefinitionId.toString(),
        "usages" to processLinks.map {
            mapOf("processDefinitionId" to it.processDefinitionId, "activityId" to it.activityId)
        },
    ),
) {
    override fun getCause(): Exceptional? = null
}
