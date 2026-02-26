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

package com.ritense.valtimo.service

import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Expression
import jakarta.persistence.criteria.Path

interface TaskBusinessKeyResolver {

    /**
     * Creates an expression that resolves the business key for tasks where the
     * process instance business key doesn't directly refer to the case document.
     * Returns a subquery that yields the resolved key, or null if not applicable.
     */
    fun resolveBusinessKeyExpression(
        cb: CriteriaBuilder,
        query: AbstractQuery<*>,
        businessKeyPath: Path<String>
    ): Expression<String>?
}
