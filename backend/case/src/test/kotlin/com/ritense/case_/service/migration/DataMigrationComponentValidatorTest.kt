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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valueresolver.ValueResolverFactory
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock

/** A `dataMigration` target is only checked at run otherwise, where an unresolvable prefix fails every case with a message about resolver factories. The same rules apply to the copies nested in a building-block entry, through [DataMigrationPatchChecker]. */
class DataMigrationComponentValidatorTest {

    private val objectMapper = ObjectMapper()
    private val validator = DataMigrationComponentValidator(
        listOf<ValueResolverFactory>(
            mock { on { supportedPrefix() } doReturn "doc" },
            mock { on { supportedPrefix() } doReturn "pv" },
        )
    )

    private val source = CaseDefinitionId("verhuizing", "1.0.0")
    private val target = CaseDefinitionId("verhuizing", "1.0.1")

    @Test
    fun `should accept a target every resolver knows`() {
        assertThat(validate("""[{"target": "doc:/x", "source": "doc:/y"}, {"target": "pv:done", "value": true}]"""))
            .isEmpty()
    }

    @Test
    fun `should refuse a target no value resolver handles`() {
        assertThat(validate("""[{"target": "zzz:/nope", "value": "x"}]"""))
            .singleElement().asString()
            .contains("'zzz:'")
            .contains("'doc:'")
    }

    @Test
    fun `should refuse a target with no prefix at all`() {
        assertThat(validate("""[{"target": "plainName", "value": "x"}]"""))
            .singleElement().asString()
            .contains("no value-resolver prefix")
    }

    /** The executor prefers `source` and drops `value` without a word, so which one was meant has to be decided here. */
    @Test
    fun `should refuse a patch setting both source and value`() {
        assertThat(validate("""[{"target": "doc:/x", "source": "doc:/y", "value": "lit"}]"""))
            .singleElement().asString()
            .contains("both 'source' and 'value'")
    }

    @Test
    fun `should refuse a patch naming no target`() {
        assertThat(validate("""[{"value": "x"}]"""))
            .singleElement().asString()
            .contains("names no 'target'")
    }

    /** The nested copies go through the same checker, so an entry's patches cannot be judged by a laxer rule. */
    @Test
    fun `the shared checker answers the same for a nested entry's patches`() {
        val nested = objectMapper.readTree("""[{"target": "zzz:/nope", "value": "x"}]""")

        assertThat(DataMigrationPatchChecker.findProblems(nested, listOf("doc", "pv")))
            .singleElement().asString().contains("'zzz:'")
    }

    private fun validate(json: String) = validator.validate(source, target, objectMapper.readTree(json))
}
