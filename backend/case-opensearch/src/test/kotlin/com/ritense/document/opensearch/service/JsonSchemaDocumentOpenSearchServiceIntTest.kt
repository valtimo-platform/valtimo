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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.document.opensearch.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.service.DocumentSearchService
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import org.springframework.security.test.context.support.WithMockUser

@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class JsonSchemaDocumentOpenSearchServiceIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var documentSearchService: DocumentSearchService

    @Test
    fun `globalSearchFilter returns matching document`() {
        seedDocument("Funenpark")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("Funenpark"),
            PageRequest.of(0, 10)
        )

        assertThat(page.totalElements).isEqualTo(1L)
    }

    @Test
    fun `globalSearchFilter is case insensitive`() {
        seedDocument("Funenpark")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("FUNENPARK"),
            PageRequest.of(0, 10)
        )

        assertThat(page.totalElements).isEqualTo(1L)
    }

    @Test
    fun `globalSearchFilter excludes non-matching documents`() {
        val docA = seedDocument("Funenpark")
        seedDocument("Keizersgracht")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("Funenpark"),
            PageRequest.of(0, 10)
        )

        assertThat(page.totalElements).isEqualTo(1L)
        assertThat(page.content[0].id()).isEqualTo(docA.id())
    }

    @Test
    fun `no globalSearchFilter returns all authorized documents`() {
        seedDocument("Funenpark")
        seedDocument("Keizersgracht")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest(),
            PageRequest.of(0, 10)
        )

        assertThat(page.totalElements).isEqualTo(2L)
    }

    @Test
    fun `globalSearchFilter supports partial match`() {
        seedDocument("Keizersgracht")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("Keizers"),
            PageRequest.of(0, 10)
        )

        assertThat(page.totalElements).isEqualTo(1L)
    }

    private fun seedDocument(street: String): JsonSchemaDocument {
        val content = objectMapper.createObjectNode().apply { put("street", street) }
        val jpaDoc = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest("house", "house", "1.0.0", content)
            ).resultingDocument().get()
        }
        openSearchRepository.save(
            JsonSchemaDocumentOsDocument(
                id = jpaDoc.id().toString(),
                content = mapOf("street" to street),
                definitionId = mapOf(
                    "name" to "house",
                    "blueprintId" to mapOf("blueprintType" to "CASE"),
                ),
                createdOn = null,
                modifiedOn = null,
                createdBy = null,
                sequence = null,
                version = null,
                assigneeId = null,
                assigneeFullName = null,
                internalStatus = null,
                caseTags = null,
                relations = null,
                relatedFiles = null,
                retentionDate = null,
                contentText = street,
            )
        )
        return jpaDoc
    }
}
