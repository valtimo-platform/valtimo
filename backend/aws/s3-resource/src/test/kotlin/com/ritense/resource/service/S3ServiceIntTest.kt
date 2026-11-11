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
import com.ritense.resource.repository.S3UploadTicketRepository
import com.ritense.resource.web.ResourceDTO
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.context.support.WithMockUser
import software.amazon.awssdk.services.s3.model.HeadObjectRequest
import software.amazon.awssdk.services.s3.model.HeadObjectResponse
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest
import java.net.URL
import java.time.LocalDateTime
import java.util.UUID

class S3ServiceIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var s3UploadTicketRepository: S3UploadTicketRepository

    @BeforeEach
    fun setup() {
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
    }

    @Test
    @WithMockUser("userA")
    fun `should register resource`() {
        val s3Resource: S3Resource = s3Resource()
        s3UploadTicketRepository.save(S3UploadTicket.of(s3Resource.key, "userA"))
        `when`(s3Client.headObject(any(HeadObjectRequest::class.java)))
            .thenReturn(HeadObjectResponse.builder().contentLength(10L).build())
        val resourceDTO = ResourceDTO(
            null,
            s3Resource.key,
            s3Resource.name,
            s3Resource.extension,
            s3Resource.sizeInBytes,
            s3Resource.createdOn
        )
        val resourceDTOModified: ResourceDTO = s3Service.registerResource(resourceDTO)
        assertThat(resourceDTOModified).isNotNull;
        assertThat(resourceDTOModified.id).isNotNull;
        assertThat(resourceDTOModified.extension).isEqualTo("txt");
    }

    private fun s3Resource(): S3Resource {
        return S3Resource(
            ResourceId.newId(UUID.randomUUID()),
            "aKeyName",
            "aFileName.txt",
            "aFileName",
            "pdf",
            10L,
            LocalDateTime.now()
        )
    }

}