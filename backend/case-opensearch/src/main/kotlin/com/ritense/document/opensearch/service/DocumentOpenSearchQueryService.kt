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

package com.ritense.document.opensearch.service

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationService
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.opensearch.authorization.OpenSearchPermissionConditionTranslator
import com.ritense.document.opensearch.authorization.OpenSearchPermissionConditionTranslator.Companion.andAll
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.valtimo.contract.utils.SecurityUtils
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.query_dsl.Query
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.query.NativeQuery

class DocumentOpenSearchQueryService(
    private val elasticsearchOperations: ElasticsearchOperations,
    private val authorizationService: AuthorizationService,
    private val translator: OpenSearchPermissionConditionTranslator,
) {

    /**
     * Returns a page of documents for the given [definitionName], restricted to those
     * the current user is allowed to see (VIEW_LIST action).
     */
    fun findAllByDefinitionName(definitionName: String, pageable: Pageable): Page<JsonSchemaDocumentOsDocument> {
        val authQuery = buildAuthQuery(JsonSchemaDocumentActionProvider.VIEW_LIST)
        val definitionFilter = Query.of { q ->
            q.term { t -> t.field("definitionId.name").value(FieldValue.of(definitionName)) }
        }
        val combined = andAll(listOf(authQuery, definitionFilter))

        val countQuery = NativeQuery.builder().withQuery(combined).build()
        val dataQuery = NativeQuery.builder().withQuery(combined).withPageable(pageable).build()

        val total = elasticsearchOperations.count(countQuery, JsonSchemaDocumentOsDocument::class.java)
        val hits = elasticsearchOperations.search(dataQuery, JsonSchemaDocumentOsDocument::class.java)
        val content = hits.searchHits.mapNotNull { it.content }
        return PageImpl(content, pageable, total)
    }

    /**
     * Returns the document with the given [id] if the current user has VIEW permission,
     * or `null` if it does not exist or is not accessible.
     */
    fun findById(id: String): JsonSchemaDocumentOsDocument? {
        val authQuery = buildAuthQuery(JsonSchemaDocumentActionProvider.VIEW)
        val idFilter = Query.of { q -> q.ids { i -> i.values(listOf(id)) } }
        val combined = andAll(listOf(authQuery, idFilter))

        val query = NativeQuery.builder().withQuery(combined).build()
        val hits = elasticsearchOperations.search(query, JsonSchemaDocumentOsDocument::class.java)
        return hits.searchHits.firstOrNull()?.content
    }

    private fun buildAuthQuery(action: Action<JsonSchemaDocument>): Query {
        val userRoles = SecurityUtils.getCurrentUserRoles().toSet()
        val permissions = authorizationService.getPermissions(JsonSchemaDocument::class.java, action)
            .filter { it.role.key in userRoles }
        return translator.toQuery(permissions, action)
    }
}
