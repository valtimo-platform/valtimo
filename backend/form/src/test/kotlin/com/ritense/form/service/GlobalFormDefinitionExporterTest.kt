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

import com.ritense.exporter.request.GlobalFormDefinitionExportRequest
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class GlobalFormDefinitionExporterTest {

    @Mock
    lateinit var formDefinitionService: FormDefinitionService

    private lateinit var exporter: GlobalFormDefinitionExporter

    @BeforeEach
    fun before() {
        exporter = GlobalFormDefinitionExporter(MapperSingleton.get(), formDefinitionService)
    }

    @Test
    fun `should export the form into the global folder structure`() {
        val formDefinition = FormIoFormDefinition(
            UUID.randomUUID(),
            "my-form",
            """{"components":[]}""",
            null,
            false
        )
        whenever(formDefinitionService.getFormDefinitionByName("my-form"))
            .thenReturn(Optional.of(formDefinition))

        val result = exporter.export(GlobalFormDefinitionExportRequest("my-form"))

        val exportFile = result.exportFiles.single()
        assertThat(exportFile.path).isEqualTo("config/global/form/my-form.form.json")
        assertThat(exportFile.content.toString(Charsets.UTF_8)).contains("components")
    }

    @Test
    fun `should fail with the form name when the referenced form cannot be found`() {
        whenever(formDefinitionService.getFormDefinitionByName("my-form")).thenReturn(Optional.empty())

        assertThatThrownBy { exporter.export(GlobalFormDefinitionExportRequest("my-form")) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("my-form")
    }

    @Test
    fun `should support the global form definition export request`() {
        assertThat(exporter.supports()).isEqualTo(GlobalFormDefinitionExportRequest::class.java)
    }
}
