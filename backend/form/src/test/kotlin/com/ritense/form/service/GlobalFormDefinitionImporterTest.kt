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

package com.ritense.form.service

import com.ritense.form.autodeployment.FormDefinitionDeploymentService
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.GLOBAL_FORM
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.verify

@ExtendWith(MockitoExtension::class)
class GlobalFormDefinitionImporterTest(
    @Mock private val formDefinitionDeploymentService: FormDefinitionDeploymentService
) {
    private lateinit var importer: GlobalFormDefinitionImporter

    @BeforeEach
    fun before() {
        importer = GlobalFormDefinitionImporter(formDefinitionDeploymentService)
    }

    @Test
    fun `should be of type 'form'`() {
        assertThat(importer.type()).isEqualTo(GLOBAL_FORM)
    }

    @Test
    fun `should not depend on any other type`() {
        assertThat(importer.dependsOn()).isEmpty()
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
    fun `should support global form fileName`() {
        assertThat(importer.supports("/global/form/my-form.form.json")).isTrue()
    }

    @Test
    fun `should support nested global form fileName`() {
        assertThat(importer.supports("/global/form/subfolder/my-form.form.json")).isTrue()
    }

    @Test
    fun `should not support non-global form fileName`() {
        assertThat(importer.supports("/form/my-form.form.json")).isFalse()
        assertThat(importer.supports("/other/test.form.json")).isFalse()
        assertThat(importer.supports("/global/form/test.json")).isFalse()
        assertThat(importer.supports("test.form.json")).isFalse()
    }

    @Test
    fun `should call deployGlobalForm on import`() {
        val formContent = """{"display": "form", "components": []}"""
        val request = ImportRequest(
            fileName = "/global/form/my-form.form.json",
            content = formContent.toByteArray()
        )

        importer.import(request)

        verify(formDefinitionDeploymentService).deployGlobalForm("my-form", formContent, false)
    }

    @Test
    fun `should extract form name from nested path`() {
        val formContent = """{"display": "form", "components": []}"""
        val request = ImportRequest(
            fileName = "/global/form/subfolder/nested-form.form.json",
            content = formContent.toByteArray()
        )

        importer.import(request)

        verify(formDefinitionDeploymentService).deployGlobalForm("nested-form", formContent, false)
    }
}
