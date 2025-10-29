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

package com.ritense.outbox

import com.ritense.outbox.domain.BaseEvent
import io.cloudevents.CloudEvent
import io.cloudevents.core.builder.CloudEventBuilder
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.net.URI
import java.time.OffsetDateTime
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.function.Supplier

class LocalOutboxServiceTest {

    private val publishedEvents = CopyOnWriteArrayList<CloudEvent>()
    private val applicationEventPublisher = ApplicationEventPublisher { event ->
        if (event is CloudEvent) {
            publishedEvents.add(event)
        }
    }
    private val cloudEventFactory = mock<CloudEventFactory>()
    private lateinit var localOutboxService: LocalOutboxService

    @BeforeEach
    fun setUp() {
        publishedEvents.clear()
        localOutboxService = LocalOutboxService(cloudEventFactory, applicationEventPublisher)
    }

    @AfterEach
    fun tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization()
        }
        TransactionSynchronizationManager.setActualTransactionActive(false)
    }

    @Test
    fun `should defer publishing until transaction commits`() {
        val cloudEvent = testCloudEvent()
        whenever(cloudEventFactory.create(any())).thenReturn(cloudEvent)

        TransactionSynchronizationManager.initSynchronization()
        TransactionSynchronizationManager.setActualTransactionActive(true)

        localOutboxService.send(Supplier { testEvent() })

        assertThat(publishedEvents).isEmpty()

        TransactionSynchronizationManager.getSynchronizations().forEach { it.afterCommit() }
        TransactionSynchronizationManager.clearSynchronization()
        TransactionSynchronizationManager.setActualTransactionActive(false)

        assertThat(publishedEvents).containsExactly(cloudEvent)
    }

    @Test
    fun `should publish immediately when no transaction is active`() {
        val cloudEvent = testCloudEvent()
        whenever(cloudEventFactory.create(any())).thenReturn(cloudEvent)

        localOutboxService.send(Supplier { testEvent() })

        assertThat(publishedEvents).containsExactly(cloudEvent)
    }

    private fun testEvent(): BaseEvent = object : BaseEvent(
        id = UUID.randomUUID(),
        type = "local.test",
        resultType = "resultType",
        resultId = "resultId",
        result = null
    ) {}

    private fun testCloudEvent(): CloudEvent {
        return CloudEventBuilder.v1()
            .withId(UUID.randomUUID().toString())
            .withSource(URI.create("application"))
            .withType("local.test")
            .withTime(OffsetDateTime.now())
            .build()
    }
}
