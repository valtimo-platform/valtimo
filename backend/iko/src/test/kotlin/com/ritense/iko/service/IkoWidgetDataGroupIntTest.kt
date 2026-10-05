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
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.NO_PAGE_SIZE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.TAB_KEY
import com.ritense.widget.service.NO_DATA_GROUP_ID
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.bean.override.mockito.MockitoBean

class IkoWidgetDataGroupIntTest @Autowired constructor(
    private val ikoWidgetService: IkoWidgetService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @MockitoBean
    lateinit var ikoClient: IkoClient

    @Test
    fun `should serve every field widget of a group with one upstream call`(): Unit = runWithoutAuthorization {
        mockIkoServer()

        val group = ikoWidgetService.getWidgetDataGroup(IKO_VIEW, TAB, fieldGroupId(), properties())

        assertThat(group).containsOnlyKeys("klant", "verblijfplaats")
        group!!.values.forEach { envelope -> assertThat(envelope.error).isNull() }
        verify(ikoClient, times(1)).getByEndpointId(any(), any(), any(), any(), any(), any())
    }

    @Test
    fun `should expose the resolved data of every widget in the group`(): Unit = runWithoutAuthorization {
        mockIkoServer()

        val group = ikoWidgetService.getWidgetDataGroup(IKO_VIEW, TAB, fieldGroupId(), properties())!!

        @Suppress("UNCHECKED_CAST")
        val klant = group["klant"]!!.data as Map<String, Any?>

        @Suppress("UNCHECKED_CAST")
        val verblijfplaats = group["verblijfplaats"]!!.data as Map<String, Any?>

        assertThat(klant).containsEntry("naam", "Jan Jansen")
        assertThat(verblijfplaats).containsEntry("postcode", "1234AB")
    }

    @Test
    fun `should give each container widget its own group`(): Unit = runWithoutAuthorization {
        val groupIds = dataGroupIds()

        assertThat(groupIds["klant"]).isEqualTo(groupIds["verblijfplaats"])
        assertThat(groupIds.values.toSet()).hasSize(CONTAINER_WIDGETS + 1)
        assertThat(groupIds.values).doesNotContain(NO_DATA_GROUP_ID)
    }

    @Test
    fun `should return null for an unknown group`(): Unit = runWithoutAuthorization {
        assertThat(ikoWidgetService.getWidgetDataGroup(IKO_VIEW, TAB, "unknown", properties())).isNull()
    }

    private fun dataGroupIds(): Map<String, String> {
        val widgets = ikoWidgetService.findAllByTabKey(IKO_VIEW, TAB)
        return ikoWidgetService.dataGroupIds(IKO_VIEW, TAB, widgets)
    }

    private fun fieldGroupId(): String = dataGroupIds()["klant"]!!

    private fun properties() = mapOf(
        ID to "999990123",
        IKO_VIEW_KEY to IKO_VIEW,
        TAB_KEY to TAB,
        NO_PAGE_SIZE to true,
    )

    private fun mockIkoServer() {
        whenever(ikoClient.getByEndpointId(any(), any(), any(), any(), any(), any())).thenReturn(
            objectMapper.readTree(
                """
                {
                  "naam": { "volledigeNaam": "Jan Jansen" },
                  "burgerservicenummer": "999990123",
                  "verblijfplaats": { "verblijfadres": { "postcode": "1234AB" } }
                }
                """.trimIndent()
            )
        )
    }

    private companion object {
        const val IKO_VIEW = "klant"
        const val TAB = "general"

        /** nationaliteiten, partners, lopendeZaken, bomen. */
        const val CONTAINER_WIDGETS = 4
    }
}
