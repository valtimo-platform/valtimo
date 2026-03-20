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

package com.ritense.objectmanagement.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.GLOBAL_FORM
import com.ritense.importer.ValtimoImportTypes.Companion.OBJECT_MANAGEMENT
import com.ritense.objectmanagement.domain.ObjectManagement
import com.ritense.objectmanagement.repository.ObjectManagementRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.core.env.Environment

@ExtendWith(MockitoExtension::class)
class ObjectManagementImporterTest(
    @Mock private val objectManagementService: ObjectManagementService,
    @Mock private val objectManagementRepository: ObjectManagementRepository,
    @Mock private val environment: Environment
) {
    private lateinit var importer: ObjectManagementImporter
    private val objectMapper: ObjectMapper = jacksonObjectMapper()

    @BeforeEach
    fun before() {
        importer = ObjectManagementImporter(
            objectManagementService,
            objectManagementRepository,
            objectMapper,
            environment
        )
    }

    @Test
    fun `should be of type 'objectmanagement'`() {
        assertThat(importer.type()).isEqualTo(OBJECT_MANAGEMENT)
    }

    @Test
    fun `should depend on form`() {
        assertThat(importer.dependsOn()).containsExactly(GLOBAL_FORM)
    }

    @Test
    fun `should not be part of case definition`() {
        assertThat(importer.partOfCaseDefinition()).isFalse()
    }

    @Test
    fun `should not be part of building block definition`() {
        assertThat(importer.partOfBuildingBlockDefinition()).isFalse()
    }

    @Test
    fun `should support objectmanagement fileName`() {
        assertThat(importer.supports("/global/object-management/my-objects.object-management.json")).isTrue()
    }

    @Test
    fun `should not support non-objectmanagement fileName`() {
        assertThat(importer.supports("/object-management/my-objects.object-management.json")).isFalse()
        assertThat(importer.supports("/global/object-management/my-objects.json")).isFalse()
        assertThat(importer.supports("/form/test.form.json")).isFalse()
        assertThat(importer.supports("test.object-management.json")).isFalse()
    }

    @Test
    fun `should create new object management when it does not exist`() {
        val content = """
            {
                "id": "d8257077-ec44-44d3-9d2e-e8c87fa6fd09",
                "title": "Bomen",
                "objecttypenApiPluginConfigurationId": "4021bb75-18c8-4ca5-8658-b9f9c728bba0",
                "objecttypeId": "feeaa795-d212-4fa2-bb38-2e5fcc9629b4",
                "objecttypeVersion": 2,
                "objectenApiPluginConfigurationId": "b6d83348-97e7-4660-bd35-2e5fcc9629b4",
                "showInDataMenu": true,
                "formDefinitionView": "boom.summary",
                "formDefinitionEdit": "boom.editform"
            }
        """.trimIndent()

        whenever(objectManagementRepository.findByObjecttypeId("feeaa795-d212-4fa2-bb38-2e5fcc9629b4")).thenReturn(null)
        whenever(objectManagementRepository.findByTitle("Bomen")).thenReturn(null)
        whenever(objectManagementService.create(any())).thenAnswer { it.arguments[0] }

        val request = ImportRequest(
            fileName = "/global/object-management/bomen.object-management.json",
            content = content.toByteArray()
        )

        importer.import(request)

        val captor = argumentCaptor<ObjectManagement>()
        verify(objectManagementService).create(captor.capture())
        assertThat(captor.firstValue.title).isEqualTo("Bomen")
        assertThat(captor.firstValue.objecttypeId).isEqualTo("feeaa795-d212-4fa2-bb38-2e5fcc9629b4")
        assertThat(captor.firstValue.formDefinitionView).isEqualTo("boom.summary")
        assertThat(captor.firstValue.formDefinitionEdit).isEqualTo("boom.editform")
    }

    @Test
    fun `should update existing object management when objecttype id matches`() {
        val content = """
            {
                "id": "d8257077-ec44-44d3-9d2e-e8c87fa6fd09",
                "title": "Bomen",
                "objecttypenApiPluginConfigurationId": "4021bb75-18c8-4ca5-8658-b9f9c728bba0",
                "objecttypeId": "feeaa795-d212-4fa2-bb38-2e5fcc9629b4",
                "objecttypeVersion": 2,
                "objectenApiPluginConfigurationId": "b6d83348-97e7-4660-bd35-2e5fcc9629b4",
                "showInDataMenu": true
            }
        """.trimIndent()

        val existing = ObjectManagement(
            title = "Bomen",
            objecttypeId = "feeaa795-d212-4fa2-bb38-2e5fcc9629b4",
            objecttypenApiPluginConfigurationId = java.util.UUID.randomUUID(),
            objectenApiPluginConfigurationId = java.util.UUID.randomUUID()
        )
        whenever(objectManagementRepository.findByObjecttypeId("feeaa795-d212-4fa2-bb38-2e5fcc9629b4")).thenReturn(existing)
        whenever(objectManagementService.update(any())).thenAnswer { it.arguments[0] }

        val request = ImportRequest(
            fileName = "/global/object-management/bomen.object-management.json",
            content = content.toByteArray()
        )

        importer.import(request)

        verify(objectManagementService).update(any())
    }
}
