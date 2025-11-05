package com.ritense.buildingblock.service

import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_DEFINITION
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension

@ExtendWith(MockitoExtension::class)
class BuildingBlockJsonSchemaDocumentDefinitionImporterTest(
    @Mock private val service: BuildingBlockDocumentDefinitionService
) {
    private lateinit var importer: BuildingBlockJsonSchemaDocumentDefinitionImporter

    @BeforeEach
    fun before() {
        importer = BuildingBlockJsonSchemaDocumentDefinitionImporter(service)
    }

    @Test
    fun `should be of type 'form-definition'`() {
        assertThat(importer.type()).isEqualTo("buildingblockdocumentdefinition")
    }

    @Test
    fun `should not building block definition`() {
        assertThat(importer.dependsOn()).isEqualTo(setOf(BUILDING_BLOCK_DEFINITION))
    }

    @Test
    fun `should support document definition fileName`() {
        assertThat(importer.supports(FILENAME)).isTrue()
    }

    @Test
    fun `should not support invalid document definition fileName`() {
        assertThat(importer.supports("/document/definition/not/my-definition.json")).isFalse()
        assertThat(importer.supports("/document/definition/my-definition-json")).isFalse()
    }

    private companion object {
        const val FILENAME = "/document/definition/my-definition.document-definition.json"
    }
}