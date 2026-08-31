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

package com.ritense.buildingblock.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import java.util.UUID

/** The search, ordering and paging are done by the database, so they run against a real one. */
class BuildingBlockManagementServiceSearchIT : BaseIntegrationTest() {

    private lateinit var prefix: String
    private val stored = mutableListOf<BuildingBlockDefinitionId>()

    @BeforeEach
    fun setUp() {
        // Classpath definitions share the table, so every assertion is scoped by a unique key and name prefix.
        prefix = "srch${UUID.randomUUID().toString().take(8)}"
        stored.clear()
    }

    @AfterEach
    fun tearDown() {
        // The table is shared with every other test in this context - leave it as we found it.
        stored.forEach { buildingBlockDefinitionRepository.deleteById(it) }
        buildingBlockDefinitionRepository.flush()
    }

    private fun store(keySuffix: String, versionTag: String, name: String) {
        val id = BuildingBlockDefinitionId.of("$prefix-$keySuffix", versionTag)
        buildingBlockDefinitionRepository.saveAndFlush(
            BuildingBlockDefinition(
                id = id,
                name = "$prefix $name",
                description = null,
                createdBy = null,
                createdDate = null,
                basedOnVersionTag = null,
                final = false
            )
        )
        stored += id
    }

    private fun search(
        searchTerm: String? = prefix,
        pageable: PageRequest = PageRequest.of(0, 50)
    ) = runWithoutAuthorization {
        buildingBlockManagementService.searchLatestPerKey(searchTerm, pageable)
    }

    private fun names(page: org.springframework.data.domain.Page<BuildingBlockDefinitionDto>) =
        page.content.map { it.name.removePrefix("$prefix ") }

    @Test
    fun `sorts by name ascending by default, ignoring case`() {
        store("c", "1.0.0", "charlie")
        store("a", "1.0.0", "Alpha")
        store("b", "1.0.0", "bravo")

        val page = search()

        assertThat(names(page)).containsExactly("Alpha", "bravo", "charlie")
        assertThat(page.totalElements).isEqualTo(3)
    }

    @Test
    fun `honours an explicit descending sort`() {
        store("a", "1.0.0", "Alpha")
        store("b", "1.0.0", "Bravo")

        val page = search(pageable = PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "name")))

        assertThat(names(page)).containsExactly("Bravo", "Alpha")
    }

    @Test
    fun `sorts on the key, which lives inside the embedded id`() {
        store("zulu", "1.0.0", "Alpha")
        store("alfa", "1.0.0", "Bravo")

        val page = search(pageable = PageRequest.of(0, 50, Sort.by(Sort.Direction.ASC, "key")))

        assertThat(page.content.map { it.key }).containsExactly("$prefix-alfa", "$prefix-zulu")
    }

    @Test
    fun `returns only the latest version per key, by SemVer and not lexicographically`() {
        store("a", "1.2.0", "Alpha")
        store("a", "1.9.0", "Alpha")
        store("a", "1.10.0", "Alpha")

        val page = search()

        assertThat(page.totalElements).isEqualTo(1)
        assertThat(page.content.single().versionTag).isEqualTo("1.10.0")
    }

    @Test
    fun `filters on name and on key, case insensitively`() {
        store("invoice-handling", "1.0.0", "Invoice handling")
        store("permit", "1.0.0", "Permit request")

        assertThat(search("$prefix INVOICE").content.map { it.key })
            .containsExactly("$prefix-invoice-handling")

        assertThat(search("$prefix-PERMIT").content.map { it.key })
            .containsExactly("$prefix-permit")
    }

    @Test
    fun `matches the latest version's name, not an older version's`() {
        store("renamed", "1.0.0", "Old name")
        store("renamed", "2.0.0", "New name")

        // The old version's name must not pull its key into the result...
        assertThat(search("$prefix Old name").content).isEmpty()
        // ...and the latest version's name must still find it.
        assertThat(names(search("$prefix New name"))).containsExactly("New name")
    }

    // A key is restricted to alphanumerics and dashes, so these characters can only reach the query through a name — where they have to stay literal.
    @Test
    fun `treats LIKE wildcards in the search term as literal characters`() {
        store("discount", "1.0.0", "100% discount")
        store("plain", "1.0.0", "100 percent")
        store("underscore", "1.0.0", "Under_score")
        store("underxscore", "1.0.0", "UnderXscore")

        // '%' would otherwise match anything following "100"
        assertThat(names(search("$prefix 100%"))).containsExactly("100% discount")
        // '_' would otherwise match any single character, pulling in "UnderXscore"
        assertThat(names(search("$prefix Under_s"))).containsExactly("Under_score")
    }

    @Test
    fun `treats a backslash in the search term as a literal character`() {
        store("backslash", "1.0.0", "back\\slash")

        assertThat(names(search("$prefix back\\s"))).containsExactly("back\\slash")
        assertThat(search("$prefix back\\\\s").content).isEmpty()
    }

    @Test
    fun `reports the requested sort, not the entity path it maps to`() {
        store("a", "1.0.0", "Alpha")

        val page = search(pageable = PageRequest.of(0, 50, Sort.by(Sort.Direction.ASC, "key")))

        // 'id.key' is internal - the endpoint refuses it as input, so it must not come back either.
        assertThat(page.pageable.sort.map { it.property }).containsExactly("key")
    }

    @Test
    fun `reports the default sort when none was requested`() {
        store("a", "1.0.0", "Alpha")

        val page = search(pageable = PageRequest.of(0, 50))

        assertThat(page.pageable.sort.map { it.property }).containsExactly("name")
    }

    @Test
    fun `pages the filtered result`() {
        (1..5).forEach { store("block-$it", "1.0.0", "Block $it") }

        val secondPage = search(pageable = PageRequest.of(1, 2))

        assertThat(names(secondPage)).containsExactly("Block 3", "Block 4")
        assertThat(secondPage.totalElements).isEqualTo(5)
        assertThat(secondPage.totalPages).isEqualTo(3)
    }

    @Test
    fun `returns an empty page past the last page`() {
        store("a", "1.0.0", "Alpha")

        val page = search(pageable = PageRequest.of(4, 10))

        assertThat(page.content).isEmpty()
        assertThat(page.totalElements).isEqualTo(1)
    }

    @Test
    fun `returns an empty page when nothing matches`() {
        store("a", "1.0.0", "Alpha")

        val page = search("$prefix zzzz")

        assertThat(page.content).isEmpty()
        assertThat(page.totalElements).isZero()
    }
}
