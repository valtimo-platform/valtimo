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

package com.ritense.gzac.fvm

import com.ritense.commandhandling.dispatchCommand
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.formviewmodel.commandhandling.StartProcessCommand
import com.ritense.formviewmodel.submission.FormViewModelStartFormSubmissionHandler
import com.ritense.formviewmodel.web.rest.dto.StartFormSubmissionResult
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component

@Component
class BezwaarAdHocFvmStartFormSubmissionHandler : FormViewModelStartFormSubmissionHandler<BezwaarAdHocFvmViewModel> {

    override fun supports(formName: String): Boolean = formName == "bezwaar-ad-hoc-fvm-start"

    override fun <T> handle(
        documentDefinitionName: String,
        processDefinitionKey: String,
        submission: T,
        document: JsonSchemaDocument?,
    ): StartFormSubmissionResult {
        val viewModel = submission as BezwaarAdHocFvmViewModel

        logger.info {
            "Bezwaar ad-hoc FVM submission: omschrijving='${viewModel.omschrijving}', " +
                "toelichting='${viewModel.toelichting}', documentDefinitionName=$documentDefinitionName"
        }

        requireNotNull(document) { "Document is required for supporting process start" }
        val caseInstanceId = document.id.id

        dispatchCommand(
            StartProcessCommand(
                caseInstanceId = caseInstanceId,
                processDefinitionKey = processDefinitionKey,
                businessKey = caseInstanceId.toString(),
                processVariables = mapOf(
                    "omschrijving" to (viewModel.omschrijving ?: ""),
                    "toelichting" to (viewModel.toelichting ?: ""),
                )
            )
        )

        return StartFormSubmissionResult(caseInstanceId)
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
