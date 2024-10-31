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

import com.ritense.resource.domain.ResourceId
import com.ritense.resource.domain.S3Resource
import com.ritense.resource.repository.S3ResourceRepository
import com.ritense.resource.service.request.FileUploadRequest
import com.ritense.resource.service.request.MultipartFileUploadRequest
import com.ritense.resource.web.ObjectContentDTO
import com.ritense.resource.web.ObjectUrlDTO
import com.ritense.resource.web.ResourceDTO
import com.ritense.valtimo.contract.resource.FileStatus
import com.ritense.valtimo.contract.resource.Resource
import org.apache.commons.io.FilenameUtils
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import software.amazon.awssdk.core.ResponseInputStream
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest
import software.amazon.awssdk.services.s3.model.DeleteObjectTaggingRequest
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import software.amazon.awssdk.services.s3.model.GetObjectResponse
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import software.amazon.awssdk.services.s3.model.PutObjectTaggingRequest
import software.amazon.awssdk.services.s3.model.Tag
import software.amazon.awssdk.services.s3.model.Tagging
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.URL
import java.time.Duration
import java.time.LocalDateTime
import java.util.UUID

@Transactional
class S3Service(
    private val bucketName: String,
    private val s3Client: S3Client,
    private val s3Presigner: S3Presigner,
    private val s3ResourceRepository: S3ResourceRepository
) : ResourceService {

    fun generatePreSignedPutObjectUrl(fileName: String): URL {
        val putObjectRequest = buildPutObjectRequest(bucketName, fileName)
        return s3Presigner.presignPutObject(putObjectRequest).url()
    }

    override fun getResourceUrl(id: UUID): ObjectUrlDTO {
        val s3ResourceId = ResourceId.existingId(id)
        val s3Resource = s3ResourceRepository.findById(s3ResourceId).orElseThrow()
        val getUrl: URL = s3Presigner.presignGetObject(buildGetObjectRequest(s3Resource)).url()
        return ObjectUrlDTO(
            getUrl,
            ResourceDTO(
                s3Resource.id.toString(),
                s3Resource.key,
                s3Resource.bucketName,
                s3Resource.extension,
                s3Resource.sizeInBytes,
                s3Resource.createdOn
            )
        )
    }

    override fun removeResource(id: UUID) {
        val s3ResourceId = ResourceId.existingId(id)
        val s3Resource = s3ResourceRepository.findById(s3ResourceId).orElseThrow()
        val deleteObjectRequest = DeleteObjectRequest
            .builder()
            .bucket(s3Resource.bucketName)
            .key(s3Resource.key)
            .build()
        s3Client.deleteObject(deleteObjectRequest)
        s3ResourceRepository.deleteById(s3Resource.id)
    }

    override fun registerResource(resourceDTO: ResourceDTO): ResourceDTO {
        var s3Resource = buildS3Resource(
            UUID.randomUUID(),
            resourceDTO.key,
            resourceDTO.name,
            FilenameUtils.getExtension(resourceDTO.key),
            resourceDTO.sizeInBytes
        )
        s3Resource = s3ResourceRepository.saveAndFlush(s3Resource)
        return ResourceDTO(
            s3Resource.id.id.toString(),
            s3Resource.key,
            s3Resource.bucketName,
            s3Resource.extension,
            s3Resource.sizeInBytes,
            s3Resource.createdOn
        )
    }

    override fun removeResource(key: String) {
        val s3Resource = s3ResourceRepository.findByKey(key)
        val deleteObjectRequest = DeleteObjectRequest
            .builder()
            .bucket(s3Resource.bucketName)
            .key(s3Resource.key)
            .build()
        s3Client.deleteObject(deleteObjectRequest)
        s3ResourceRepository.deleteById(s3Resource.id)
    }

    override fun getResourceContent(id: UUID): ObjectContentDTO {
        val s3ResourceId = ResourceId.existingId(id)
        val s3Resource = s3ResourceRepository.findById(s3ResourceId).orElseThrow()
        val getUrl: URL = s3Presigner.presignGetObject(buildGetObjectRequest(s3Resource)).url()

        val getObjectRequest = GetObjectRequest.builder()
            .bucket(s3Resource.bucketName)
            .key(s3Resource.key)
            .build()
        val contentStream = s3Client.getObject(getObjectRequest)
        return ObjectContentDTO(
            getUrl,
            ResourceDTO(
                s3Resource.id.toString(),
                s3Resource.key,
                s3Resource.bucketName,
                s3Resource.extension,
                s3Resource.sizeInBytes,
                s3Resource.createdOn
            ),
            downloadS3Object(contentStream)
        )
    }

    override fun store(key: String, multipartFile: MultipartFile): S3Resource {
        return store(key, MultipartFileUploadRequest.from(multipartFile))
    }

    override fun store(key: String, multipartFile: MultipartFile, fileStatus: FileStatus): S3Resource {
        return store(key, MultipartFileUploadRequest.from(multipartFile), fileStatus)
    }

    override fun store(
        documentDefinitionName: String,
        name: String,
        multipartFile: MultipartFile
    ): Resource {
        TODO("Not yet implemented")
    }

    override fun store(key: String, fileUploadRequest: FileUploadRequest): S3Resource {
        val putObjectRequest = PutObjectRequest.builder()
            .bucket(bucketName)
            .key(key)
            .contentType(fileUploadRequest.getContentType())
            .contentLength(fileUploadRequest.getSize())
            .build()
        val requestBody = RequestBody.fromInputStream(fileUploadRequest.getInputStream(), fileUploadRequest.getSize())
        s3Client.putObject(putObjectRequest, requestBody)
        val s3Resource = buildS3Resource(
            UUID.randomUUID(),
            key,
            fileUploadRequest.getName(),
            fileUploadRequest.getExtension(),
            fileUploadRequest.getSize()
        )
        s3ResourceRepository.saveAndFlush(s3Resource)
        return s3Resource
    }

    override fun store(key: String, fileUploadRequest: FileUploadRequest, fileStatus: FileStatus): S3Resource {
        val putObjectRequest = PutObjectRequest.builder()
            .bucket(bucketName)
            .key(key)
            .contentType(fileUploadRequest.getContentType())
            .contentLength(fileUploadRequest.getSize())
            .tagging(getFileStatusTag(fileStatus))
            .build()
        val requestBody = RequestBody.fromInputStream(fileUploadRequest.getInputStream(), fileUploadRequest.getSize())
        s3Client.putObject(putObjectRequest, requestBody)
        val s3Resource = buildS3Resource(
            UUID.randomUUID(),
            key,
            fileUploadRequest.getName(),
            fileUploadRequest.getExtension(),
            fileUploadRequest.getSize()
        )
        s3ResourceRepository.saveAndFlush(s3Resource)
        return s3Resource
    }

    override fun getResourceUrl(fileName: String): URL {
        val resource = getResourceByKey(fileName)
        val presignRequest = buildGetObjectRequest(resource)
        val presignedRequest: PresignedGetObjectRequest = s3Presigner.presignGetObject(presignRequest)
        return presignedRequest.url()
    }

    override fun getResource(id: UUID): S3Resource {
        val s3ResourceId = ResourceId.existingId(id)
        return s3ResourceRepository.findById(s3ResourceId)
            .orElseThrow { RuntimeException("Unable to find resource with ID $s3ResourceId") }
    }

    override fun getResourceByKey(fileName: String): S3Resource {
        return s3ResourceRepository.findByKey(fileName)
    }

    override fun activate(id: UUID) {
        val s3ResourceId = ResourceId.existingId(id)
        val s3Resource = s3ResourceRepository.findById(s3ResourceId).orElseThrow()

        //Reset all possible tags
        val deleteObjectTaggingRequest = DeleteObjectTaggingRequest
            .builder()
            .bucket(s3Resource.bucketName)
            .key(s3Resource.key)
            .build()
        s3Client.deleteObjectTagging(deleteObjectTaggingRequest);

        //Apply 'active' tag
        val objectTaggingRequest = PutObjectTaggingRequest.builder()
            .bucket(s3Resource.bucketName)
            .key(s3Resource.key)
            .tagging(getFileStatusTag(FileStatus.ACTIVE))
            .build()
        s3Client.putObjectTagging(objectTaggingRequest)
    }

    override fun pending(id: UUID) {
        val s3ResourceId = ResourceId.existingId(id)
        val s3Resource = s3ResourceRepository.findById(s3ResourceId).orElseThrow()

        //Reset all possible tags
        val deleteObjectTaggingRequest = DeleteObjectTaggingRequest.builder()
            .bucket(s3Resource.bucketName)
            .key(s3Resource.key)
            .build()
        s3Client.deleteObjectTagging(deleteObjectTaggingRequest)

        //Apply 'pending' tag
        val objectTaggingRequest = PutObjectTaggingRequest.builder()
            .bucket(s3Resource.bucketName)
            .key(s3Resource.key)
            .tagging(getFileStatusTag(FileStatus.PENDING))
            .build()
        s3Client.putObjectTagging(objectTaggingRequest)
    }

    // Private
    private fun downloadS3Object(s3InputStream: ResponseInputStream<GetObjectResponse>): ByteArray {
        return try {
            val outputStream = ByteArrayOutputStream()
            val bytes = ByteArray(1024)
            var length: Int
            while (s3InputStream.read(bytes).also { length = it } > 0) {
                outputStream.write(bytes, 0, length)
            }
            s3InputStream.close()
            outputStream.close()
            outputStream.toByteArray()
        } catch (e: Exception) {
            throw RuntimeException("Cannot download s3 object")
        } catch (e: IOException) {
            throw RuntimeException("Cannot download s3 object")
        }
    }

    private fun buildS3Resource(id: UUID, key: String, name: String, extension: String, size: Long): S3Resource {
        return S3Resource(
            ResourceId.newId(id),
            bucketName,
            key,
            name,
            extension,
            size,
            LocalDateTime.now()
        )
    }

    private fun getFileStatusTag(fileStatus: FileStatus): Tagging {
        return Tagging.builder()
            .tagSet(
                Tag.builder()
                    .key(fileStatus.javaClass.name)
                    .value(fileStatus.toString()).build()
            ).build()
    }

    private fun buildPutObjectRequest(
        bucketName: String,
        key: String
    ): PutObjectPresignRequest {
        val objectRequest = PutObjectRequest.builder()
            .bucket(bucketName)
            .key(key)
            .build()
        return PutObjectPresignRequest.builder()
            .signatureDuration(Duration.ofMinutes(60))
            .putObjectRequest(objectRequest)
            .build()
    }

    private fun buildGetObjectRequest(
        resource: S3Resource
    ): GetObjectPresignRequest {
        val objectRequest = GetObjectRequest.builder()
            .bucket(resource.bucketName)
            .key(resource.key)
            .build()
        return GetObjectPresignRequest.builder()
            .signatureDuration(Duration.ofMinutes(60))
            .getObjectRequest(objectRequest)
            .build()
    }

}