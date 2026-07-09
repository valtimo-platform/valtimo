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

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.case_.domain.migration.CaseDefinitionMigration
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_DEFINITION_MIGRATION
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class MigrationPlanImporterTest(
    @Mock private val caseDefinitionMigrationRepository: CaseDefinitionMigrationRepository,
    @Mock private val dataMigrationComponentDeployer: MigrationComponentDeployer,
) {

    private val objectMapper = jacksonObjectMapper()
    private lateinit var importer: MigrationPlanImporter

    private val caseDefinitionId = CaseDefinitionId("bezwaar", "1.0.1")

    @BeforeEach
    fun setUp() {
        importer = MigrationPlanImporter(
            objectMapper,
            caseDefinitionMigrationRepository,
            listOf(dataMigrationComponentDeployer),
        )
    }

    @Test
    fun `should have correct type`() {
        assertThat(importer.type()).isEqualTo(CASE_DEFINITION_MIGRATION)
    }

    @Test
    fun `should not declare dependencies so it works for both case and building block`() {
        assertThat(importer.dependsOn()).isEmpty()
    }

    @Test
    fun `should be part of case definition`() {
        assertThat(importer.partOfCaseDefinition()).isTrue()
    }

    @Test
    fun `should be part of building block definition`() {
        assertThat(importer.partOfBuildingBlockDefinition()).isTrue()
    }

    @Test
    fun `should support valid filename`() {
        assertThat(importer.supports("/case-migration/bezwaar.case-migration.json")).isTrue()
    }

    @Test
    fun `should not support invalid filename`() {
        assertThat(importer.supports("/case-migration/bezwaar.json")).isFalse()
        assertThat(importer.supports("/other/bezwaar.case-migration.json")).isFalse()
    }

    @Test
    fun `should save skeleton and dispatch component to matching deployer`() {
        whenever(dataMigrationComponentDeployer.componentKey()).thenReturn("dataMigration")

        val json = """
            {
                "title": "Migrate cases with status 'aanvraag-ontvangen'",
                "key": "migration-plan-aanvraag-indienen",
                "migrationTriggers": { "triggeredByButton": true },
                "conditions": [
                    { "path": "case:internalStatus", "operator": "==", "value": "aanvraag-verwerkt" }
                ],
                "dataMigration": [
                    { "source": "doc:/persoon/voornaam", "target": "doc:/contact/voornaam" }
                ],
                "processMigration": [
                    { "sourceProcessDefinitionKey": "bezwaar", "targetProcessDefinitionKey": "bezwaar" }
                ]
            }
        """.trimIndent()

        importer.import(
            ImportRequest(
                fileName = "/case-migration/bezwaar.case-migration.json",
                content = json.toByteArray(),
                caseDefinitionId = caseDefinitionId,
            )
        )

        val expectedId = BlueprintMigrationId.from(caseDefinitionId, "migration-plan-aanvraag-indienen")

        // idempotent re-deploy: components are cleaned before saving
        verify(dataMigrationComponentDeployer).undeploy(expectedId)

        val skeletonCaptor = argumentCaptor<CaseDefinitionMigration>()
        verify(caseDefinitionMigrationRepository).save(skeletonCaptor.capture())
        val saved = skeletonCaptor.firstValue
        assertThat(saved.id).isEqualTo(expectedId)
        assertThat(saved.title).isEqualTo("Migrate cases with status 'aanvraag-ontvangen'")
        assertThat(saved.migrationTriggers.triggeredByButton).isTrue()
        assertThat(saved.conditions).singleElement()
        assertThat(saved.conditions.single().path).isEqualTo("case:internalStatus")

        // only the matching section is dispatched
        val componentCaptor = argumentCaptor<JsonNode>()
        verify(dataMigrationComponentDeployer).deploy(eq(expectedId), componentCaptor.capture())
        val component = componentCaptor.firstValue
        assertThat(component.isArray).isTrue()
        assertThat(component[0].get("source").asText()).isEqualTo("doc:/persoon/voornaam")
    }

    @Test
    fun `should not dispatch when the matching section is absent`() {
        whenever(dataMigrationComponentDeployer.componentKey()).thenReturn("dataMigration")

        val json = """
            {
                "key": "no-data-migration",
                "processMigration": [ { "sourceProcessDefinitionKey": "bezwaar" } ]
            }
        """.trimIndent()

        importer.import(
            ImportRequest(
                fileName = "/case-migration/bezwaar.case-migration.json",
                content = json.toByteArray(),
                caseDefinitionId = caseDefinitionId,
            )
        )

        verify(caseDefinitionMigrationRepository).save(any())
        verify(dataMigrationComponentDeployer, never()).deploy(any(), any())
    }

    @Test
    fun `should throw when case definition id is missing`() {
        assertThrows<IllegalArgumentException> {
            importer.import(
                ImportRequest(
                    fileName = "/case-migration/bezwaar.case-migration.json",
                    content = "{ \"key\": \"x\" }".toByteArray(),
                    caseDefinitionId = null,
                )
            )
        }
    }

    @Test
    fun `should throw when content is invalid json`() {
        assertThrows<IllegalArgumentException> {
            importer.import(
                ImportRequest(
                    fileName = "/case-migration/bezwaar.case-migration.json",
                    content = "not-json".toByteArray(),
                    caseDefinitionId = caseDefinitionId,
                )
            )
        }
    }
}
