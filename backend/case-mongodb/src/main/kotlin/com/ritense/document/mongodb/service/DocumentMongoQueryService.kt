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

package com.ritense.document.mongodb.service

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationService
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.valtimo.contract.utils.SecurityUtils
import com.ritense.document.mongodb.authorization.MongoPermissionConditionTranslator
import com.ritense.document.mongodb.domain.JsonSchemaDocumentDocument
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query

class DocumentMongoQueryService(
    private val mongoTemplate: MongoTemplate,
    private val authorizationService: AuthorizationService,
    private val translator: MongoPermissionConditionTranslator,
) {

    /**
     * Returns a page of documents for the given [definitionName], restricted to those
     * the current user is allowed to see (VIEW_LIST action).
     */
    fun findAllByDefinitionName(definitionName: String, pageable: Pageable): Page<JsonSchemaDocumentDocument> {
        val combined = buildCriteria(JsonSchemaDocumentActionProvider.VIEW_LIST)
            .andOperator(Criteria.where("definitionId.name").`is`(definitionName))

        val countQuery = Query(combined)
        val dataQuery  = Query(combined).with(pageable)

        val total   = mongoTemplate.count(countQuery, JsonSchemaDocumentDocument::class.java)
        val content = mongoTemplate.find(dataQuery, JsonSchemaDocumentDocument::class.java)
        return PageImpl(content, pageable, total)
    }

    /**
     * Returns the document with the given [id] if the current user has VIEW permission,
     * or `null` if it does not exist or is not accessible.
     */
    fun findById(id: String): JsonSchemaDocumentDocument? {
        val combined = buildCriteria(JsonSchemaDocumentActionProvider.VIEW)
            .andOperator(Criteria.where("_id").`is`(id))
        return mongoTemplate.findOne(Query(combined), JsonSchemaDocumentDocument::class.java)
    }

    private fun buildCriteria(action: Action<JsonSchemaDocument>): Criteria {
        val userRoles = SecurityUtils.getCurrentUserRoles().toSet()
        val permissions = authorizationService.getPermissions(JsonSchemaDocument::class.java, action)
            .filter { it.role.key in userRoles }
        return translator.toCriteria(permissions, action)
    }
}
