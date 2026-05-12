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

package com.ritense.zakenapi.sync

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.importer.ImportRequest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class CaseZakenApiSyncImporterTest {

    private lateinit var caseZakenApiSyncRepository: CaseZakenApiSyncRepository
    private lateinit var importer: CaseZakenApiSyncImporter

    private val caseDefinitionId = CaseDefinitionId("test-case", "1.0.0")
    private val objectMapper = jacksonObjectMapper()

    @BeforeEach
    fun setUp() {
        caseZakenApiSyncRepository = mock()
        importer = CaseZakenApiSyncImporter(
            objectMapper,
            caseZakenApiSyncRepository,
            mock(),
            mock(),
        )
    }

    @Test
    fun `should be of type zgwzakenapisync`() {
        assertThat(importer.type()).isEqualTo("zgwzakenapisync")
    }

    @Test
    fun `should depend on documentdefinition`() {
        assertThat(importer.dependsOn()).contains("documentdefinition")
    }

    @Test
    fun `should support matching filename`() {
        assertThat(importer.supports(FILENAME)).isTrue()
    }

    @Test
    fun `should not support non-matching filename`() {
        assertThat(importer.supports("/some/other/file.json")).isFalse()
        assertThat(importer.supports("/zgw/zaakdetail-sync/test-case.zaakdetail-sync.json")).isFalse()
    }

    @Test
    fun `import should create a new sync when none exists`() {
        whenever(caseZakenApiSyncRepository.findByCaseDefinitionId(caseDefinitionId)).thenReturn(null)
        whenever(caseZakenApiSyncRepository.save(any<CaseZakenApiSync>())).thenAnswer { it.getArgument(0) }

        val jsonContent = """
            {
                "assigneeSyncEnabled": true,
                "noteSyncEnabled": true,
                "noteSubject": "Notitie aangemaakt in Valtimo GZAC"
            }
        """.trimIndent()

        importer.import(ImportRequest(FILENAME, jsonContent.toByteArray(), caseDefinitionId))

        val syncCaptor = argumentCaptor<CaseZakenApiSync>()
        verify(caseZakenApiSyncRepository).save(syncCaptor.capture())
        val saved = syncCaptor.firstValue
        assertThat(saved.caseDefinitionId).isEqualTo(caseDefinitionId)
        assertThat(saved.assigneeSyncEnabled).isTrue()
        assertThat(saved.noteSyncEnabled).isTrue()
        assertThat(saved.noteSubject).isEqualTo("Notitie aangemaakt in Valtimo GZAC")
    }

    @Test
    fun `import should update existing sync when one already exists`() {
        val existingSync = CaseZakenApiSync(
            caseDefinitionId = caseDefinitionId,
            assigneeSyncEnabled = false,
            noteSyncEnabled = false,
            noteSubject = "old subject",
        )
        whenever(caseZakenApiSyncRepository.findByCaseDefinitionId(caseDefinitionId)).thenReturn(existingSync)
        whenever(caseZakenApiSyncRepository.save(any<CaseZakenApiSync>())).thenAnswer { it.getArgument(0) }

        val jsonContent = """
            {
                "assigneeSyncEnabled": true,
                "noteSyncEnabled": true,
                "noteSubject": "new subject"
            }
        """.trimIndent()

        importer.import(ImportRequest(FILENAME, jsonContent.toByteArray(), caseDefinitionId))

        val syncCaptor = argumentCaptor<CaseZakenApiSync>()
        verify(caseZakenApiSyncRepository).save(syncCaptor.capture())
        val saved = syncCaptor.firstValue
        assertThat(saved.caseDefinitionId).isEqualTo(existingSync.caseDefinitionId)
        assertThat(saved.assigneeSyncEnabled).isTrue()
        assertThat(saved.noteSyncEnabled).isTrue()
        assertThat(saved.noteSubject).isEqualTo("new subject")
    }

    @Test
    fun `import should fall back to defaults when properties are omitted`() {
        whenever(caseZakenApiSyncRepository.findByCaseDefinitionId(caseDefinitionId)).thenReturn(null)
        whenever(caseZakenApiSyncRepository.save(any<CaseZakenApiSync>())).thenAnswer { it.getArgument(0) }

        importer.import(ImportRequest(FILENAME, "{}".toByteArray(), caseDefinitionId))

        val syncCaptor = argumentCaptor<CaseZakenApiSync>()
        verify(caseZakenApiSyncRepository).save(syncCaptor.capture())
        val saved = syncCaptor.firstValue
        assertThat(saved.assigneeSyncEnabled).isFalse()
        assertThat(saved.noteSyncEnabled).isFalse()
        assertThat(saved.noteSubject).isEqualTo(CaseZakenApiSync.DEFAULT_NOTE_SUBJECT)
    }

    private companion object {
        const val FILENAME = "/zgw/zaken-api-sync/test-case.zaken-api-sync.json"
    }
}
