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

package com.ritense.processdocument.golden

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.service.CaseDefinitionImportService
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.test.golden.GoldenZip
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation
import org.junit.jupiter.api.Order
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestMethodOrder
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.WebApplicationContext
import java.nio.file.Files

@TestMethodOrder(OrderAnnotation::class)
class ExportGoldenIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    lateinit var caseDefinitionImportService: CaseDefinitionImportService

    @Autowired
    lateinit var documentDefinitionService: DocumentDefinitionService

    @Test
    @Order(1)
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `case export keeps its files and JSON`() {
        val zip = MockMvcBuilders.webAppContextSetup(webApplicationContext).build()
            .perform(get("/api/management/v1/case/{key}/version/{tag}/export", "house", "1.0.0"))
            .andExpect(status().isOk)
            .andReturn().response.contentAsByteArray

        GoldenZip.assertMatchesGolden(
            javaClass,
            "house-1-0-0",
            zip,
            ignorePaths = mapOf("valtimo-manifest.json" to listOf("/artifacts/*/valtimoVersion")),
            unorderedPaths = mapOf(
                "config/case/house/1-0-0/process-document-link/house.process-document-link.json" to listOf("/")
            )
        )
    }

    @Test
    @Order(2)
    fun `an export made on the baseline imports`() {
        val baselineExport = GoldenZip.recordedZip(javaClass, "house-1-0-0")

        val caseDefinitionId = runWithoutAuthorization {
            Files.newInputStream(baselineExport).use {
                caseDefinitionImportService.import(it, "golden-imported-house", "Golden imported house")
            }
        }

        assertThat(caseDefinitionId?.key).isEqualTo("golden-imported-house")
        val definitions = runWithoutAuthorization { documentDefinitionService.findAllBy(caseDefinitionId) }
        assertThat(definitions).isNotEmpty
    }
}
