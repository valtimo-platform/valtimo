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

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus

internal class IsolatedValueResolverServiceTest {

    private val transactionManager = mock<PlatformTransactionManager>().apply {
        whenever(getTransaction(any())).thenReturn(SimpleTransactionStatus())
    }
    private val valueResolverService = mock<ValueResolverService>()
    private val service = IsolatedValueResolverService(transactionManager, valueResolverService)

    @Test
    fun `healthy page resolves every document once with no failures`() {
        whenever(valueResolverService.resolveValuesOrNullWithFailures("doc-1", listOf("ok:a")))
            .thenReturn(ValueResolverResult(mapOf("ok:a" to "value-a"), emptySet()))
        whenever(valueResolverService.resolveValuesOrNullWithFailures("doc-2", listOf("ok:c")))
            .thenReturn(ValueResolverResult(mapOf("ok:c" to "value-c"), emptySet()))

        val result = service.resolveValuesOrNullIsolated(
            mapOf("doc-1" to listOf("ok:a"), "doc-2" to listOf("ok:c"))
        )

        assertThat(result.getValue("doc-1").values).containsEntry("ok:a", "value-a")
        assertThat(result.getValue("doc-1").failedKeys).isEmpty()
        assertThat(result.getValue("doc-2").values).containsEntry("ok:c", "value-c")
        assertThat(result.getValue("doc-2").failedKeys).isEmpty()
        // fallback not taken: each document resolved exactly once (page), never re-resolved per row
        verify(valueResolverService, times(1)).resolveValuesOrNullWithFailures("doc-1", listOf("ok:a"))
        verify(valueResolverService, times(1)).resolveValuesOrNullWithFailures("doc-2", listOf("ok:c"))
    }

    @Test
    fun `poisoned page falls back per row and nulls the failing row's columns`() {
        whenever(valueResolverService.resolveValuesOrNullWithFailures("doc-ok", listOf("ok:a")))
            .thenReturn(ValueResolverResult(mapOf("ok:a" to "value-a"), emptySet()))
        whenever(valueResolverService.resolveValuesOrNullWithFailures("doc-bad", listOf("bad:b", "bad:c")))
            .thenThrow(IllegalStateException("tx poisoned"))

        val result = service.resolveValuesOrNullIsolated(
            mapOf("doc-ok" to listOf("ok:a"), "doc-bad" to listOf("bad:b", "bad:c"))
        )

        // healthy row still resolves in the per-row fallback
        assertThat(result.getValue("doc-ok").values).containsEntry("ok:a", "value-a")
        assertThat(result.getValue("doc-ok").failedKeys).isEmpty()
        // failing row: every column null, all its paths reported failed
        assertThat(result.getValue("doc-bad").values)
            .containsEntry("bad:b", null)
            .containsEntry("bad:c", null)
        assertThat(result.getValue("doc-bad").failedKeys).containsExactlyInAnyOrder("bad:b", "bad:c")
    }
}
