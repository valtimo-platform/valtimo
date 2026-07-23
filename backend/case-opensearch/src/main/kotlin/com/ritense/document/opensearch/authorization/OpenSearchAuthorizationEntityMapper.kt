/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.document.opensearch.authorization

import com.ritense.authorization.permission.condition.PermissionCondition
import org.opensearch.index.query.QueryBuilder

/**
 * OpenSearch equivalent of [com.ritense.authorization.AuthorizationEntityMapper].
 *
 * Translates a [com.ritense.authorization.permission.condition.ContainerPermissionCondition]
 * on entity type [TO] into an OpenSearch [QueryBuilder] that filters [FROM] documents.
 *
 * Implement this interface and register the implementation as a Spring bean to add support
 * for a new container relationship without modifying the core translator.
 */
interface OpenSearchAuthorizationEntityMapper<FROM : Any, TO : Any> {

    /**
     * Given conditions on the [TO] entity type, returns an OpenSearch [QueryBuilder] that filters
     * [FROM] documents satisfying those conditions, or `null` if no filter is needed
     * (i.e. any [FROM] document qualifies regardless of [conditions]).
     */
    fun mapQuery(conditions: List<PermissionCondition>): QueryBuilder?

    fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean
}
