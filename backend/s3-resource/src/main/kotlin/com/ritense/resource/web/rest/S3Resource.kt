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

package com.ritense.resource.web.rest

import com.ritense.resource.service.S3Service
import com.ritense.resource.web.ObjectUrlDTO
import com.ritense.resource.web.ResourceDTO
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import java.util.UUID

class S3Resource(
    private val s3Service: S3Service
) : ResourceResource {

    @GetMapping(value = ["/v1/resource/pre-signed-url/{fileName}"], produces = ["text/plain;charset=UTF-8"])
    fun generatePreSignedPutObjectUrlForFileName(@PathVariable(name = "fileName") fileName: String): ResponseEntity<String> {
        return ResponseEntity.ok(s3Service.generatePreSignedPutObjectUrl(fileName).toString())
    }

    override fun get(resourceId: String): ResponseEntity<ObjectUrlDTO> {
        return ResponseEntity.ok(s3Service.getResourceUrl(UUID.fromString(resourceId)))
    }

    override fun getContent(resourceId: String): ResponseEntity<ByteArray> {
        return ResponseEntity.ok(s3Service.getResourceContent(UUID.fromString(resourceId)).content)
    }

    override fun register(resourceDTO: ResourceDTO): ResponseEntity<ResourceDTO> {
        return ResponseEntity.ok(s3Service.registerResource(resourceDTO))
    }

    override fun delete(resourceId: String): ResponseEntity<Void> {
        s3Service.removeResource(UUID.fromString(resourceId))
        return ResponseEntity.noContent().build()
    }

}