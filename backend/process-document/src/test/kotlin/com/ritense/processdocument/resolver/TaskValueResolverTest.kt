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

package com.ritense.processdocument.resolver

import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.DOCUMENT_ID
import com.ritense.valueresolver.exception.ValueResolverValidationException
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.operaton.bpm.engine.delegate.DelegateTask
import java.util.UUID

internal class TaskValueResolverTest {

    private val resolver = TaskValueResolver()

    @Test
    fun `should still validate and list task paths`() {
        resolver.createValidator("my-document-definition").apply("assignee")

        assertThat(resolver.getResolvableKeyOptions(CaseDefinitionId.of("my-case", "1.0.0")).map { it.path })
            .contains("task:assignee")
    }

    @Test
    fun `should reject an unknown task column`() {
        assertThatThrownBy { resolver.createValidator("my-document-definition").apply("nonexistent") }
            .isInstanceOf(ValueResolverValidationException::class.java)
            .hasMessageContaining("Unknown task column with name: nonexistent")
    }

    @Test
    fun `should refuse to resolve against a document with an explanation`() {
        assertThatThrownBy { resolver.createResolver(UUID.randomUUID().toString()) }
            .isInstanceOf(UnsupportedOperationException::class.java)
            .hasMessageContaining("no single task to read from")
    }

    @Test
    fun `should refuse to resolve against a process instance with an explanation`() {
        assertThatThrownBy { resolver.createResolver(UUID.randomUUID().toString(), mock<DelegateTask>()) }
            .isInstanceOf(UnsupportedOperationException::class.java)
            .hasMessageContaining("no single task to read from")
    }

    @Test
    fun `should refuse to resolve from a property map with an explanation`() {
        assertThatThrownBy { resolver.createResolver(mapOf(DOCUMENT_ID to UUID.randomUUID().toString())) }
            .isInstanceOf(UnsupportedOperationException::class.java)
            .hasMessageContaining("no single task to read from")
    }
}
