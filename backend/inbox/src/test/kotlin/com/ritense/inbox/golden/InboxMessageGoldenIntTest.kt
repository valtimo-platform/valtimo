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

package com.ritense.inbox.golden

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.inbox.BaseIntegrationTest
import com.ritense.inbox.TestEventHandler
import com.ritense.valtimo.test.golden.GoldenJson
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.cloud.function.context.FunctionCatalog
import org.springframework.cloud.function.context.catalog.SimpleFunctionRegistry.FunctionInvocationWrapper
import org.springframework.messaging.support.MessageBuilder

class InboxMessageGoldenIntTest @Autowired constructor(
    private val functionCatalog: FunctionCatalog,
    private val testEventHandler: TestEventHandler,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @Test
    fun `a text message from Rabbit reaches the inbox handlers unchanged`() {
        testEventHandler.receivedEvents.clear()
        val consumer = checkNotNull(functionCatalog.lookup<FunctionInvocationWrapper>("kotlinInboxCloudEventConsumer"))

        consumer.apply(
            MessageBuilder.withPayload(CLOUD_EVENT.toByteArray(Charsets.UTF_8))
                .setHeader("contentType", "text/plain")
                .build()
        )

        GoldenJson.assertMatchesGolden(
            javaClass,
            "received-event",
            objectMapper.writeValueAsString(testEventHandler.receivedEvents.single())
        )
    }

    companion object {
        private val CLOUD_EVENT = """
            {"specversion":"1.0","id":"3f1c2c9e-1b7a-4b44-9d0c-2f6a3c7f0a11","source":"valtimo","type":"com.ritense.golden.created",
            "datacontenttype":"application/json","time":"2026-11-26T10:15:30.123+01:00",
            "data":{"userId":"golden-user","roles":["ROLE_USER"],"resultType":"com.ritense.Golden","resultId":"golden-1",
            "result":{"name":"Zoë Çelik ✓","amount":12.50,"count":3,"active":true,"nothing":null,
            "nested":{"list":[1,"two",null,{"deep":"value"}]}}}}
        """.trimIndent().replace("\n", "")
    }
}
