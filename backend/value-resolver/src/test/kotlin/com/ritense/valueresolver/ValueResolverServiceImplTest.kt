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

package com.ritense.valueresolver

import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.util.function.Function

internal class ValueResolverServiceImplTest {

    private val resolverService = ValueResolverServiceImpl(
        listOf(
            StaticValueResolverFactory("ok") { "value-of-$it" },
            StaticValueResolverFactory("bad") { throw IllegalStateException("boom") },
            DependentValueResolverFactory(),
        )
    )

    @Test
    fun `resolveValuesOrNull should resolve failing prefix group to null and other groups normally`() {
        val result = resolverService.resolveValuesOrNull("doc-id", listOf("ok:a", "bad:b", "bad:c", "ok:d"))

        assertThat(result).containsEntry("bad:b", null)
        assertThat(result).containsEntry("bad:c", null)
        assertThat(result).containsEntry("ok:a", "value-of-a")
        assertThat(result).containsEntry("ok:d", "value-of-d")
    }

    @Test
    fun `resolveValuesOrNull should resolve nested dependency on failed group to null without throwing`() {
        val result = resolverService.resolveValuesOrNull("doc-id", listOf("dep:x?src=bad:y", "ok:a"))

        assertThat(result).containsEntry("bad:y", null)
        assertThat(result).containsEntry("dep:x?src=bad:y", null)
        assertThat(result).containsEntry("ok:a", "value-of-a")
    }

    @Test
    fun `resolveValuesOrNull should resolve nested dependency normally when dependency succeeds`() {
        val result = resolverService.resolveValuesOrNull("doc-id", listOf("dep:x?src=ok:y"))

        assertThat(result).containsEntry("dep:x?src=ok:y", "x-from-value-of-y")
    }

    @Test
    fun `resolveValues should still throw when a resolver fails`() {
        assertThrows<IllegalStateException> {
            resolverService.resolveValues("doc-id", listOf("ok:a", "bad:b"))
        }
    }

    @Test
    fun `validateValues with caseDefinitionId uses the versioned validator`() {
        val received = mutableListOf<CaseDefinitionId>()
        val service = ValueResolverServiceImpl(listOf(VersionedValidatorFactory(received)))
        val caseDefinitionId = CaseDefinitionId("some-case", "1.1.0")

        service.validateValues(caseDefinitionId, listOf("ver:a"))

        assertThat(received).containsExactly(caseDefinitionId)
    }

    @Test
    fun `validateValues with caseDefinitionId falls back to the key validator`() {
        val received = mutableListOf<String>()
        val service = ValueResolverServiceImpl(listOf(KeyValidatorFactory(received)))

        service.validateValues(CaseDefinitionId("some-case", "1.1.0"), listOf("key:a"))

        assertThat(received).containsExactly("some-case")
    }

    @Test
    fun `validateValues with caseDefinitionId propagates validation failure`() {
        val service = ValueResolverServiceImpl(listOf(FailingValidatorFactory()))

        val exception = assertThrows<IllegalArgumentException> {
            service.validateValues(CaseDefinitionId("some-case", "1.1.0"), listOf("fail:a"))
        }

        assertThat(exception).hasMessage("invalid a")
    }

    private class VersionedValidatorFactory(
        private val received: MutableList<CaseDefinitionId>
    ) : ValueResolverFactory {
        override fun supportedPrefix() = "ver"

        override fun createResolver(properties: Map<String, Any>): Function<String, Any?> = Function { it }

        override fun createValidator(caseDefinitionId: CaseDefinitionId): Function<String, Unit> {
            received.add(caseDefinitionId)
            return Function { }
        }
    }

    private class KeyValidatorFactory(
        private val received: MutableList<String>
    ) : ValueResolverFactory {
        override fun supportedPrefix() = "key"

        override fun createResolver(properties: Map<String, Any>): Function<String, Any?> = Function { it }

        override fun createValidator(documentDefinitionName: String): Function<String, Unit> {
            received.add(documentDefinitionName)
            return Function { }
        }
    }

    private class FailingValidatorFactory : ValueResolverFactory {
        override fun supportedPrefix() = "fail"

        override fun createResolver(properties: Map<String, Any>): Function<String, Any?> = Function { it }

        override fun createValidator(caseDefinitionId: CaseDefinitionId): Function<String, Unit> =
            Function { throw IllegalArgumentException("invalid $it") }
    }

    private class StaticValueResolverFactory(
        private val prefix: String,
        private val resolve: (String) -> Any?
    ) : ValueResolverFactory {
        override fun supportedPrefix() = prefix

        override fun createResolver(properties: Map<String, Any>): Function<String, Any?> =
            Function { requestedValue -> resolve(requestedValue) }
    }

    private class DependentValueResolverFactory : ValueResolverFactory {
        override fun supportedPrefix() = "dep"

        override fun createResolver(properties: Map<String, Any>): Function<String, Any?> {
            val source = properties["src"] ?: throw IllegalStateException("src missing")
            return Function { requestedValue -> "$requestedValue-from-$source" }
        }
    }
}
