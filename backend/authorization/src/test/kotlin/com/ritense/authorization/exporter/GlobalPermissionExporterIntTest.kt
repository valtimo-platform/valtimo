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

package com.ritense.authorization.exporter

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.authorization.Action
import com.ritense.authorization.BaseIntegrationTest
import com.ritense.authorization.deployment.PermissionDto
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.PermissionRepository
import com.ritense.authorization.role.Role
import com.ritense.authorization.role.RoleRepository
import com.ritense.exporter.request.ExportRequest
import com.ritense.exporter.request.GlobalExportRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

@Transactional
class GlobalPermissionExporterIntTest @Autowired constructor(
    private val globalPermissionExporter: GlobalPermissionExporter,
    private val permissionRepository: PermissionRepository,
    private val roleRepository: RoleRepository,
    private val objectMapper: ObjectMapper
) : BaseIntegrationTest() {

    @Test
    fun `should export permissions`() {
        val roleKey = "ROLE_PERMISSION_EXPORTER"
        val role = roleRepository.save(Role(key = roleKey))

        permissionRepository.save(
            Permission(
                resourceType = Role::class.java,
                actions = mutableListOf(Action<Any>(Action.VIEW)),
                conditionContainer = ConditionContainer(),
                role = role
            )
        )

        val result = globalPermissionExporter.export(GlobalExportRequest())

        assertThat(result.exportFiles).hasSize(1)
        val exportFile = result.exportFiles.single()
        assertThat(exportFile.path).isEqualTo("config/global/permission/global.permission.json")

        val permissions: List<PermissionDto> = objectMapper.readValue(exportFile.content)
        val exportedPermission = permissions.find { it.roleKey == roleKey }

        assertThat(exportedPermission).isNotNull
        assertThat(exportedPermission?.resourceType).isEqualTo(Role::class.java)
        assertThat(exportedPermission?.actions).contains(Action.VIEW)
    }

    @Test
    fun `should return empty result when no permissions exist`() {
        permissionRepository.deleteAll()

        val result = globalPermissionExporter.export(GlobalExportRequest())

        assertThat(result.exportFiles).isEmpty()
    }
}
