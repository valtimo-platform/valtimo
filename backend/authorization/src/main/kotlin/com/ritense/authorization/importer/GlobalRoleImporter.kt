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
import com.ritense.authorization.role.Role
import com.ritense.authorization.role.RoleRepository
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.GLOBAL_ROLE
import org.springframework.transaction.annotation.Transactional

@Transactional
class GlobalRoleImporter(
    private val objectMapper: ObjectMapper,
    private val roleRepository: RoleRepository,
) : Importer {
    override fun type() = GLOBAL_ROLE

    override fun dependsOn(): Set<String> = emptySet()

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val roleKeys = objectMapper.readValue<List<String>>(request.content).toSet()

        if (existingRoles == null) {
            existingRoles = roleRepository.findAll()
        }

        importedRoleKeys.addAll(roleKeys)

        val newRoles = roleKeys
            .filter { key -> existingRoles!!.none { it.key == key } }
            .map { key -> Role(key = key) }

        roleRepository.saveAll(newRoles)
    }

    override fun afterImport(request: ImportRequest) {
        if (existingRoles != null) {
            val rolesToDelete = existingRoles!!.filter { it.key !in importedRoleKeys }
            roleRepository.deleteAll(rolesToDelete)
            existingRoles = null
            importedRoleKeys.clear()
        }
    }

    override fun partOfCaseDefinition(): Boolean = false

    companion object {
        val FILENAME_REGEX = """/global/role/(?:.*/)?(.+)\.role\.json""".toRegex()

        private var existingRoles: List<Role>? = null
        private val importedRoleKeys = mutableSetOf<String>()
    }
}
