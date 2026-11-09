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

import com.ritense.resource.BaseIntegrationTest
import com.ritense.resource.domain.ResourceId
import com.ritense.resource.domain.S3Resource
import com.ritense.resource.domain.S3UploadTicket
import com.ritense.resource.repository.S3ResourceRepository
import com.ritense.resource.repository.S3UploadTicketRepository
import com.ritense.resource.web.ResourceDTO
import com.ritense.resource.web.rest.S3Resource as S3ResourceController
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.test.context.support.WithMockUser
import software.amazon.awssdk.services.s3.model.HeadObjectRequest
import software.amazon.awssdk.services.s3.model.HeadObjectResponse
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest
import java.net.URL
import java.time.LocalDateTime
import java.util.UUID

class S3ResourceAuthorizationIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var s3ResourceRepository: S3ResourceRepository

    @Autowired
    lateinit var s3UploadTicketRepository: S3UploadTicketRepository

    @Autowired
    lateinit var controller: S3ResourceController

    @Autowired
    lateinit var accessService: S3ResourceAccessService

    @AfterEach
    fun cleanup() {
        s3ResourceRepository.deleteAll()
        s3UploadTicketRepository.deleteAll()
    }

    @Test
    @WithMockUser("userA")
    fun `register without ticket is denied`() {
        assertThrows<AccessDeniedException> { s3Service.registerResource(dto("never-issued.txt")) }
    }

    @Test
    fun `register with ticket of another user is denied`() {
        s3UploadTicketRepository.save(S3UploadTicket.of("issued-to-a.txt", "userA"))

        withUser("userB") {
            assertThrows<AccessDeniedException> { s3Service.registerResource(dto("issued-to-a.txt")) }
        }
    }

    @Test
    @WithMockUser("userA")
    fun `register twice with the same ticket is denied the second time`() {
        s3UploadTicketRepository.save(S3UploadTicket.of("once.txt", "userA"))
        `when`(s3Client.headObject(any(HeadObjectRequest::class.java)))
            .thenReturn(HeadObjectResponse.builder().contentLength(42L).build())

        val registered = s3Service.registerResource(dto("once.txt"))

        assertThat(registered.sizeInBytes).isEqualTo(42L)
        assertThat(s3ResourceRepository.findById(ResourceId.existingId(UUID.fromString(registered.id))).get().createdBy)
            .isEqualTo("userA")
        assertThrows<AccessDeniedException> { s3Service.registerResource(dto("once.txt")) }
    }

    @Test
    fun `unlinked resource is accessible to its creator only`() {
        val resource = save(createdBy = "userA")
        mockPresign()

        withUser("userA") {
            assertThat(controller.get(resource.id().toString()).statusCode.is2xxSuccessful).isTrue()
        }
        withUser("userB") {
            assertThrows<AccessDeniedException> { controller.get(resource.id().toString()) }
            assertThrows<AccessDeniedException> { controller.delete(resource.id().toString()) }
        }
        withUser("userA") {
            assertThat(controller.delete(resource.id().toString()).statusCode.is2xxSuccessful).isTrue()
        }
        assertThat(s3ResourceRepository.findById(resource.resourceId)).isEmpty
    }

    @Test
    fun `linked resource cannot be deleted through the resource endpoint and is denied without case access`() {
        val resource = save(createdBy = "userA", documentId = UUID.randomUUID())

        withUser("userA") {
            assertThrows<AccessDeniedException> { controller.delete(resource.id().toString()) }
            assertThrows<AccessDeniedException> { controller.get(resource.id().toString()) }
        }
    }

    @Test
    fun `legacy resource is accessible to admin only`() {
        val resource = save(createdBy = null)
        mockPresign()

        withUser("userA") {
            assertThrows<AccessDeniedException> { controller.get(resource.id().toString()) }
        }
        withUser("admin", "ROLE_ADMIN") {
            assertThat(controller.get(resource.id().toString()).statusCode.is2xxSuccessful).isTrue()
        }
    }

    @Test
    fun `claim for document follows ownership rules`() {
        val resource = save(createdBy = "userA")
        val documentId = UUID.randomUUID()

        withUser("userB") {
            assertThrows<AccessDeniedException> { s3Service.claimForDocument(resource.id(), documentId) }
        }
        withUser("userA") {
            s3Service.claimForDocument(resource.id(), documentId)
            s3Service.claimForDocument(resource.id(), documentId)
            assertThrows<AccessDeniedException> { s3Service.claimForDocument(resource.id(), UUID.randomUUID()) }
        }
        assertThat(s3ResourceRepository.findById(resource.resourceId).get().documentId).isEqualTo(documentId)
    }

    private fun withUser(username: String, vararg roles: String, block: () -> Unit) {
        val context = org.springframework.security.core.context.SecurityContextHolder.createEmptyContext()
        context.authentication = org.springframework.security.authentication.TestingAuthenticationToken(
            username, "pw", *(roles.ifEmpty { arrayOf("ROLE_USER") })
        )
        val previous = org.springframework.security.core.context.SecurityContextHolder.getContext()
        org.springframework.security.core.context.SecurityContextHolder.setContext(context)
        try {
            block()
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.setContext(previous)
        }
    }

    private fun mockPresign() {
        val presigned = mock(PresignedGetObjectRequest::class.java)
        `when`(presigned.url()).thenReturn(URL("http://example.com"))
        `when`(s3Presigner.presignGetObject(any(GetObjectPresignRequest::class.java))).thenReturn(presigned)
    }

    private fun dto(key: String) = ResourceDTO(null, key, "name.txt", "txt", 1L, LocalDateTime.now())

    private fun save(createdBy: String?, documentId: UUID? = null): S3Resource {
        return s3ResourceRepository.saveAndFlush(
            S3Resource(
                ResourceId.newId(UUID.randomUUID()),
                "bucket",
                "key-${UUID.randomUUID()}.txt",
                "name.txt",
                "txt",
                10L,
                LocalDateTime.now(),
                createdBy,
                documentId
            )
        )
    }
}
