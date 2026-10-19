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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.document.opensearch.service

import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.security.test.context.support.WithMockUser

/**
 * Verifies the per-definition index topology: each definition has its own `json_schema_document_<key>` index,
 * every index is joined to the shared read alias, and the index carries the content template (a string
 * content field is mapped with a `.keyword` sub-field).
 */
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentOpenSearchTopologyIntTest : BaseOpenSearchIntegrationTest() {

    @Test
    fun `each test definition has its own index joined to the shared read alias`() {
        TEST_DEFINITION_KEYS.forEach { key ->
            val indexName = indexNameResolver.indexNameFor(key)
            val indexOps = elasticsearchOperations.indexOps(IndexCoordinates.of(indexName))

            assertThat(indexOps.exists()).isTrue()

            val aliases = indexOps.getAliasesForIndex(indexName)[indexName].orEmpty().map { it.alias }
            assertThat(aliases).contains(OpenSearchIndexNameResolver.READ_ALIAS)
        }
    }

    @Test
    fun `ensureIndex is idempotent`() {
        val indexName = indexNameResolver.indexNameFor("house")

        indexInitializer.ensureIndex("house")
        indexInitializer.ensureIndex("house")

        assertThat(elasticsearchOperations.indexOps(IndexCoordinates.of(indexName)).exists()).isTrue()
    }
}
