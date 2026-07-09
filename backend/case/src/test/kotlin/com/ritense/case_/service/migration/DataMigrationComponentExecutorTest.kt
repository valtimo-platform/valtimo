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
import com.ritense.case_.domain.migration.DataMigrationConfiguration
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.case_.repository.DataMigrationConfigurationRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
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
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class DataMigrationComponentExecutorTest(
    @Mock private val dataMigrationConfigurationRepository: DataMigrationConfigurationRepository,
    @Mock private val valueResolverService: ValueResolverService,
) {

    private val objectMapper = jacksonObjectMapper()
    private lateinit var executor: DataMigrationComponentExecutor

    private val migrationId = BlueprintMigrationId.from(CaseDefinitionId("bezwaar", "1.0.1"), "plan")
    private val caseId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        executor = DataMigrationComponentExecutor(objectMapper, dataMigrationConfigurationRepository, valueResolverService)
    }

    @Test
    fun `should handle the dataMigration component`() {
        assertThat(executor.componentKey()).isEqualTo("dataMigration")
    }

    @Test
    fun `should copy resolved source to target and coerce to targetType`() {
        stubPatches(DataMigrationPatch(source = "doc:/emailadres", target = "doc:/e-mailadres"))
        whenever(valueResolverService.resolveValues(eq(caseId.toString()), any()))
            .thenReturn(mapOf("doc:/emailadres" to "info@example.com"))

        executor.execute(migrationId, migrationId.blueprintId(), caseId)

        assertThat(handledValues()).containsEntry("doc:/e-mailadres", "info@example.com")
    }

    @Test
    fun `should coerce copied value to the target type`() {
        stubPatches(DataMigrationPatch(source = "doc:/leeftijd", target = "doc:/age", targetType = "integer"))
        whenever(valueResolverService.resolveValues(eq(caseId.toString()), any()))
            .thenReturn(mapOf("doc:/leeftijd" to "31"))

        executor.execute(migrationId, migrationId.blueprintId(), caseId)

        assertThat(handledValues()["doc:/age"]).isEqualTo(31L)
    }

    @Test
    fun `should coerce a set literal to the target type`() {
        stubPatches(DataMigrationPatch(value = 31, target = "doc:/communicatie", targetType = "string"))

        executor.execute(migrationId, migrationId.blueprintId(), caseId)

        assertThat(handledValues()["doc:/communicatie"]).isEqualTo("31")
    }

    @Test
    fun `should write the value as-is when targetType is absent`() {
        stubPatches(
            DataMigrationPatch(value = "true", target = "doc:/flag"),
            DataMigrationPatch(value = 42, target = "doc:/count"),
            DataMigrationPatch(value = "Henk", target = "doc:/naam"),
        )

        executor.execute(migrationId, migrationId.blueprintId(), caseId)

        val handled = handledValues()
        assertThat(handled["doc:/flag"]).isEqualTo("true")
        assertThat(handled["doc:/count"]).isEqualTo(42)
        assertThat(handled["doc:/naam"]).isEqualTo("Henk")
    }

    @Test
    fun `should skip copy patches whose source did not resolve`() {
        stubPatches(DataMigrationPatch(source = "doc:/missing", target = "doc:/target"))
        whenever(valueResolverService.resolveValues(eq(caseId.toString()), any())).thenReturn(emptyMap())

        executor.execute(migrationId, migrationId.blueprintId(), caseId)

        verify(valueResolverService, never()).handleValues(any<UUID>(), any())
    }

    private fun stubPatches(vararg patches: DataMigrationPatch) {
        whenever(dataMigrationConfigurationRepository.findById(migrationId))
            .thenReturn(Optional.of(DataMigrationConfiguration(migrationId, patches.toList())))
    }

    private fun handledValues(): Map<String, Any?> {
        val captor = argumentCaptor<Map<String, Any?>>()
        verify(valueResolverService).handleValues(eq(caseId), captor.capture())
        return captor.firstValue
    }
}
