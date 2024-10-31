/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import com.ritense.resource.web.ObjectUrlDTO
import com.ritense.resource.web.ResourceDTO
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.fail
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock
import software.amazon.awssdk.services.s3.S3Client
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
    lateinit var s3Presigner: S3Presigner;

    @BeforeEach
    fun setup() {
        baseSetUp()
        s3Client = mock(S3Client::class.java)
        s3Presigner = mock(S3Presigner::class.java)
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
            s3ResourceRepository
        )
    }

    @Test
    fun `should generate pre-signed url for fileName`() {
        val fileName = "my-file-name"
        val url: URL = s3Service.generatePreSignedPutObjectUrl(fileName)
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
        `when`(s3ResourceRepository.findById(s3Resource.resourceId)).thenReturn(Optional.of(s3Resource))
        `when`(s3ResourceRepository.saveAndFlush(any())).thenReturn(s3Resource)

        val resourceDTOModified: ResourceDTO = s3Service.registerResource(resourceDTO)
        assertThat(resourceDTOModified).isNotNull;
        assertThat(resourceDTOModified.id).isNotNull;
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