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

import com.ritense.authorization.Action
import com.ritense.authorization.BaseIntegrationTest
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.PermissionRepository
import com.ritense.authorization.role.Role
import com.ritense.authorization.role.RoleRepository
import com.ritense.authorization.testimpl.TestEntity
import com.ritense.importer.ImportRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import kotlin.jvm.java

@Transactional
class GlobalPermissionImporterIntTest @Autowired constructor(
    private val globalPermissionImporter: GlobalPermissionImporter,
    private val permissionRepository: PermissionRepository,
    private val roleRepository: RoleRepository
) : BaseIntegrationTest() {

    @Test
    fun `should import permissions`() {
        val roleKey = "ROLE_PERMISSION_IMPORTER"
        roleRepository.save(Role(key = roleKey))

        val json = """
            [
                {
                    "resourceType": "com.ritense.authorization.testimpl.TestEntity",
                    "actions": ["${Action.VIEW}"],
                    "roleKey": "$roleKey"
                }
            ]
        """.trimIndent()

        val request = ImportRequest(
            fileName = "/global/permission/test.permission.json",
            content = json.toByteArray()
        )

        globalPermissionImporter.import(request)

        val permissions = permissionRepository.findAll()
        val importedPermission = permissions.find { it.role.key == roleKey }

        assertThat(importedPermission).isNotNull
        assertThat(importedPermission?.resourceType).isEqualTo(TestEntity::class.java)
        assertThat(importedPermission?.actions?.map { it.key }).contains(Action.VIEW)
    }

    @Test
    fun `should support correct file pattern`() {
        assertThat(globalPermissionImporter.supports("/global/permission/global.permission.json")).isTrue()
        assertThat(globalPermissionImporter.supports("/global/permission/sub/my.permission.json")).isTrue()
        assertThat(globalPermissionImporter.supports("/global/role/global.role.json")).isFalse()
    }

    @Test
    fun `should delete permissions no longer present in import after multiple files`() {
        val roleKeyToKeep1 = "ROLE_KEEP_1"
        val roleToKeep1 = roleRepository.save(Role(key = roleKeyToKeep1))

        val roleKeyToKeep2 = "ROLE_KEEP_2"
        val roleToKeep2 = roleRepository.save(Role(key = roleKeyToKeep2))

        val roleKeyToDelete = "ROLE_DELETE"
        val roleToDelete = roleRepository.save(Role(key = roleKeyToDelete))

        // Existing permissions
        permissionRepository.saveAll(
            listOf(
                Permission(
                    resourceType = TestEntity::class.java,
                    actions = mutableListOf(Action<Any>(Action.VIEW)),
                    conditionContainer = ConditionContainer(),
                    role = roleToKeep2
                ),
                Permission(
                    resourceType = TestEntity::class.java,
                    actions = mutableListOf(Action<Any>(Action.VIEW)),
                    conditionContainer = ConditionContainer(),
                    role = roleToDelete
                )
            )
        )

        // First import (file 1)
        val request1 = ImportRequest(
            fileName = "/global/permission/file1.permission.json",
            content = """
                [
                    {
                        "resourceType": "com.ritense.authorization.testimpl.TestEntity",
                        "actions": ["${Action.VIEW}"],
                        "roleKey": "$roleKeyToKeep1"
                    }
                ]
            """.toByteArray()
        )
        globalPermissionImporter.import(request1)

        // Second import (file 2)
        val request2 = ImportRequest(
            fileName = "/global/permission/file2.permission.json",
            content = """
                [
                    {
                        "resourceType": "com.ritense.authorization.testimpl.TestEntity",
                        "actions": ["${Action.VIEW}"],
                        "roleKey": "$roleKeyToKeep2"
                    }
                ]
            """.toByteArray()
        )
        globalPermissionImporter.import(request2)

        // After all imports
        globalPermissionImporter.afterImport(request2)

        val permissions = permissionRepository.findAll()
        assertThat(permissions.count { it.role.key == roleKeyToKeep1 }).isEqualTo(1)
        assertThat(permissions.count { it.role.key == roleKeyToKeep2 }).isEqualTo(1)
        assertThat(permissions.count { it.role.key == roleKeyToDelete }).isEqualTo(0)
    }
}
