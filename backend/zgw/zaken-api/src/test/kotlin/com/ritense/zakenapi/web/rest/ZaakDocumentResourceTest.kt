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

package com.ritense.zakenapi.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.PermissionRepository
import com.ritense.authorization.role.RoleRepository
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.service.DocumentService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.documentenapi.web.rest.dto.RelatedFileDto
import com.ritense.zakenapi.BaseIntegrationTest
import com.ritense.zakenapi.domain.ZaakResponse
import com.ritense.zgw.Rsin
import org.hamcrest.Matchers.hasSize
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.test.web.servlet.result.MockMvcResultHandlers
import org.springframework.test.web.servlet.result.MockMvcResultMatchers
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext
import java.net.URI
import java.nio.charset.StandardCharsets
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

@Transactional
class ZaakDocumentResourceTest : BaseIntegrationTest() {

    @Autowired
    lateinit var documentService: DocumentService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var roleRepository: RoleRepository

    @Autowired
    lateinit var permissionRepository: PermissionRepository

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    lateinit var mockMvc: MockMvc

    @BeforeEach
    fun init() {
        mockMvc = MockMvcBuilders
            .webAppContextSetup(this.webApplicationContext)
            .build()
        permissionRepository.deleteByRoleKeyIn(listOf("ROLE_TEST"))
    }

    private fun createDocumentId(): UUID = runWithoutAuthorization {
        documentService.createDocument(
            NewDocumentRequest("profile", "profile", "1.0.0", objectMapper.createObjectNode())
        ).resultingDocument().get().id().id
    }

    private fun grantDocumentView() {
        permissionRepository.save(
            Permission(
                id = UUID.randomUUID(),
                resourceType = JsonSchemaDocument::class.java,
                actions = mutableListOf(JsonSchemaDocumentActionProvider.VIEW),
                conditionContainer = ConditionContainer(),
                role = checkNotNull(roleRepository.findByKey("ROLE_TEST")),
                contextResourceType = null,
                contextConditionContainer = null
            )
        )
    }

    @Test
    @WithMockUser(authorities = ["ROLE_TEST"])
    fun `should get zaak-documenten by document`() {
        val documentId = createDocumentId()
        grantDocumentView()

        val informatieObjectId = UUID.randomUUID()
        val relatedFile = createRelatedFile(URI("https://example.local/$informatieObjectId"))
        doReturn(
            listOf(
                relatedFile
            )
        ).whenever(zaakDocumentService).getInformatieObjectenAsRelatedFiles(documentId)

        mockMvc.perform(
            MockMvcRequestBuilders.get("/api/v1/zaken-api/document/{documentId}/files", documentId)
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(MockMvcResultHandlers.print())
            .andExpect(MockMvcResultMatchers.status().is2xxSuccessful)
            .andExpect(jsonPath("$").isNotEmpty)
            .andExpect(jsonPath("$").isArray)
            .andExpect(jsonPath("$.*", hasSize<Int>(1)))
            .andExpect(jsonPath("$.[0].pluginConfigurationId").value(relatedFile.pluginConfigurationId.toString()))
            .andExpect(jsonPath("$.[0].fileName").value(relatedFile.fileName))
            .andExpect(jsonPath("$.[0].sizeInBytes").value(relatedFile.sizeInBytes))
            .andExpect(jsonPath("$.[0].createdOn").value("2023-01-01T12:10:01.000Z"))
            .andExpect(jsonPath("$.[0].createdBy").value(relatedFile.createdBy))
            .andExpect(jsonPath("$.[0].fileId").value(relatedFile.fileId.toString()))
    }

    private fun createRelatedFile(uri: URI) = RelatedFileDto(
        fileId = UUID.fromString(uri.path.substringAfterLast("/")),
        fileName = "titel",
        sizeInBytes = 1337L,
        createdOn = LocalDateTime.parse("2023-01-01T12:10:01"),
        createdBy = "y",
        pluginConfigurationId = UUID.fromString("1f925112-f090-404a-bee7-b20fd8047a72")
    )

    @Test
    @WithMockUser(authorities = ["ROLE_TEST"])
    fun `should get zaak by document id`() {
        val documentId = createDocumentId()
        grantDocumentView()

        val zaakId = UUID.randomUUID()
        val zaak = ZaakResponse(
            url = URI("https://localhost/$zaakId"),
            uuid = zaakId,
            bronorganisatie = Rsin("002564440"),
            zaaktype = URI("http://localhost/zaaktype"),
            verantwoordelijkeOrganisatie = Rsin("002564440"),
            startdatum = LocalDate.now()
        )
        doReturn(zaak).whenever(zaakDocumentService).getZaakByCaseDocumentId(documentId)

        mockMvc.perform(
            MockMvcRequestBuilders.get("/api/v1/zaken-api/document/" +
                "{documentId}/zaak", documentId)
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(MockMvcResultHandlers.print())
            .andExpect(MockMvcResultMatchers.status().is2xxSuccessful)
            .andExpect(jsonPath("$").isNotEmpty)
            .andExpect(jsonPath("$.url").value(zaak.url.toString()))
            .andExpect(jsonPath("$.uuid").value(zaakId.toString()))
            .andExpect(jsonPath("$.bronorganisatie").value(zaak.bronorganisatie.toString()))
            .andExpect(jsonPath("$.zaaktype").value(zaak.zaaktype.toString()))
            .andExpect(jsonPath("$.verantwoordelijkeOrganisatie").value(zaak.verantwoordelijkeOrganisatie.toString()))
            .andExpect(jsonPath("$.startdatum").value(zaak.startdatum.toString()))
    }

    @Test
    @WithMockUser(authorities = ["ROLE_TEST"])
    fun `should return 403 for zaak and files without document view permission`() {
        val documentId = createDocumentId()

        listOf(
            "/api/v1/zaken-api/document/{documentId}/zaak",
            "/api/v1/zaken-api/document/{documentId}/files",
            "/api/v2/zaken-api/document/{documentId}/files",
        ).forEach { url ->
            mockMvc.perform(
                MockMvcRequestBuilders.get(url, documentId).accept(MediaType.APPLICATION_JSON_VALUE)
            ).andExpect(MockMvcResultMatchers.status().isForbidden)
        }
        verify(zaakDocumentService, never()).getZaakByCaseDocumentId(any())
    }

    @Test
    @WithMockUser(authorities = ["ROLE_TEST"])
    fun `should return 404 for zaak of unknown document`() {
        mockMvc.perform(
            MockMvcRequestBuilders.get("/api/v1/zaken-api/document/{documentId}/zaak", UUID.randomUUID())
                .accept(MediaType.APPLICATION_JSON_VALUE)
        ).andExpect(MockMvcResultMatchers.status().isNotFound)
    }
}
