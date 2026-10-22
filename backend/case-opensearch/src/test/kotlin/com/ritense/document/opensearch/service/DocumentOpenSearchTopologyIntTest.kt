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
 * Verifies the per-definition index topology: each definition is fronted by a `json_schema_document_<key>`
 * alias over a single concrete index, and that concrete index is also joined to the shared read alias (so the
 * same stable name can be rebuilt and swapped atomically while "All cases" keeps serving).
 */
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentOpenSearchTopologyIntTest : BaseOpenSearchIntegrationTest() {

    @Test
    fun `each test definition is fronted by its own alias over a concrete index joined to the shared read alias`() {
        TEST_DEFINITION_KEYS.forEach { key ->
            val perDefinitionAlias = indexNameResolver.indexNameFor(key)
            val indexOps = elasticsearchOperations.indexOps(IndexCoordinates.of(perDefinitionAlias))

            assertThat(indexOps.exists()).isTrue()

            // getAliasesForIndex on an alias resolves to the backing concrete index(es); assert exactly one
            // concrete index backs the alias and that it carries both the per-definition and read aliases.
            val byConcrete = indexOps.getAliasesForIndex(perDefinitionAlias)
            assertThat(byConcrete).hasSize(1)
            val aliases = byConcrete.values.flatten().map { it.alias }
            assertThat(aliases).contains(perDefinitionAlias, OpenSearchIndexNameResolver.READ_ALIAS)
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
