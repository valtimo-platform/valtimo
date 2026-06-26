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

package com.ritense.zaakdetails.web.rest

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.zaakdetails.service.CaseZaakdetailsInspectionService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.net.URI
import java.util.UUID
import kotlin.test.assertEquals

class CaseZaakdetailsInspectionResourceTest {

    private lateinit var authorizationService: AuthorizationService
    private lateinit var caseZaakdetailsInspectionService: CaseZaakdetailsInspectionService

    private lateinit var resource: CaseZaakdetailsInspectionResource

    private val caseId: UUID = UUID.randomUUID()
    private val document: JsonSchemaDocument = mock()

    @BeforeEach
    fun setUp() {
        authorizationService = mock()
        caseZaakdetailsInspectionService = mock()

        resource = CaseZaakdetailsInspectionResource(
            authorizationService = authorizationService,
            caseZaakdetailsInspectionService = caseZaakdetailsInspectionService,
        )

        whenever(caseZaakdetailsInspectionService.loadDocument(caseId)).thenReturn(document)
    }

    @Test
    fun `getZaakdetailsInspection requires INSPECT permission on the document`() {
        resource.getZaakdetailsInspection(caseId)

        val captor = argumentCaptor<EntityAuthorizationRequest<JsonSchemaDocument>>()
        verify(authorizationService).requirePermission(captor.capture())
        assertEquals(JsonSchemaDocument::class.java, captor.firstValue.resourceType)
    }

    @Test
    fun `getZaakdetailsInspection propagates authorization failure without calling the service`() {
        doThrow(RuntimeException("denied")).whenever(authorizationService)
            .requirePermission(any<AuthorizationRequest<JsonSchemaDocument>>())

        assertThrows<RuntimeException> { resource.getZaakdetailsInspection(caseId) }

        verify(caseZaakdetailsInspectionService, never()).getInspection(any(), any())
    }

    @Test
    fun `getZaakdetailsObjectContent requires INSPECT permission`() {
        resource.getZaakdetailsObjectContent(caseId)

        verify(authorizationService).requirePermission(any<AuthorizationRequest<JsonSchemaDocument>>())
        verify(caseZaakdetailsInspectionService).getZaakdetailsObjectContent(caseId)
    }

    @Test
    fun `resolveZaakobjectContent requires INSPECT permission`() {
        val objectUrl = URI("https://objecten.example.nl/api/v2/objects/${UUID.randomUUID()}")

        resource.resolveZaakobjectContent(caseId, objectUrl)

        verify(authorizationService).requirePermission(any<AuthorizationRequest<JsonSchemaDocument>>())
        verify(caseZaakdetailsInspectionService).resolveZaakobjectContent(caseId, objectUrl)
    }

    @Test
    fun `resolveZaakobjectContent propagates authorization failure without calling the service`() {
        val objectUrl = URI("https://objecten.example.nl/api/v2/objects/${UUID.randomUUID()}")
        doThrow(RuntimeException("denied")).whenever(authorizationService)
            .requirePermission(any<AuthorizationRequest<JsonSchemaDocument>>())

        assertThrows<RuntimeException> { resource.resolveZaakobjectContent(caseId, objectUrl) }

        verify(caseZaakdetailsInspectionService, never()).resolveZaakobjectContent(any(), any())
    }
}
