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

import com.ritense.document.domain.impl.JsonDocumentContent
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.DocumentSequenceGeneratorService
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.junit.jupiter.MockitoSettings
import org.mockito.kotlin.any
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.mockito.quality.Strictness
import org.springframework.data.jpa.domain.Specification
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MigrationPlanApplierTest(
    @Mock private val documentRepository: JsonSchemaDocumentRepository,
    @Mock private val documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
    @Mock private val firstExecutor: MigrationComponentExecutor,
    @Mock private val secondExecutor: MigrationComponentExecutor,
) {

    private lateinit var applier: MigrationPlanApplier

    private val source = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.3")
    private val target = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.4")
    private val planId = BlueprintMigrationId.from(target, "fotodossier")

    @BeforeEach
    fun setUp() {
        applier = MigrationPlanApplier(
            documentRepository,
            documentDefinitionRepository,
            listOf(firstExecutor, secondExecutor),
        )
        // By default the target carries a document definition under the same name — the ordinary same-key version bump.
        whenever(documentDefinitionRepository.findOne(any<Specification<JsonSchemaDocumentDefinition>>()))
            .thenReturn(Optional.of(definition(NAME, target)))
    }

    @Test
    fun `should re-home the document onto the target blueprint version and report where it came from`() {
        val document = document()
        whenever(documentRepository.findById(any())).thenReturn(Optional.of(document))

        val from = applier.rehome(document.id().id, target)

        assertThat(from).isEqualTo(source)
        assertThat(document.definitionId())
            .isEqualTo(JsonSchemaDocumentDefinitionId.forBuildingBlock(NAME, target))
        verify(documentRepository).save(document)
    }

    @Test
    fun `should take the document definition name from the target, so it can re-home across keys`() {
        val document = document()
        whenever(documentRepository.findById(any())).thenReturn(Optional.of(document))
        val otherBlock = BuildingBlockDefinitionId("inspectie-dossier", "1.0.0")
        whenever(documentDefinitionRepository.findOne(any<Specification<JsonSchemaDocumentDefinition>>()))
            .thenReturn(Optional.of(definition(OTHER_NAME, otherBlock)))

        val from = applier.rehome(document.id().id, otherBlock)

        assertThat(from).isEqualTo(source)
        // Not the source's name: the target building block's document definition is a different one.
        assertThat(document.definitionId())
            .isEqualTo(JsonSchemaDocumentDefinitionId.forBuildingBlock(OTHER_NAME, otherBlock))
    }

    @Test
    fun `should re-home before running the plan's components, so they see the target version`() {
        val document = document()
        whenever(documentRepository.findById(any())).thenReturn(Optional.of(document))

        applier.apply(planId, target, document.id().id)

        inOrder(documentRepository, firstExecutor, secondExecutor) {
            verify(documentRepository).save(document)
            verify(firstExecutor).execute(planId, target, document.id().id)
            verify(secondExecutor).execute(planId, target, document.id().id)
        }
    }

    @Test
    fun `should fail when there is no document to migrate`() {
        whenever(documentRepository.findById(any())).thenReturn(Optional.empty())

        assertThatThrownBy { applier.apply(planId, target, UUID.randomUUID()) }
            .isInstanceOf(NoSuchElementException::class.java)
            .hasMessageContaining("No document found")
    }

    @Test
    fun `should fail when the target blueprint has no document definition to re-home onto`() {
        val document = document()
        whenever(documentRepository.findById(any())).thenReturn(Optional.of(document))
        whenever(documentDefinitionRepository.findOne(any<Specification<JsonSchemaDocumentDefinition>>()))
            .thenReturn(Optional.empty())

        assertThatThrownBy { applier.apply(planId, target, document.id().id) }
            .isInstanceOf(NoSuchElementException::class.java)
            .hasMessageContaining("No document definition is deployed for blueprint")
    }

    private fun document(): JsonSchemaDocument {
        val sequenceGenerator = mock<DocumentSequenceGeneratorService>()
        whenever(sequenceGenerator.next(any())).thenReturn(1L)
        return JsonSchemaDocument
            .create(
                definition(NAME, source),
                JsonDocumentContent("""{"adres": "Dorpsstraat 1"}"""),
                "test@test.com",
                sequenceGenerator,
                null,
            )
            .resultingDocument()
            .orElseThrow()
    }

    private fun definition(name: String, blueprintId: BuildingBlockDefinitionId) =
        JsonSchemaDocumentDefinition(
            JsonSchemaDocumentDefinitionId.forBuildingBlock(name, blueprintId),
            JsonSchema.fromString(
                """
                {
                    "${'$'}schema": "http://json-schema.org/draft-07/schema#",
                    "${'$'}id": "$name.schema",
                    "type": "object",
                    "properties": {
                        "adres": { "type": "string" },
                        "inspecteur": { "type": "string" }
                    },
                    "required": []
                }
                """.trimIndent()
            ),
        )

    private companion object {
        const val NAME = "verhuizing-inspectie"
        const val OTHER_NAME = "inspectie-dossier"
    }
}
