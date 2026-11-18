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

package com.ritense.resource.service

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.service.DocumentService
import com.ritense.resource.domain.ResourceId
import com.ritense.resource.domain.S3Resource
import com.ritense.resource.repository.S3ResourceRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.Mockito.doThrow
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.TestingAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID

class S3ResourceAccessServiceTest {

    private lateinit var repository: S3ResourceRepository
    private lateinit var documentService: DocumentService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var accessService: S3ResourceAccessService

    @BeforeEach
    fun setup() {
        repository = mock(S3ResourceRepository::class.java)
        documentService = mock(DocumentService::class.java)
        authorizationService = mock(AuthorizationService::class.java)
        accessService = S3ResourceAccessService(repository, documentService, authorizationService)
        loginAs("userA")
    }

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `linked resource is readable when the user has view permission on the document`() {
        val documentId = UUID.randomUUID()
        val resource = resource(createdBy = "someoneElse", documentId = documentId)
        `when`(documentService.findBy(any())).thenReturn(Optional.of(mock(JsonSchemaDocument::class.java)))

        assertDoesNotThrow { accessService.requireReadAccess(resource) }
    }

    @Test
    fun `linked resource is denied when the user lacks view permission on the document`() {
        val resource = resource(createdBy = "userA", documentId = UUID.randomUUID())
        `when`(documentService.findBy(any())).thenReturn(Optional.of(mock(JsonSchemaDocument::class.java)))
        doThrow(AccessDeniedException("denied")).`when`(authorizationService)
            .requirePermission(any<AuthorizationRequest<JsonSchemaDocument>>())

        assertThrows<AccessDeniedException> { accessService.requireReadAccess(resource) }
    }

    @Test
    fun `linked resource is denied when the document no longer exists`() {
        val resource = resource(createdBy = "userA", documentId = UUID.randomUUID())
        `when`(documentService.findBy(any())).thenReturn(Optional.empty())

        assertThrows<AccessDeniedException> { accessService.requireReadAccess(resource) }
    }

    @Test
    fun `linked resource cannot be deleted through the resource endpoint`() {
        val resource = resource(createdBy = "userA", documentId = UUID.randomUUID())

        assertThrows<AccessDeniedException> { accessService.requireDeleteAccess(resource) }
    }

    @Test
    fun `unlinked resource is accessible to its creator only`() {
        val resource = resource(createdBy = "userA")

        assertDoesNotThrow { accessService.requireReadAccess(resource) }
        assertDoesNotThrow { accessService.requireDeleteAccess(resource) }

        loginAs("userB")
        assertThrows<AccessDeniedException> { accessService.requireReadAccess(resource) }
        assertThrows<AccessDeniedException> { accessService.requireDeleteAccess(resource) }
    }

    @Test
    fun `legacy resource is accessible to admin only`() {
        val resource = resource(createdBy = null)

        assertThrows<AccessDeniedException> { accessService.requireReadAccess(resource) }

        loginAs("admin", "ROLE_ADMIN")
        assertDoesNotThrow { accessService.requireReadAccess(resource) }
        assertDoesNotThrow { accessService.requireDeleteAccess(resource) }
    }

    private fun loginAs(username: String, vararg roles: String) {
        SecurityContextHolder.getContext().authentication =
            TestingAuthenticationToken(username, "pw", *(roles.ifEmpty { arrayOf("ROLE_USER") }))
    }

    private fun resource(createdBy: String?, documentId: UUID? = null) = S3Resource(
        ResourceId.newId(UUID.randomUUID()),
        "bucket",
        "key.txt",
        "name.txt",
        "txt",
        10L,
        LocalDateTime.now(),
        createdBy,
        documentId
    )
}
