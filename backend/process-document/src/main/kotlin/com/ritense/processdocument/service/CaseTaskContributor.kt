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

package com.ritense.processdocument.service

import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.valtimo.operaton.domain.OperatonTask
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Predicate
import jakarta.persistence.criteria.Root

interface CaseTaskContributor {

    /**
     * Creates a predicate that includes additional tasks (e.g. building block tasks)
     * in the case-filtered task list query. The predicate is OR'd with the direct
     * business key match.
     */
    fun createTaskInclusionPredicate(
        cb: CriteriaBuilder,
        query: AbstractQuery<*>,
        taskRoot: Root<OperatonTask>,
        documentRoot: Root<JsonSchemaDocument>,
        caseDefinitionName: String
    ): Predicate?
}
