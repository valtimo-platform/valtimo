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

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class MigrationDataPatchApplierTest(
    @Mock private val valueResolverService: ValueResolverService,
) {

    private val objectMapper = jacksonObjectMapper()
    private lateinit var applier: MigrationDataPatchApplier
    private val sourceDocumentId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        applier = MigrationDataPatchApplier(objectMapper, valueResolverService)
    }

    @Test
    fun `resolveToContent delegates doc patches to preProcessValuesForNewDocument with the target definition`() {
        val content = objectMapper.createObjectNode().put("applicantName", "Ada")
        whenever(valueResolverService.resolveValues(eq(sourceDocumentId.toString()), any()))
            .thenReturn(mapOf("doc:/naam" to "Ada"))
        whenever(valueResolverService.preProcessValuesForNewDocument(any(), eq("income-check")))
            .thenReturn(mapOf("doc:" to content))

        val result = applier.resolveToContent(
            listOf(DataMigrationPatch(source = "doc:/naam", target = "doc:/applicantName")),
            sourceDocumentId,
            "income-check",
        )

        assertThat(result).isEqualTo(content)
        val captor = argumentCaptor<Map<String, Any?>>()
        verify(valueResolverService).preProcessValuesForNewDocument(captor.capture(), eq("income-check"))
        assertThat(captor.firstValue).containsEntry("doc:/applicantName", "Ada")
    }

    @Test
    fun `resolveToContent skips a copy with a null source but keeps an explicit null literal`() {
        whenever(valueResolverService.resolveValues(eq(sourceDocumentId.toString()), any()))
            .thenReturn(mapOf("doc:/absent" to null))
        whenever(valueResolverService.preProcessValuesForNewDocument(any(), eq("income-check")))
            .thenReturn(mapOf("doc:" to objectMapper.createObjectNode()))

        applier.resolveToContent(
            listOf(
                DataMigrationPatch(source = "doc:/absent", target = "doc:/copied"),
                DataMigrationPatch(value = null, target = "doc:/cleared"),
            ),
            sourceDocumentId,
            "income-check",
        )

        val captor = argumentCaptor<Map<String, Any?>>()
        verify(valueResolverService).preProcessValuesForNewDocument(captor.capture(), eq("income-check"))
        val passed = captor.firstValue
        assertThat(passed).doesNotContainKey("doc:/copied") // copy of an absent/null source is skipped
        assertThat(passed).containsKey("doc:/cleared") // explicit null literal is passed to the schema-aware resolver
        assertThat(passed["doc:/cleared"]).isNull()
    }

    @Test
    fun `resolveToContent ignores non-doc targets and does not call the resolver`() {
        val result = applier.resolveToContent(
            listOf(DataMigrationPatch(value = "x", target = "pv:foo")),
            sourceDocumentId,
            "income-check",
        )

        assertThat(result.size()).isZero()
        verify(valueResolverService, never()).preProcessValuesForNewDocument(any(), any())
    }
}
