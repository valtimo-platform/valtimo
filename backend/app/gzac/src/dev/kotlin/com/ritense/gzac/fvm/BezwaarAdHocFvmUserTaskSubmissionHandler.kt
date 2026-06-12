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
import com.ritense.formviewmodel.commandhandling.CompleteTaskCommand
import com.ritense.formviewmodel.submission.FormViewModelUserTaskSubmissionHandler
import com.ritense.valtimo.operaton.domain.OperatonTask
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component

@Component
class BezwaarAdHocFvmUserTaskSubmissionHandler : FormViewModelUserTaskSubmissionHandler<BezwaarAdHocFvmViewModel> {

    override fun supports(formName: String): Boolean = formName == "bezwaar-ad-hoc-fvm-task"

    override fun <T> handle(submission: T, task: OperatonTask, businessKey: String) {
        val viewModel = submission as BezwaarAdHocFvmViewModel

        logger.info {
            "Bezwaar ad-hoc FVM user task submission: beoordeling='${viewModel.beoordeling}', " +
                "taskId=${task.id}, businessKey=$businessKey"
        }

        dispatchCommand(CompleteTaskCommand(task.id))
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
