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

package com.ritense.case_.caseconfiguration.importer

import com.ritense.case_.caseconfiguration.service.CaseConfigurationService
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_DEFINITION
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class CaseConfigurationImporterTest {

    private val service: CaseConfigurationService = mock()
    private val importer = CaseConfigurationImporter(MapperSingleton.get(), service)
    private val caseDefinitionId = CaseDefinitionId.of("mail-case", "1.0.0")

    @Test
    fun `should be of type 'caseconfiguration' and depend on 'casedefinition'`() {
        assertThat(importer.type()).isEqualTo("caseconfiguration")
        assertThat(importer.dependsOn()).isEqualTo(setOf(CASE_DEFINITION))
    }

    @Test
    fun `should support case configuration files only`() {
        assertThat(importer.supports("/case/configuration/mail-case.case-configuration.json")).isTrue()
        assertThat(importer.supports("/case/configuration/x/mail-case.case-configuration.json")).isFalse()
        assertThat(importer.supports("/case/tag/mail-case.case-tag.json")).isFalse()
    }

    @Test
    fun `should create new keys and update existing keys`() {
        whenever(service.exists(caseDefinitionId, "mailProvider")).thenReturn(true)
        val content = """
            [
                {"key": "notificationEmail", "defaultValue": "test@example.com"},
                {"key": "mailProvider", "defaultValue": "smtp"}
            ]
        """.trimIndent()

        importer.import(ImportRequest(FILENAME, content.toByteArray(), caseDefinitionId))

        verify(service).createDeclaration(caseDefinitionId, "notificationEmail", "test@example.com")
        verify(service).updateDeclaration(caseDefinitionId, "mailProvider", "smtp")
    }

    private companion object {
        const val FILENAME = "/case/configuration/mail-case.case-configuration.json"
    }
}
