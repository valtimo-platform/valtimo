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

package com.ritense.authorization.importer

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.authorization.AuthorizationSupportedHelper
import com.ritense.authorization.deployment.PermissionDto
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.PermissionRepository
import com.ritense.authorization.role.RoleRepository
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.GLOBAL_PERMISSION
import com.ritense.importer.ValtimoImportTypes.Companion.GLOBAL_ROLE
import org.springframework.transaction.annotation.Transactional

@Transactional
class GlobalPermissionImporter(
    private val objectMapper: ObjectMapper,
    private val permissionRepository: PermissionRepository,
    private val roleRepository: RoleRepository,
) : Importer {
    override fun type() = GLOBAL_PERMISSION

    override fun dependsOn(): Set<String> = setOf(GLOBAL_ROLE)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val permissionDtos = objectMapper.readValue<List<PermissionDto>>(request.content)

        if (existingPermissions == null) {
            existingPermissions = permissionRepository.findAll()
        }
        val incomingPermissions = permissionDtos.map { permissionDto ->
            AuthorizationSupportedHelper.checkSupported(permissionDto.resourceType)
            permissionDto.toPermission(roleRepository)
        }

        importedPermissions.addAll(incomingPermissions)

        val permissionsToSave = incomingPermissions.filter { incoming ->
            existingPermissions!!.none { existing -> existing == incoming }
        }

        permissionRepository.saveAll(permissionsToSave)
    }

    override fun afterImport(request: ImportRequest) {
        if (existingPermissions != null) {
            val permissionsToDelete = existingPermissions!!.filter { existing ->
                importedPermissions.none { imported -> imported == existing }
            }
            permissionRepository.deleteAll(permissionsToDelete)
            existingPermissions = null
            importedPermissions.clear()
        }
    }

    override fun partOfCaseDefinition(): Boolean = false

    companion object {
        val FILENAME_REGEX = """/global/permission/(?:.*/)?(.+)\.permission\.json""".toRegex()

        private var existingPermissions: List<Permission>? = null
        private val importedPermissions = mutableSetOf<Permission>()
    }
}