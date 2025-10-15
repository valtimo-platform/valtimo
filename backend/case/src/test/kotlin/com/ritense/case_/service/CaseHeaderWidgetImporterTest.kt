/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.case_.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case_.repository.CaseHeaderWidgetRepository
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import jakarta.validation.Validator
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension

@ExtendWith(MockitoExtension::class)
class CaseHeaderWidgetImporterTest(
    @Mock private val objectMapper: ObjectMapper,
    @Mock private val validator: Validator,
    @Mock private val caseHeaderWidgetRepository: CaseHeaderWidgetRepository,
) {
    private lateinit var importer: CaseHeaderWidgetImporter

    @BeforeEach
    fun before() {
        importer = CaseHeaderWidgetImporter(objectMapper, validator, caseHeaderWidgetRepository)
    }

    @Test
    fun `should be of type 'caseheaderwidget'`() {
        assertThat(importer.type()).isEqualTo("caseheaderwidget")
    }

    @Test
    fun `should depend on 'documentdefinition'`() {
        assertThat(importer.dependsOn()).isEqualTo(setOf(DOCUMENT_DEFINITION))
    }

    @Test
    fun `should support header-widget fileName`() {
        assertThat(importer.supports(FILENAME)).isTrue()
    }

    @Test
    fun `should not support non-header-widget fileName`() {
        assertThat(importer.supports("/case/header-widget/x/test.json")).isFalse()
        assertThat(importer.supports("/case/header-widget/test-json")).isFalse()
        assertThat(importer.supports("/case/widget-tab/my-doc-def.case-widget-tab.json")).isFalse()
    }

    private companion object {
        const val FILENAME = "/case/header-widget/my-doc-def.case-header-widget.json"
    }
}