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
import com.ritense.authorization.BaseIntegrationTest
import com.ritense.authorization.role.Role
import com.ritense.authorization.role.RoleRepository
import com.ritense.exporter.request.ExportRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

@Transactional
class GlobalRoleExporterIntTest @Autowired constructor(
    private val globalRoleExporter: GlobalRoleExporter,
    private val roleRepository: RoleRepository,
    private val objectMapper: ObjectMapper
) : BaseIntegrationTest() {

    @Test
    fun `should export roles`() {
        val roleKey = "ROLE_TEST_EXPORTER"
        roleRepository.save(Role(key = roleKey))

        val result = globalRoleExporter.export(object : ExportRequest() {
            override fun equals(other: Any?): Boolean = true
            override fun hashCode(): Int = 0
        })

        assertThat(result.exportFiles).hasSize(1)
        val exportFile = result.exportFiles.single()
        assertThat(exportFile.path).isEqualTo("global/role/global.role.json")

        val roleKeys: List<String> = objectMapper.readValue(exportFile.content)
        assertThat(roleKeys).contains(roleKey)
    }
}
