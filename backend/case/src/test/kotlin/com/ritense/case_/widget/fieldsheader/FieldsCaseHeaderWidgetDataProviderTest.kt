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

package com.ritense.case_.widget.fieldsheader

import com.ritense.case_.domain.header.CaseHeaderWidget
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.data.domain.Pageable
import java.util.UUID

class FieldsCaseHeaderWidgetDataProviderTest {

    private val valueResolverService: ValueResolverService = mock()
    private val provider = FieldsCaseHeaderWidgetDataProvider(valueResolverService, MapperSingleton.get())
    private val caseDefinitionId = CaseDefinitionId("test-case", "1.0.0")

    private val document = mapOf(
        "doc:/voornaam" to "Jan",
        "doc:/tussenvoegsel" to null,
        "doc:/achternaam" to "Jansen",
        "doc:/zaaknummer" to "Z-1",
    )

    @Test
    fun `should combine template placeholders into one header value`() {
        whenever(valueResolverService.resolveValues(any<Map<String, Any>>(), any<Collection<String>>()))
            .thenAnswer { invocation ->
                invocation.getArgument<Collection<String>>(1).associateWith { document[it] }
            }
        val widget = CaseHeaderWidget(
            id = caseDefinitionId,
            properties = mapOf(
                "columns" to listOf(
                    listOf(
                        mapOf(
                            "key" to "naam",
                            "title" to "Naam",
                            "value" to "\${doc:/voornaam} \${doc:/tussenvoegsel} \${doc:/achternaam}"
                        ),
                        mapOf("key" to "leeg", "title" to "Leeg", "value" to "\${doc:/tussenvoegsel}"),
                        mapOf("key" to "zaaknummer", "title" to "Zaaknummer", "value" to "doc:/zaaknummer"),
                    )
                )
            )
        )

        @Suppress("UNCHECKED_CAST")
        val data = provider.getData(UUID.randomUUID(), widget, Pageable.unpaged(), caseDefinitionId) as Map<String, Any?>

        assertThat(data["naam"]).isEqualTo("Jan Jansen")
        assertThat(data).containsEntry("leeg", null)
        assertThat(data["zaaknummer"]).isEqualTo("Z-1")
    }
}
