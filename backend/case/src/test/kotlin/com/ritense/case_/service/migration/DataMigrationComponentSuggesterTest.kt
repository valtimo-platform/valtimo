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

package com.ritense.case_.service.migration

import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valueresolver.ValueResolverOption
import com.ritense.valueresolver.ValueResolverOptionRequest
import com.ritense.valueresolver.ValueResolverOptionType.FIELD
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class DataMigrationComponentSuggesterTest {

    private lateinit var valueResolverService: ValueResolverService
    private lateinit var suggester: DataMigrationComponentSuggester

    private val source = CaseDefinitionId("verhuizing", "1.0.0")
    private val target = CaseDefinitionId("verhuizing", "1.0.1")

    @BeforeEach
    fun setUp() {
        valueResolverService = mock()
        suggester = DataMigrationComponentSuggester(valueResolverService)
    }

    @Test
    fun `should report the plan component key it fills`() {
        assertThat(suggester.componentKey()).isEqualTo("dataMigration")
    }

    @Test
    fun `should suggest nothing when both versions expose the same paths`() {
        paths(source, "doc:/adres", "doc:/adres/straat")
        paths(target, "doc:/adres", "doc:/adres/straat")

        assertThat(suggester.suggest(source, target)).isNull()
    }

    @Test
    fun `should clear a dropped object once instead of once per node beneath it`() {
        // The object container is a resolvable path of its own, so the walk yields it alongside every
        // descendant. Clearing the object removes the subtree; the descendants have nothing left to say.
        paths(source, "doc:/adres", "doc:/adres/straat", "doc:/adres/plaats", "doc:/naam")
        paths(target, "doc:/naam")

        assertThat(suggest()).containsExactly(DataMigrationPatch(value = null, target = "doc:/adres"))
    }

    @Test
    fun `should clear the shallowest dropped object of a nested subtree`() {
        paths(source, "doc:/aanvrager", "doc:/aanvrager/adres", "doc:/aanvrager/adres/straat", "doc:/naam")
        paths(target, "doc:/naam")

        assertThat(suggest()).containsExactly(DataMigrationPatch(value = null, target = "doc:/aanvrager"))
    }

    @Test
    fun `should still clear a dropped leaf of an object the target version keeps`() {
        // The object survives, so nulling it would take the fields the target still models with it.
        paths(source, "doc:/adres", "doc:/adres/straat", "doc:/adres/postcode")
        paths(target, "doc:/adres", "doc:/adres/straat")

        assertThat(suggest()).containsExactly(DataMigrationPatch(value = null, target = "doc:/adres/postcode"))
    }

    @Test
    fun `should not clear a path that was matched as the source of a copy`() {
        paths(source, "doc:/straatnaam")
        paths(target, "doc:/straat_naam")

        assertThat(suggest())
            .containsExactly(DataMigrationPatch(source = "doc:/straatnaam", target = "doc:/straat_naam"))
    }

    @Test
    fun `should surface a new target field with no source, and clear the object it replaces`() {
        paths(source, "doc:/adres", "doc:/adres/straat")
        paths(target, "doc:/woonplaats")

        assertThat(suggest()).containsExactly(
            DataMigrationPatch(value = null, target = "doc:/adres"),
            DataMigrationPatch(source = null, target = "doc:/woonplaats"),
        )
    }

    @Test
    fun `should order every patch by target path, whatever order the schema walk yields`() {
        // Copies and clears interleaved, and neither side enumerated alphabetically.
        paths(source, "doc:/zaak", "doc:/naam", "doc:/adres", "doc:/straatnaam")
        paths(target, "doc:/zaak", "doc:/bsn", "doc:/straat_naam")

        assertThat(suggest().map { it.target })
            .containsExactly("doc:/adres", "doc:/bsn", "doc:/naam", "doc:/straat_naam")
    }

    @Suppress("UNCHECKED_CAST")
    private fun suggest() = suggester.suggest(source, target) as List<DataMigrationPatch>

    private fun paths(blueprintId: BlueprintId, vararg paths: String) {
        whenever(valueResolverService.getResolvableKeys(any<ValueResolverOptionRequest>(), eq(blueprintId)))
            .thenReturn(paths.map { ValueResolverOption(it, FIELD) })
    }
}
