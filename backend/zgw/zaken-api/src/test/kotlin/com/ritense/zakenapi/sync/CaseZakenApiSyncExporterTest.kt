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
import com.ritense.exporter.request.DocumentDefinitionExportRequest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import java.net.URI
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.skyscreamer.jsonassert.JSONAssert
import org.skyscreamer.jsonassert.JSONCompareMode

class CaseZakenApiSyncExporterTest {

    private lateinit var caseZakenApiSyncRepository: CaseZakenApiSyncRepository
    private lateinit var exporter: CaseZakenApiSyncExporter

    private val objectMapper = jacksonObjectMapper()
    private val caseDefinitionId = CaseDefinitionId("bezwaar", "1.0.1")
    private val request = DocumentDefinitionExportRequest("bezwaar", caseDefinitionId)

    @BeforeEach
    fun setUp() {
        caseZakenApiSyncRepository = mock()
        exporter = CaseZakenApiSyncExporter(objectMapper, caseZakenApiSyncRepository)
    }

    @Test
    fun `should support DocumentDefinitionExportRequest`() {
        assertThat(exporter.supports()).isEqualTo(DocumentDefinitionExportRequest::class.java)
    }

    @Test
    fun `should return empty result when no sync configuration exists`() {
        whenever(caseZakenApiSyncRepository.findByCaseDefinitionId(eq(caseDefinitionId))).thenReturn(null)

        val result = exporter.export(request)

        assertThat(result.exportFiles).isEmpty()
    }

    @Test
    fun `should export sync configuration to the expected path with the expected JSON`() {
        whenever(caseZakenApiSyncRepository.findByCaseDefinitionId(eq(caseDefinitionId))).thenReturn(
            CaseZakenApiSync(
                caseDefinitionId = caseDefinitionId,
                assigneeSyncEnabled = true,
                roltypeUrl = URI("http://localhost:8001/catalogi/api/v1/roltypen/abc"),
                noteSyncEnabled = true,
                noteSubject = "Notitie aangemaakt in Valtimo GZAC",
            )
        )

        val result = exporter.export(request)

        assertThat(result.exportFiles).hasSize(1)
        val file = result.exportFiles.single()
        assertThat(file.path).isEqualTo(
            "config/case/bezwaar/1-0-1/zgw/zaken-api-sync/bezwaar.zaken-api-sync.json"
        )
        JSONAssert.assertEquals(
            """
                {
                  "assigneeSyncEnabled": true,
                  "roltypeUrl": "http://localhost:8001/catalogi/api/v1/roltypen/abc",
                  "noteSyncEnabled": true,
                  "noteSubject": "Notitie aangemaakt in Valtimo GZAC"
                }
            """.trimIndent(),
            String(file.content),
            JSONCompareMode.NON_EXTENSIBLE
        )
    }

    @Test
    fun `should export defaults when sync flags are off`() {
        whenever(caseZakenApiSyncRepository.findByCaseDefinitionId(eq(caseDefinitionId))).thenReturn(
            CaseZakenApiSync(caseDefinitionId = caseDefinitionId)
        )

        val result = exporter.export(request)

        assertThat(result.exportFiles).hasSize(1)
        JSONAssert.assertEquals(
            """
                {
                  "assigneeSyncEnabled": false,
                  "roltypeUrl": null,
                  "noteSyncEnabled": false,
                  "noteSubject": "Note created by Valtimo GZAC"
                }
            """.trimIndent(),
            String(result.exportFiles.single().content),
            JSONCompareMode.NON_EXTENSIBLE
        )
    }
}
