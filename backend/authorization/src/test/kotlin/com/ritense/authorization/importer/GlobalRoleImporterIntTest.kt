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

import com.ritense.authorization.BaseIntegrationTest
import com.ritense.authorization.permission.PermissionRepository
import com.ritense.authorization.role.Role
import com.ritense.authorization.role.RoleRepository
import com.ritense.importer.ImportRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

@Transactional
class GlobalRoleImporterIntTest @Autowired constructor(
    private val globalRoleImporter: GlobalRoleImporter,
    private val roleRepository: RoleRepository
) : BaseIntegrationTest() {

    @Autowired
    private lateinit var permissionRepository: PermissionRepository

    @Test
    fun `should import roles`() {
        val allRoleKeys = roleRepository.findAll().joinToString { "\"${it.key}\"" }
        val roleKey = "ROLE_TEST_IMPORTER"
        val json = """
            ["$roleKey", $allRoleKeys]
        """.trimIndent()

        val request = ImportRequest(
            fileName = "/global/role/test.role.json",
            content = json.toByteArray()
        )

        globalRoleImporter.import(request)

        val role = roleRepository.findByKey(roleKey)
        assertThat(role).isNotNull
        assertThat(role?.key).isEqualTo(roleKey)
    }

    @Test
    fun `should delete roles no longer present in import after multiple files`() {
        // Clear all roles and permissions to avoid constraint violations
        permissionRepository.deleteAll()
        roleRepository.deleteAll()

        val roleKeyToKeep1 = "ROLE_KEEP_1"
        val roleKeyToKeep2 = "ROLE_KEEP_2"
        val roleKeyToDelete = "ROLE_DELETE"

        roleRepository.saveAll(listOf(
            Role(key = roleKeyToKeep2),
            Role(key = roleKeyToDelete)
        ))

        // First import (file 1)
        val request1 = ImportRequest(
            fileName = "/global/role/file1.role.json",
            content = "[\"$roleKeyToKeep1\"]".toByteArray()
        )
        globalRoleImporter.import(request1)

        // Second import (file 2)
        val request2 = ImportRequest(
            fileName = "/global/role/file2.role.json",
            content = "[\"$roleKeyToKeep2\"]".toByteArray()
        )
        globalRoleImporter.import(request2)

        // After all imports
        globalRoleImporter.afterImport(request2)

        assertThat(roleRepository.findByKey(roleKeyToKeep1)).isNotNull
        assertThat(roleRepository.findByKey(roleKeyToKeep2)).isNotNull
        assertThat(roleRepository.findByKey(roleKeyToDelete)).isNull()
    }

    @Test
    fun `should support correct file pattern`() {
        assertThat(globalRoleImporter.supports("/global/role/global.role.json")).isTrue()
        assertThat(globalRoleImporter.supports("/global/role/sub/my.role.json")).isTrue()
        assertThat(globalRoleImporter.supports("/global/permission/global.permission.json")).isFalse()
    }
}
