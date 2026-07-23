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
import org.springframework.stereotype.Component

@SkipComponentScan
@Component
class TaskValueResolver : ValueResolverFactory {

    override fun supportedPrefix(): String {
        return "task"
    }

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
