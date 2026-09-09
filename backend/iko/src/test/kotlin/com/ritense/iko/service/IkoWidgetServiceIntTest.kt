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

package com.ritense.iko.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.iko.BaseIntegrationTest
import com.ritense.iko.client.IkoClient
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.IKO_VIEW_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.TAB_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.WIDGET_KEY
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.transaction.support.TransactionSynchronizationManager

class IkoWidgetServiceIntTest @Autowired constructor(
    private val ikoWidgetService: IkoWidgetService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @MockitoBean
    lateinit var ikoClient: IkoClient

    @Test
    fun `should not hold a database transaction while fetching widget data`() {
        var transactionActive: Boolean? = null
        whenever(ikoClient.getByEndpointId(any(), any(), any(), any(), any(), any())).thenAnswer {
            transactionActive = TransactionSynchronizationManager.isActualTransactionActive()
            objectMapper.createObjectNode()
        }

        // Same properties the REST layer builds up
        val properties = mapOf(
            ID to "999990123",
            IKO_VIEW_KEY to "klant",
            TAB_KEY to "general",
            WIDGET_KEY to "klant",
        )

        runWithoutAuthorization {
            ikoWidgetService.getWidgetData("klant", "general", "klant", properties)
        }

        assertNotNull(transactionActive, "IKO server was never called — test no longer covers the fetch")
        assertFalse(
            transactionActive!!,
            "A transaction was open during the IKO call, so the pooled connection is held for the whole request"
        )
    }
}
