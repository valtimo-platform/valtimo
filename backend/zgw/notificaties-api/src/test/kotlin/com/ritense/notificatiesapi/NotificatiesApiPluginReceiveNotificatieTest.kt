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

package com.ritense.notificatiesapi

import com.ritense.notificatiesapi.client.NotificatiesApiClient
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.processlink.domain.ActivityTypeWithEventName
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import java.util.UUID

class NotificatiesApiPluginReceiveNotificatieTest {

    @Test
    fun `receiveNotificatie should not throw`() {
        val client: NotificatiesApiClient = mock()
        val plugin = NotificatiesApiPlugin(
            PluginConfigurationId(UUID.randomUUID()),
            client,
        )

        assertDoesNotThrow {
            plugin.receiveNotificatie("zaken", "create", mapOf("key" to "value"))
        }
    }

    @Test
    fun `receiveNotificatie should accept null parameters`() {
        val client: NotificatiesApiClient = mock()
        val plugin = NotificatiesApiPlugin(
            PluginConfigurationId(UUID.randomUUID()),
            client,
        )

        assertDoesNotThrow {
            plugin.receiveNotificatie(null, null, null)
        }
    }

    @Test
    fun `receiveNotificatie action should support expected activity types`() {
        val action = NotificatiesApiPlugin::class.java
            .getDeclaredMethod("receiveNotificatie", String::class.java, String::class.java, Map::class.java)
            .getAnnotation(com.ritense.plugin.annotation.PluginAction::class.java)

        val activityTypes = action.activityTypes.toSet()

        assert(activityTypes.contains(ActivityTypeWithEventName.RECEIVE_TASK_END))
        assert(activityTypes.contains(ActivityTypeWithEventName.INTERMEDIATE_CATCH_EVENT_END))
        assert(activityTypes.contains(ActivityTypeWithEventName.MESSAGE_START_EVENT_START))
    }
}
