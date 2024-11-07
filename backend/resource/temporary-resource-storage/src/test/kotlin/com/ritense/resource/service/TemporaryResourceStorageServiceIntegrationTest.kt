/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.resource.BaseIntegrationTest
import com.ritense.resource.domain.MetadataType
import com.ritense.valtimo.contract.upload.MimeTypeDeniedException
import com.ritense.valtimo.contract.upload.ValtimoUploadProperties
import org.apache.tika.Tika
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.assertThrows
import org.mockito.Mock
import org.mockito.Mockito
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.core.io.ClassPathResource
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.util.UUID
import kotlin.io.path.Path

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class TemporaryResourceStorageServiceIntegrationTest : BaseIntegrationTest() {

    @Autowired
    lateinit var temporaryResourceStorageService: TemporaryResourceStorageService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Mock
    lateinit var tika: Tika

    @Mock
    lateinit var uploadProperties: ValtimoUploadProperties

    @BeforeEach
    fun beforeEach() {
        whenever(resourceStorageMetadataRepository.getResourceStorageMetadataByIdFileId(any())).thenReturn(emptyList())
    }

    @Test
    fun `should store and get resource as inputStream`() {
        val fileData = "My file data"

        val resourceId = temporaryResourceStorageService.store(fileData.byteInputStream())
        val result = temporaryResourceStorageService.getResourceContentAsInputStream(resourceId)

        assertThat(result.reader().readText()).isEqualTo(fileData)
    }

    @Test
    fun `should correctly detect zip files and throw exception`() {
        val exception = assertThrows<MimeTypeDeniedException> {
            ClassPathResource("files/test.zip").inputStream.use {
                temporaryResourceStorageService.store(it)
            }
        }
        assertThat(exception.message).contains("application/zip")
    }

    @Test
    fun `should correctly detect docx files and throw exception`() {
        val exception = assertThrows<MimeTypeDeniedException> {
            ClassPathResource("files/test.docx").inputStream.use {
                temporaryResourceStorageService.store(it)
            }
        }
        assertThat(exception.message).contains("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    }

    @Test
    fun `store method should only use the core MIME type without parameters`() {
        `when`(uploadProperties.acceptedMimeTypes).thenReturn(setOf("image/png", "image/jpeg"))
        val inputStream: InputStream = ByteArrayInputStream("Test content".toByteArray())

        // Mock Tika's detection to return a MIME type with additional parameters
        `when`(tika.detect(Mockito.any(InputStream::class.java))).thenReturn("image/png; charset=UTF-8")

        val result = temporaryResourceStorageService.store(inputStream)

        // Validate that the method returned a result, indicating the file was accepted
        assertNotNull(result)
    }

    @Test
    fun `should store and retrieve metadata`() {
        val fileData = "My file data"
        val fileName = "test.txt"

        val resourceId = temporaryResourceStorageService.store(
            fileData.byteInputStream(),
            mapOf(MetadataType.FILE_NAME.key to fileName)
        )

        val metadata = temporaryResourceStorageService.getResourceMetadata(resourceId)
        assertThat(metadata[MetadataType.FILE_NAME.key]).isEqualTo(fileName)
        assertThat(metadata).doesNotContainKey(MetadataType.FILE_PATH.key)
        assertThat(metadata[MetadataType.FILE_SIZE.key]).isNotNull
        assertThat(metadata[MetadataType.FILE_SIZE.key]).isEqualTo(fileData.length.toString())
    }

    @Test
    fun `should not be able to traverse the filesystem using the resourceId`() {
        val fileData = "My file data"
        val fileName = "test.txt"

        val resourceId = temporaryResourceStorageService.store(
            fileData.byteInputStream(),
            mapOf(MetadataType.FILE_NAME.key to fileName)
        )

        val metadataFilePath = temporaryResourceStorageService.getMetaDataFileFromResourceId(resourceId)

        val newFile = Path(metadataFilePath.parent.parent.toString(), metadataFilePath.fileName.toString()).toFile()
        newFile.writeBytes(objectMapper.writeValueAsBytes(mapOf("traversed" to true)))

        val traversedMetaData = temporaryResourceStorageService.getResourceMetadata("../$resourceId")
        assertThat(traversedMetaData).containsEntry(MetadataType.FILE_NAME.key, fileName)
        assertThat(traversedMetaData).doesNotContainKey("traversed")
    }

    @Test
    fun `should patch metadata`() {
        val fileData = "My file data"
        val fileName = "test.txt"
        val changeKey = "changeKey"
        val removeKey = "removeKey"

        val resourceId = temporaryResourceStorageService.store(
            fileData.byteInputStream(),
            mapOf(
                MetadataType.FILE_NAME.key to fileName,
                changeKey to "x",
                removeKey to "exists"
            )
        )

        temporaryResourceStorageService.patchResourceMetaData(
            resourceId, mapOf(
                changeKey to "y",
                removeKey to null
            )
        )

        val patchedMetaData = temporaryResourceStorageService.getResourceMetadata(resourceId, false)

        assertThat(patchedMetaData[MetadataType.FILE_NAME.key]).isEqualTo(fileName)
        assertThat(patchedMetaData[MetadataType.FILE_PATH.key]).asString().hasSizeGreaterThan(0)
        assertThat(patchedMetaData[MetadataType.FILE_SIZE.key]).isEqualTo(fileData.length.toString())
        assertThat(patchedMetaData[changeKey]).isEqualTo("y")
        assertThat(patchedMetaData).doesNotContainKey(removeKey)
    }

    @Test
    fun `should not patch filePath in metadata`() {
        val exception = assertThrows<IllegalArgumentException> {
            temporaryResourceStorageService.patchResourceMetaData(
                UUID.randomUUID().toString(), mapOf(
                    MetadataType.FILE_PATH.key to "",
                )
            )
        }

        assertThat(exception.message).isEqualTo("${MetadataType.FILE_PATH.key} cannot be patched!")
    }

    @Test
    fun `should delete resource`() {
        val resourceId = temporaryResourceStorageService.store("My file data".byteInputStream())

        val deleted = temporaryResourceStorageService.deleteResource(resourceId)

        assertThat(deleted).isTrue
        val exception = assertThrows<IllegalArgumentException> {
            temporaryResourceStorageService.getResourceContentAsInputStream(resourceId)
        }
        assertThat(exception.message).isEqualTo("No resource found with id '$resourceId'")
    }
}
