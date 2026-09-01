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

package com.ritense.document.opensearch.authorization

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.condition.ContainerPermissionCondition
import com.ritense.authorization.permission.condition.ExpressionPermissionCondition
import com.ritense.authorization.permission.condition.FieldPermissionCondition
import com.ritense.authorization.permission.condition.PermissionConditionOperator
import com.ritense.authorization.permission.condition.PermissionConditionOperator.EQUAL_TO
import com.ritense.authorization.permission.condition.PermissionConditionOperator.GREATER_THAN
import com.ritense.authorization.permission.condition.PermissionConditionOperator.GREATER_THAN_OR_EQUAL_TO
import com.ritense.authorization.permission.condition.PermissionConditionOperator.IN
import com.ritense.authorization.permission.condition.PermissionConditionOperator.LESS_THAN
import com.ritense.authorization.permission.condition.PermissionConditionOperator.LESS_THAN_OR_EQUAL_TO
import com.ritense.authorization.permission.condition.PermissionConditionOperator.LIST_CONTAINS
import com.ritense.authorization.permission.condition.PermissionConditionOperator.NOT_EQUAL_TO
import com.ritense.authorization.role.Role
import com.ritense.authorization.specification.AuthorizationSpecification
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.junit.jupiter.api.assertThrows
import org.opensearch.index.query.BoolQueryBuilder
import org.opensearch.index.query.ExistsQueryBuilder
import org.opensearch.index.query.IdsQueryBuilder
import org.opensearch.index.query.MatchAllQueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.opensearch.index.query.RangeQueryBuilder
import org.opensearch.index.query.TermQueryBuilder
import org.opensearch.index.query.TermsQueryBuilder
import java.util.UUID

class OpenSearchPermissionConditionTranslatorTest {

    private lateinit var authorizationService: AuthorizationService
    private lateinit var documentRepository: JsonSchemaDocumentRepository
    private lateinit var translator: OpenSearchPermissionConditionTranslator

    @BeforeEach
    fun setUp() {
        authorizationService = mock()
        documentRepository = mock()
        translator = OpenSearchPermissionConditionTranslator(
            openSearchMappers = emptyList(),
            authorizationService = authorizationService,
            documentRepository = documentRepository,
        )
    }

    @Test
    fun `jpaFallback returns ids query with matching document IDs`() {
        val docId1 = UUID.randomUUID()
        val docId2 = UUID.randomUUID()
        val doc1 = mockDocument(docId1)
        val doc2 = mockDocument(docId2)

        val spec: AuthorizationSpecification<JsonSchemaDocument> = mock()
        whenever(authorizationService.getAuthorizationSpecification<JsonSchemaDocument>(any(), any()))
            .thenReturn(spec)
        whenever(documentRepository.findAll(spec)).thenReturn(listOf(doc1, doc2))

        val condition = ContainerPermissionCondition(
            resourceType = UnmappedEntity::class.java,
            conditions = listOf(
                FieldPermissionCondition("someField", PermissionConditionOperator.EQUAL_TO, "someValue")
            )
        )
        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(condition)),
            role = Role(key = "test-role"),
        )

        val result = translator.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.VIEW))

        assertThat(result).isInstanceOf(IdsQueryBuilder::class.java)
        val idsQuery = result as IdsQueryBuilder
        assertThat(idsQuery.ids()).containsExactlyInAnyOrder(docId1.toString(), docId2.toString())
    }

    @Test
    fun `jpaFallback returns empty ids query when no documents match`() {
        val spec: AuthorizationSpecification<JsonSchemaDocument> = mock()
        whenever(authorizationService.getAuthorizationSpecification<JsonSchemaDocument>(any(), any()))
            .thenReturn(spec)
        whenever(documentRepository.findAll(spec)).thenReturn(emptyList())

        val condition = ContainerPermissionCondition(
            resourceType = UnmappedEntity::class.java,
            conditions = emptyList()
        )
        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(condition)),
            role = Role(key = "test-role"),
        )

        val result = translator.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.VIEW))

        assertThat(result).isInstanceOf(IdsQueryBuilder::class.java)
        val idsQuery = result as IdsQueryBuilder
        assertThat(idsQuery.ids()).isEmpty()
    }

    @Test
    fun `translateContainer uses mapper when available`() {
        val mockMapper: OpenSearchAuthorizationEntityMapper<JsonSchemaDocument, MappedEntity> = mock()
        whenever(mockMapper.supports(JsonSchemaDocument::class.java, MappedEntity::class.java)).thenReturn(true)
        whenever(mockMapper.mapQuery(any())).thenReturn(QueryBuilders.matchAllQuery())

        val translatorWithMapper = OpenSearchPermissionConditionTranslator(
            openSearchMappers = listOf(mockMapper),
            authorizationService = authorizationService,
            documentRepository = documentRepository,
        )

        val condition = ContainerPermissionCondition(
            resourceType = MappedEntity::class.java,
            conditions = emptyList()
        )
        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(condition)),
            role = Role(key = "test-role"),
        )

        val result = translatorWithMapper.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.VIEW))

        verify(mockMapper).mapQuery(any())
        verify(authorizationService, never()).getAuthorizationSpecification<JsonSchemaDocument>(any(), any())
        assertThat(result).isInstanceOf(MatchAllQueryBuilder::class.java)
    }

    @Test
    fun `translateContainer falls back to JPA when no mapper supports the type`() {
        val spec: AuthorizationSpecification<JsonSchemaDocument> = mock()
        whenever(authorizationService.getAuthorizationSpecification<JsonSchemaDocument>(any(), any()))
            .thenReturn(spec)
        whenever(documentRepository.findAll(spec)).thenReturn(emptyList())

        val condition = ContainerPermissionCondition(
            resourceType = UnmappedEntity::class.java,
            conditions = emptyList()
        )
        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(condition)),
            role = Role(key = "test-role"),
        )

        translator.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.VIEW))

        verify(authorizationService).getAuthorizationSpecification<JsonSchemaDocument>(any(), any())
        verify(documentRepository).findAll(spec)
    }

    // --- toQuery edge cases ---

    @Test
    fun `toQuery returns deny-all when no permissions match action`() {
        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(emptyList()),
            role = Role(key = "test-role"),
        )

        val result = translator.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.DELETE))

        assertThat(result).isInstanceOf(IdsQueryBuilder::class.java)
        assertThat((result as IdsQueryBuilder).ids()).isEmpty()
    }

    @Test
    fun `toQuery returns deny-all when permissions list is empty`() {
        val result = translator.toQuery(emptyList(), Action<JsonSchemaDocument>(Action.VIEW))

        assertThat(result).isInstanceOf(IdsQueryBuilder::class.java)
        assertThat((result as IdsQueryBuilder).ids()).isEmpty()
    }

    @Test
    fun `toQuery ORs multiple permissions together`() {
        val permission1 = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(
                FieldPermissionCondition("createdBy", EQUAL_TO, "user1")
            )),
            role = Role(key = "role1"),
        )
        val permission2 = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(
                FieldPermissionCondition("createdBy", EQUAL_TO, "user2")
            )),
            role = Role(key = "role2"),
        )

        val result = translator.toQuery(listOf(permission1, permission2), Action<JsonSchemaDocument>(Action.VIEW))

        assertThat(result).isInstanceOf(BoolQueryBuilder::class.java)
        val boolQuery = result as BoolQueryBuilder
        assertThat(boolQuery.should()).hasSize(2)
        assertThat(boolQuery.minimumShouldMatch()).isEqualTo("1")
    }

    @Test
    fun `toQuery ANDs multiple conditions within a permission`() {
        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(
                FieldPermissionCondition("createdBy", EQUAL_TO, "user1"),
                FieldPermissionCondition("assigneeId", EQUAL_TO, "user2")
            )),
            role = Role(key = "test-role"),
        )

        val result = translator.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.VIEW))

        assertThat(result).isInstanceOf(BoolQueryBuilder::class.java)
        val boolQuery = result as BoolQueryBuilder
        assertThat(boolQuery.must()).hasSize(2)
    }

    @Test
    fun `toQuery returns single query unwrapped when only one permission with one condition`() {
        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(
                FieldPermissionCondition("createdBy", EQUAL_TO, "user1")
            )),
            role = Role(key = "test-role"),
        )

        val result = translator.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.VIEW))

        assertThat(result).isInstanceOf(TermQueryBuilder::class.java)
    }

    // --- applyOperator tests ---

    @Test
    fun `applyOperator EQUAL_TO with value returns term query`() {
        val result = OpenSearchPermissionConditionTranslator.applyOperator("field", EQUAL_TO, "value")

        assertThat(result).isInstanceOf(TermQueryBuilder::class.java)
        val termQuery = result as TermQueryBuilder
        assertThat(termQuery.fieldName()).isEqualTo("field")
        assertThat(termQuery.value()).isEqualTo("value")
    }

    @Test
    fun `applyOperator EQUAL_TO with null returns must-not-exists query`() {
        val result = OpenSearchPermissionConditionTranslator.applyOperator("field", EQUAL_TO, null)

        assertThat(result).isInstanceOf(BoolQueryBuilder::class.java)
        val boolQuery = result as BoolQueryBuilder
        assertThat(boolQuery.mustNot()).hasSize(1)
        assertThat(boolQuery.mustNot()[0]).isInstanceOf(ExistsQueryBuilder::class.java)
    }

    @Test
    fun `applyOperator NOT_EQUAL_TO with value returns must-not-term query`() {
        val result = OpenSearchPermissionConditionTranslator.applyOperator("field", NOT_EQUAL_TO, "value")

        assertThat(result).isInstanceOf(BoolQueryBuilder::class.java)
        val boolQuery = result as BoolQueryBuilder
        assertThat(boolQuery.mustNot()).hasSize(1)
        assertThat(boolQuery.mustNot()[0]).isInstanceOf(TermQueryBuilder::class.java)
    }

    @Test
    fun `applyOperator NOT_EQUAL_TO with null returns exists query`() {
        val result = OpenSearchPermissionConditionTranslator.applyOperator("field", NOT_EQUAL_TO, null)

        assertThat(result).isInstanceOf(ExistsQueryBuilder::class.java)
    }

    @Test
    fun `applyOperator GREATER_THAN returns range query with gt`() {
        val result = OpenSearchPermissionConditionTranslator.applyOperator("field", GREATER_THAN, 10)

        assertThat(result).isInstanceOf(RangeQueryBuilder::class.java)
        val rangeQuery = result as RangeQueryBuilder
        assertThat(rangeQuery.from()).isEqualTo(10)
        assertThat(rangeQuery.includeLower()).isFalse()
    }

    @Test
    fun `applyOperator GREATER_THAN_OR_EQUAL_TO returns range query with gte`() {
        val result = OpenSearchPermissionConditionTranslator.applyOperator("field", GREATER_THAN_OR_EQUAL_TO, 10)

        assertThat(result).isInstanceOf(RangeQueryBuilder::class.java)
        val rangeQuery = result as RangeQueryBuilder
        assertThat(rangeQuery.from()).isEqualTo(10)
        assertThat(rangeQuery.includeLower()).isTrue()
    }

    @Test
    fun `applyOperator LESS_THAN returns range query with lt`() {
        val result = OpenSearchPermissionConditionTranslator.applyOperator("field", LESS_THAN, 10)

        assertThat(result).isInstanceOf(RangeQueryBuilder::class.java)
        val rangeQuery = result as RangeQueryBuilder
        assertThat(rangeQuery.to()).isEqualTo(10)
        assertThat(rangeQuery.includeUpper()).isFalse()
    }

    @Test
    fun `applyOperator LESS_THAN_OR_EQUAL_TO returns range query with lte`() {
        val result = OpenSearchPermissionConditionTranslator.applyOperator("field", LESS_THAN_OR_EQUAL_TO, 10)

        assertThat(result).isInstanceOf(RangeQueryBuilder::class.java)
        val rangeQuery = result as RangeQueryBuilder
        assertThat(rangeQuery.to()).isEqualTo(10)
        assertThat(rangeQuery.includeUpper()).isTrue()
    }

    @Test
    fun `applyOperator LIST_CONTAINS returns term query`() {
        val result = OpenSearchPermissionConditionTranslator.applyOperator("field", LIST_CONTAINS, "value")

        assertThat(result).isInstanceOf(TermQueryBuilder::class.java)
    }

    @Test
    fun `applyOperator IN returns terms query`() {
        val result = OpenSearchPermissionConditionTranslator.applyOperator("field", IN, listOf("a", "b", "c"))

        assertThat(result).isInstanceOf(TermsQueryBuilder::class.java)
    }

    @Test
    fun `applyOperator IN throws when value is not a collection`() {
        assertThrows<IllegalArgumentException> {
            OpenSearchPermissionConditionTranslator.applyOperator("field", IN, "not-a-collection")
        }
    }

    // --- Field and expression translation ---

    @Test
    fun `translateField maps JPA field to OpenSearch field`() {
        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(
                FieldPermissionCondition("content.content", EQUAL_TO, 123)
            )),
            role = Role(key = "test-role"),
        )

        val result = translator.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.VIEW))

        assertThat(result).isInstanceOf(TermQueryBuilder::class.java)
        val termQuery = result as TermQueryBuilder
        assertThat(termQuery.fieldName()).isEqualTo("content")
    }

    @Test
    fun `translateField adds keyword suffix for string content fields`() {
        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(
                ExpressionPermissionCondition("content", "$.name", EQUAL_TO, "John", String::class.java)
            )),
            role = Role(key = "test-role"),
        )

        val result = translator.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.VIEW))

        assertThat(result).isInstanceOf(TermQueryBuilder::class.java)
        val termQuery = result as TermQueryBuilder
        assertThat(termQuery.fieldName()).isEqualTo("content.name.keyword")
    }

    @Test
    fun `translateExpression does not add keyword suffix for non-string values`() {
        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(
                ExpressionPermissionCondition("content", "$.age", EQUAL_TO, 25, Int::class.java)
            )),
            role = Role(key = "test-role"),
        )

        val result = translator.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.VIEW))

        assertThat(result).isInstanceOf(TermQueryBuilder::class.java)
        val termQuery = result as TermQueryBuilder
        assertThat(termQuery.fieldName()).isEqualTo("content.age")
    }

    @Test
    fun `translateExpression does not add keyword suffix for range operators`() {
        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(
                ExpressionPermissionCondition("content", "$.name", GREATER_THAN, "A", String::class.java)
            )),
            role = Role(key = "test-role"),
        )

        val result = translator.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.VIEW))

        assertThat(result).isInstanceOf(RangeQueryBuilder::class.java)
        val rangeQuery = result as RangeQueryBuilder
        assertThat(rangeQuery.fieldName()).isEqualTo("content.name")
    }

    @Test
    fun `translateField maps internalStatus to OpenSearch field`() {
        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(
                FieldPermissionCondition("internalStatus.id.key", EQUAL_TO, "completed")
            )),
            role = Role(key = "test-role"),
        )

        val result = translator.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.VIEW))

        assertThat(result).isInstanceOf(TermQueryBuilder::class.java)
        val termQuery = result as TermQueryBuilder
        assertThat(termQuery.fieldName()).isEqualTo("internalStatus")
        assertThat(termQuery.value()).isEqualTo("completed")
    }

    @Test
    fun `translateField maps caseTags with LIST_CONTAINS to OpenSearch field`() {
        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(
                FieldPermissionCondition("caseTags", LIST_CONTAINS, "urgent")
            )),
            role = Role(key = "test-role"),
        )

        val result = translator.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.VIEW))

        assertThat(result).isInstanceOf(TermQueryBuilder::class.java)
        val termQuery = result as TermQueryBuilder
        assertThat(termQuery.fieldName()).isEqualTo("caseTags.key")
        assertThat(termQuery.value()).isEqualTo("urgent")
    }

    // --- Helper methods ---

    @Test
    fun `jpaToOsField returns mapped field name`() {
        assertThat(OpenSearchPermissionConditionTranslator.jpaToOsField("content.content")).isEqualTo("content")
        assertThat(OpenSearchPermissionConditionTranslator.jpaToOsField("createdBy")).isEqualTo("createdBy")
        assertThat(OpenSearchPermissionConditionTranslator.jpaToOsField("assigneeId")).isEqualTo("assigneeId")
        assertThat(OpenSearchPermissionConditionTranslator.jpaToOsField("internalStatus.id.key")).isEqualTo("internalStatus")
        assertThat(OpenSearchPermissionConditionTranslator.jpaToOsField("caseTags")).isEqualTo("caseTags.key")
    }

    @Test
    fun `jpaToOsField returns original field name when no mapping exists`() {
        assertThat(OpenSearchPermissionConditionTranslator.jpaToOsField("unmappedField")).isEqualTo("unmappedField")
    }

    @Test
    fun `isDynamicTextField returns true for string content field with term operator`() {
        assertThat(OpenSearchPermissionConditionTranslator.isDynamicTextField("content.name", EQUAL_TO, "value")).isTrue()
        assertThat(OpenSearchPermissionConditionTranslator.isDynamicTextField("content.name", NOT_EQUAL_TO, "value")).isTrue()
        assertThat(OpenSearchPermissionConditionTranslator.isDynamicTextField("content.name", LIST_CONTAINS, "value")).isTrue()
        assertThat(OpenSearchPermissionConditionTranslator.isDynamicTextField("content.name", IN, listOf("a", "b"))).isTrue()
    }

    @Test
    fun `isDynamicTextField returns false for non-content fields`() {
        assertThat(OpenSearchPermissionConditionTranslator.isDynamicTextField("createdBy", EQUAL_TO, "value")).isFalse()
    }

    @Test
    fun `isDynamicTextField returns false for null value`() {
        assertThat(OpenSearchPermissionConditionTranslator.isDynamicTextField("content.name", EQUAL_TO, null)).isFalse()
    }

    @Test
    fun `isDynamicTextField returns false for non-term operators`() {
        assertThat(OpenSearchPermissionConditionTranslator.isDynamicTextField("content.name", GREATER_THAN, "value")).isFalse()
        assertThat(OpenSearchPermissionConditionTranslator.isDynamicTextField("content.name", LESS_THAN, "value")).isFalse()
    }

    @Test
    fun `isDynamicTextField returns false for non-string values`() {
        assertThat(OpenSearchPermissionConditionTranslator.isDynamicTextField("content.age", EQUAL_TO, 25)).isFalse()
    }

    @Test
    fun `translateCondition throws for unknown condition type`() {
        val unknownCondition = UnknownPermissionCondition()

        val permission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<JsonSchemaDocument>(Action.VIEW)),
            conditionContainer = ConditionContainer(listOf(unknownCondition)),
            role = Role(key = "test-role"),
        )

        assertThrows<IllegalArgumentException> {
            translator.toQuery(listOf(permission), Action<JsonSchemaDocument>(Action.VIEW))
        }
    }

    class UnknownPermissionCondition : com.ritense.authorization.permission.condition.PermissionCondition(
        com.ritense.authorization.permission.condition.PermissionConditionType.FIELD
    ) {
        override fun <T : Any> isValid(entity: T): Boolean = true
        override fun <T : Any> toPredicate(
            root: jakarta.persistence.criteria.Root<T>,
            query: jakarta.persistence.criteria.AbstractQuery<*>,
            criteriaBuilder: jakarta.persistence.criteria.CriteriaBuilder,
            resourceType: Class<T>,
            queryDialectHelper: com.ritense.valtimo.contract.database.QueryDialectHelper
        ): jakarta.persistence.criteria.Predicate = criteriaBuilder.conjunction()
    }

    private fun mockDocument(id: UUID): JsonSchemaDocument {
        val doc: JsonSchemaDocument = mock()
        val docId = JsonSchemaDocumentId.existingId(id)
        whenever(doc.id()).thenReturn(docId)
        return doc
    }

    class UnmappedEntity
    class MappedEntity
}
