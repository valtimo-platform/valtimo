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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.document.service.requireDocumentPermission
import com.ritense.resource.domain.ResourceId
import com.ritense.resource.domain.S3Resource
import com.ritense.resource.repository.S3ResourceRepository
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.utils.SecurityUtils
import org.springframework.security.access.AccessDeniedException
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional(readOnly = true)
class S3ResourceAccessService(
    private val s3ResourceRepository: S3ResourceRepository,
    private val documentService: DocumentService,
    private val authorizationService: AuthorizationService
) {

    fun requireReadAccess(resourceId: UUID) {
        requireReadAccess(findResource(resourceId))
    }

    fun requireDeleteAccess(resourceId: UUID) {
        requireDeleteAccess(findResource(resourceId))
    }

    fun requireReadAccess(resource: S3Resource) {
        val documentId = resource.documentId
        if (documentId != null) {
            val document = runWithoutAuthorization {
                documentService.findBy(JsonSchemaDocumentId.existingId(documentId))
            }.orElseThrow { AccessDeniedException("Access denied") } as JsonSchemaDocument
            authorizationService.requireDocumentPermission(document)
        } else {
            requireOwnerOrAdmin(resource)
        }
    }

    fun requireDeleteAccess(resource: S3Resource) {
        if (resource.documentId != null) {
            throw AccessDeniedException(
                "Resource is linked to a case. Remove it through the case document resource endpoint."
            )
        }
        requireOwnerOrAdmin(resource)
    }

    private fun findResource(id: UUID): S3Resource {
        return s3ResourceRepository.findById(ResourceId.existingId(id)).orElseThrow()
    }

    companion object {

        fun requireOwnerOrAdmin(resource: S3Resource) {
            val createdBy = resource.createdBy
            val allowed = if (createdBy != null) {
                createdBy == SecurityUtils.getCurrentUserLogin()
            } else {
                SecurityUtils.isCurrentUserInRole(ADMIN)
            }
            if (!allowed) {
                throw AccessDeniedException("Access denied")
            }
        }
    }
}
