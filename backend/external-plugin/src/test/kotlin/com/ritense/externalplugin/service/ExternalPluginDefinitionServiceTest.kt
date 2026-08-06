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

package com.ritense.externalplugin.service

import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

class ExternalPluginDefinitionServiceTest {

    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var service: ExternalPluginDefinitionService

    private val definition = ExternalPluginDefinition(
        id = UUID.randomUUID(),
        pluginId = "case-summary",
        version = "1.0.0",
        hostId = UUID.randomUUID(),
        baseUrl = "https://plugin-host.example.com/plugins/case-summary",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
        contentHash = "sha256:accepted",
        pendingContentHash = "sha256:changed",
    )

    @BeforeEach
    fun setUp() {
        definitionRepository = mock()
        whenever(definitionRepository.findById(definition.id)).thenReturn(Optional.of(definition))
        whenever(definitionRepository.save(any<ExternalPluginDefinition>())).thenAnswer { it.getArgument(0) }
        service = ExternalPluginDefinitionService(definitionRepository)
    }

    @Test
    fun `acceptContent re-pins the pending hash and clears the flag`() {
        val accepted = service.acceptContent(definition.id, "sha256:changed")

        assertThat(accepted.contentHash).isEqualTo("sha256:changed")
        assertThat(accepted.pendingContentHash).isNull()
        assertThat(accepted.requiresReacceptance).isFalse()
        verify(definitionRepository).save(definition)
    }

    @Test
    fun `acceptContent rejects a stale hash - the package changed again since the admin reviewed it`() {
        assertThatThrownBy { service.acceptContent(definition.id, "sha256:stale") }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("changed again")

        assertThat(definition.contentHash).isEqualTo("sha256:accepted")
        assertThat(definition.pendingContentHash).isEqualTo("sha256:changed")
        verify(definitionRepository, never()).save(any())
    }

    @Test
    fun `acceptContent rejects a definition without a pending change`() {
        definition.pendingContentHash = null

        assertThatThrownBy { service.acceptContent(definition.id, "sha256:whatever") }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("no pending content change")
        verify(definitionRepository, never()).save(any())
    }
}
