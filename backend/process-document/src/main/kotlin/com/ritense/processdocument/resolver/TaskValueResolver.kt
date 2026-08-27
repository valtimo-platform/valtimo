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

package com.ritense.processdocument.resolver

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valueresolver.ValueResolverFactory
import com.ritense.valueresolver.ValueResolverOption
import com.ritense.valueresolver.exception.ValueResolverValidationException
import java.util.function.Function
import org.operaton.bpm.engine.delegate.VariableScope
import org.springframework.stereotype.Component

/**
 * Validates and lists 'task:' paths, but deliberately resolves none.
 *
 * A 'task:' path names a column of the task a row is being rendered for, so it can only be resolved by
 * a caller that has that task: CaseTaskListSearchService reads these columns off the task row it
 * queried, and never asks the value resolver for them. Resolving against a document or a process
 * instance has no task to read from - a case has any number of tasks - so [createResolver] refuses
 * rather than guessing.
 *
 * Only the task list and task search field editors should therefore offer these paths. Every other
 * value picker excludes the 'task' prefix, because configuration pointing at a 'task:' path would fail
 * the first time it is rendered.
 */
@SkipComponentScan
@Component
class TaskValueResolver : ValueResolverFactory {

    override fun supportedPrefix(): String {
        return "task"
    }

    override fun createResolver(properties: Map<String, Any>): Function<String, Any?> = refuse()

    override fun createResolver(documentId: String): Function<String, Any?> = refuse()

    override fun createResolver(
        processInstanceId: String,
        variableScope: VariableScope
    ): Function<String, Any?> = refuse()

    override fun createValidator(documentDefinitionName: String): Function<String, Unit> {
        return Function { requestedValue ->
            if (!TABLE_COLUMN_LIST.contains(requestedValue)) {
                throw ValueResolverValidationException("Unknown task column with name: $requestedValue")
            }
        }
    }

    override fun getResolvableKeyOptions(caseDefinitionId: CaseDefinitionId): List<ValueResolverOption> {
        return createFieldList(TABLE_COLUMN_LIST)
    }

    override fun getResolvableKeyOptions(caseDefinitionKey: String): List<ValueResolverOption> {
        return createFieldList(TABLE_COLUMN_LIST)
    }

    private fun refuse(): Nothing = throw UnsupportedOperationException(
        "A 'task:' path cannot be resolved through the value resolver, because the context it is " +
            "resolved in has no single task to read from."
    )

    companion object {
        val TABLE_COLUMN_LIST = listOf(
            "assignedTeamTitle",
            "assignee",
            "createTime",
            "dueDate",
            "name",
        )
    }
}
