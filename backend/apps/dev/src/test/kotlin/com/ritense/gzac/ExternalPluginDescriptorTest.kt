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

package com.ritense.gzac

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ritense.externalplugin.autodeployment.ExternalPluginDeploymentDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.core.io.Resource
import org.springframework.core.io.support.PathMatchingResourcePatternResolver

class ExternalPluginDescriptorTest {
    private val objectMapper = ObjectMapper().registerKotlinModule()

    @Test
    fun `every shipped external plugin descriptor deserializes`() {
        val descriptors = descriptors()
        assertThat(descriptors).isNotEmpty()

        descriptors.forEach { resource ->
            val deployment = objectMapper.readValue(resource.inputStream, ExternalPluginDeploymentDto::class.java)

            assertThat(deployment.integrations)
                .describedAs("integrations in %s", resource.filename)
                .isNotEmpty()
            deployment.integrations.forEach { integration ->
                assertThat(integration.name).isNotBlank()
                assertThat(integration.baseUrl).isNotBlank()
                assertThat(integration.gzacCallbackBaseUrl).isNotBlank()
                integration.configurations.forEach { configuration ->
                    assertThat(configuration.pluginId).isNotBlank()
                    assertThat(configuration.pluginVersion).isNotBlank()
                }
            }
        }
    }

    @Test
    fun `descriptor ids are unique across every shipped descriptor`() {
        val deployments = descriptors().map {
            objectMapper.readValue(it.inputStream, ExternalPluginDeploymentDto::class.java)
        }
        val integrations = deployments.flatMap { it.integrations }

        assertThat(integrations.map { it.id }).doesNotHaveDuplicates()
        assertThat(integrations.flatMap { it.configurations }.map { it.id }).doesNotHaveDuplicates()
        assertThat(integrations.map { it.baseUrl.trimEnd('/') }).doesNotHaveDuplicates()
    }

    private fun descriptors(): List<Resource> =
        PathMatchingResourcePatternResolver(javaClass.classLoader)
            .getResources(DESCRIPTOR_PATH)
            .toList()

    private companion object {
        const val DESCRIPTOR_PATH = "classpath*:config/global/external-plugin/**/*.externalplugin.json"
    }
}
