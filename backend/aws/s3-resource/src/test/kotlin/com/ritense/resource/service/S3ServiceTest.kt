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

import com.ritense.resource.BaseTest
import com.ritense.resource.domain.ResourceId
import com.ritense.resource.domain.S3Resource
import com.ritense.resource.domain.S3UploadTicket
import com.ritense.resource.repository.S3UploadTicketRepository
import com.ritense.resource.web.ObjectUrlDTO
import com.ritense.resource.web.ResourceDTO
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.fail
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.springframework.beans.factory.ObjectProvider
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.TestingAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.HeadObjectRequest
import software.amazon.awssdk.services.s3.model.HeadObjectResponse
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest
import java.net.URL
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID

class S3ServiceTest : BaseTest() {

    private val bucketName = "aBucketName"
    lateinit var s3Service: S3Service
    lateinit var s3Client: S3Client
    lateinit var s3Presigner: S3Presigner
    lateinit var s3UploadTicketRepository: S3UploadTicketRepository

    @BeforeEach
    fun setup() {
        baseSetUp()
        s3Client = mock(S3Client::class.java)
        s3Presigner = mock(S3Presigner::class.java)
        s3UploadTicketRepository = mock(S3UploadTicketRepository::class.java)
        SecurityContextHolder.getContext().authentication = TestingAuthenticationToken("user", "pw", "ROLE_USER")
        val presignedPutObjectRequest = mock(PresignedPutObjectRequest::class.java)
        `when`(presignedPutObjectRequest.url()).thenReturn(
            URL("http://example.com")
        )
        `when`(s3Presigner.presignPutObject(any(PutObjectPresignRequest::class.java))).thenReturn(
            presignedPutObjectRequest
        )

        val presignedGetObjectRequest = mock(PresignedGetObjectRequest::class.java)
        `when`(presignedGetObjectRequest.url()).thenReturn(
            URL("http://example.com")
        )
        `when`(s3Presigner.presignGetObject(any(GetObjectPresignRequest::class.java))).thenReturn(
            presignedGetObjectRequest
        )

        s3Service = S3Service(
            bucketName,
            s3Client,
            s3Presigner,
            s3ResourceRepository,
            s3UploadTicketRepository,
            mock(ObjectProvider::class.java) as ObjectProvider<S3ResourceAccessService>
        )
    }

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `should generate unique pre-signed url for fileName`() {
        val fileName = "my-file-name.jpg"

        val url: URL = s3Service.generatePreSignedPutObjectUrl(fileName)

        val argumentCaptor = ArgumentCaptor.forClass(PutObjectPresignRequest::class.java)
        verify(s3Presigner).presignPutObject(argumentCaptor.capture())
        assertThat(argumentCaptor.value.putObjectRequest().key().startsWith("my-file-name-")).isTrue()
        assertThat(argumentCaptor.value.putObjectRequest().key().endsWith(".jpg")).isTrue()
        assertThat(argumentCaptor.value.putObjectRequest().key().length).isEqualTo(53)
        assertThat(url).isNotNull
    }

    @Test
    fun `should get resource url`() {
        val s3Resource: S3Resource = s3Resource()
        `when`(s3ResourceRepository.findById(s3Resource.resourceId)).thenReturn(Optional.of(s3Resource))

        val objectUrlDTO: ObjectUrlDTO = s3Service.getResourceUrl(s3Resource.id())

        assertThat(objectUrlDTO).isNotNull
    }

    @Test
    fun `should remove resource`() {
        val s3Resource: S3Resource = s3Resource()
        `when`(s3ResourceRepository.findById(s3Resource.resourceId)).thenReturn(Optional.of(s3Resource))
        try {
            s3Service.removeResource(s3Resource.id())
        } catch (e: Exception) {
            fail<Any>("failed")
        }
    }

    @Test
    fun `should register resource`() {
        val s3Resource: S3Resource = s3Resource()
        val resourceDTO = ResourceDTO(
            null,
            s3Resource.key,
            s3Resource.name,
            s3Resource.extension,
            s3Resource.sizeInBytes,
            s3Resource.createdOn
        )
        `when`(s3ResourceRepository.saveAndFlush(any())).thenReturn(s3Resource)
        `when`(s3UploadTicketRepository.findById(S3UploadTicket.hash(s3Resource.key)))
            .thenReturn(Optional.of(S3UploadTicket.of(s3Resource.key, "user")))
        `when`(s3Client.headObject(any(HeadObjectRequest::class.java)))
            .thenReturn(HeadObjectResponse.builder().contentLength(10L).build())

        val resourceDTOModified: ResourceDTO = s3Service.registerResource(resourceDTO)
        assertThat(resourceDTOModified).isNotNull
        assertThat(resourceDTOModified.id).isNotNull
        verify(s3UploadTicketRepository).delete(any())
    }

    @Test
    fun `should delete tickets older than 24 hours when issuing a pre-signed url`() {
        val before = LocalDateTime.now()

        s3Service.generatePreSignedPutObjectUrl("file.txt")

        val cutoffCaptor = org.mockito.kotlin.argumentCaptor<LocalDateTime>()
        verify(s3UploadTicketRepository).deleteOlderThan(cutoffCaptor.capture())
        assertThat(cutoffCaptor.firstValue)
            .isBetween(before.minusHours(24).minusSeconds(5), LocalDateTime.now().minusHours(24))
        val ticketCaptor = org.mockito.kotlin.argumentCaptor<S3UploadTicket>()
        verify(s3UploadTicketRepository).save(ticketCaptor.capture())
        assertThat(ticketCaptor.firstValue.createdBy).isEqualTo("user")
    }

    @Test
    fun `should set created by to the current user when storing by key`() {
        val upload = org.springframework.mock.web.MockMultipartFile("file", "doc.txt", "text/plain", "abc".toByteArray())
        `when`(s3ResourceRepository.saveAndFlush(any())).thenAnswer { it.arguments[0] }

        val stored = s3Service.store("some-key", upload)

        assertThat(stored.createdBy).isEqualTo("user")
        assertThat(stored.documentId).isNull()
    }

    @Test
    fun `should not register resource without upload ticket`() {
        val resourceDTO = ResourceDTO(null, "unknownKey", "name", "txt", 10L, LocalDateTime.now())
        `when`(s3UploadTicketRepository.findById(any())).thenReturn(Optional.empty())

        assertThrows<AccessDeniedException> { s3Service.registerResource(resourceDTO) }
    }

    @Test
    fun `should not register resource with upload ticket of another user`() {
        val resourceDTO = ResourceDTO(null, "someKey", "name", "txt", 10L, LocalDateTime.now())
        `when`(s3UploadTicketRepository.findById(S3UploadTicket.hash("someKey")))
            .thenReturn(Optional.of(S3UploadTicket.of("someKey", "otherUser")))

        assertThrows<AccessDeniedException> { s3Service.registerResource(resourceDTO) }
    }

    private fun s3Resource(): S3Resource {
        return S3Resource(
            ResourceId.newId(UUID.randomUUID()),
            "aKeyName",
            "aFileName.txt",
            "aFileName",
            "extension",
            10L,
            LocalDateTime.now()
        )
    }

}