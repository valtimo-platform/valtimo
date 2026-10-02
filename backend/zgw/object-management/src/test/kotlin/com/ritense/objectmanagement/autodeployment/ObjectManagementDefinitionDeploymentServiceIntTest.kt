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

package com.ritense.objectmanagement.autodeployment

import com.ritense.objectmanagement.BaseIntegrationTest
import com.ritense.objectmanagement.service.ObjectManagementService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.core.env.Environment
import org.springframework.transaction.annotation.Transactional
import java.util.UUID


@Transactional
internal class ObjectManagementDefinitionDeploymentServiceIntTest: BaseIntegrationTest() {

    @Autowired
    lateinit var objectManagementService: ObjectManagementService

    @Test
    fun getById() {
        val objectManagement = objectManagementService.findByObjectTypeId("4416cbef-dda3-41f4-bf5c-633f7fe14847")
        assertThat(objectManagement).isNotNull
        assertThat(objectManagement?.title).isEqualTo("My Object Management")
        assertThat(objectManagement?.id).isEqualTo(UUID.fromString("4f35c270-21f4-4e99-a8a1-6c4f9d5a6c5c"))
    }

    @Test
    fun `should use default value when placeholder is not resolvable`() {
        val service = deploymentService(mock())

        val result = service.invokeResolvePlaceholder("${'$'}{SOME_UNSET_PROPERTY:https://default.example.com}")

        assertThat(result).isEqualTo("https://default.example.com")
    }

    @Test
    fun `should prefer resolved value over default`() {
        val environment = mock<Environment>()
        whenever(environment.getProperty("MY_OBJECT_PROP")).thenReturn("https://actual.example.com")
        val service = deploymentService(environment)

        val result = service.invokeResolvePlaceholder("${'$'}{MY_OBJECT_PROP:https://default.example.com}")

        assertThat(result).isEqualTo("https://actual.example.com")
    }

    @Test
    fun `should resolve empty default to empty string`() {
        val service = deploymentService(mock())

        val result = service.invokeResolvePlaceholder("${'$'}{SOME_UNSET_PROPERTY:}")

        assertThat(result).isEqualTo("")
    }

    @Test
    fun `should return original value when placeholder not resolvable and no default`() {
        val service = deploymentService(mock())

        val result = service.invokeResolvePlaceholder("${'$'}{SOME_UNSET_PROPERTY}")

        assertThat(result).isEqualTo("${'$'}{SOME_UNSET_PROPERTY}")
    }

    private fun deploymentService(environment: Environment) = ObjectManagementDefinitionDeploymentService(
        mock(), mock(), mock(), mock(), mock(), environment
    )

    private fun ObjectManagementDefinitionDeploymentService.invokeResolvePlaceholder(value: String): String {
        val method = ObjectManagementDefinitionDeploymentService::class.java
            .getDeclaredMethod("getEnvVariableOrYamlPropertyOrDirectValue", String::class.java)
        method.isAccessible = true
        return method.invoke(this, value) as String
    }
}