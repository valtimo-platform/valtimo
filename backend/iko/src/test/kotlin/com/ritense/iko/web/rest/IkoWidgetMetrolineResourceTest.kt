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

package com.ritense.iko.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.iko.service.IkoWidgetService
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.widget.metroline.MetrolineItem
import com.ritense.widget.metroline.MetrolineOrientation
import com.ritense.widget.metroline.MetrolineWidget
import com.ritense.widget.metroline.MetrolineWidgetDto
import com.ritense.widget.metroline.MetrolineWidgetProperties
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.data.web.PageableHandlerMethodArgumentResolver
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Transactional
internal class IkoWidgetMetrolineResourceTest {

    private lateinit var widgetMockMvc: MockMvc
    private lateinit var managementMockMvc: MockMvc
    private lateinit var resource: IkoWidgetResource
    private lateinit var managementResource: IkoWidgetManagementResource
    private lateinit var service: IkoWidgetService
    private lateinit var objectMapper: ObjectMapper

    @BeforeEach
    fun init() {
        objectMapper = MapperSingleton.get().copy().apply {
            registerSubtypes(MetrolineWidget::class.java)
            registerSubtypes(MetrolineWidgetDto::class.java)
        }

        service = mock()
        resource = IkoWidgetResource(service)
        managementResource = IkoWidgetManagementResource(service)
        widgetMockMvc = MockMvcBuilders.standaloneSetup(resource)
            .setCustomArgumentResolvers(PageableHandlerMethodArgumentResolver())
            .setMessageConverters(MappingJackson2HttpMessageConverter(objectMapper))
            .build()
        managementMockMvc = MockMvcBuilders.standaloneSetup(managementResource)
            .setCustomArgumentResolvers(PageableHandlerMethodArgumentResolver())
            .setMessageConverters(MappingJackson2HttpMessageConverter(objectMapper))
            .build()
    }

    @Test
    fun `should serialize metroline widget data as a list of items`() {
        whenever(service.getWidgetData(eq("demo"), eq("general"), eq("status_verloop"), any()))
            .thenReturn(listOf(
                MetrolineItem(
                    title = "Aanvraag ontvangen",
                    label = "De aanvraag is binnengekomen",
                    completed = LocalDateTime.parse("2025-08-15T10:30:00"),
                ),
                MetrolineItem(
                    title = "Besluit",
                    label = null,
                    completed = null,
                ),
            ))

        widgetMockMvc.perform(
            get(
                "/api/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget/{widgetKey}/data?id=demo1",
                "demo",
                "general",
                "status_verloop"
            )
        )
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].title").value("Aanvraag ontvangen"))
            .andExpect(jsonPath("$[0].label").value("De aanvraag is binnengekomen"))
            .andExpect(jsonPath("$[0].completed").value("2025-08-15T10:30:00.000Z"))
            .andExpect(jsonPath("$[1].title").value("Besluit"))
            .andExpect(jsonPath("$[1].label").isEmpty)
            .andExpect(jsonPath("$[1].completed").isEmpty)
    }

    @Test
    fun `should serialize the configured metroline widget in the tab listing`() {
        whenever(service.findAllByTabKeyFilteredByDisplayConditions("demo", "general"))
            .thenReturn(listOf(metrolineWidget()))

        widgetMockMvc.perform(
            get(
                "/api/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget",
                "demo",
                "general"
            )
        )
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].type").value("metroline"))
            .andExpect(jsonPath("$[0].key").value("status_verloop"))
            .andExpect(jsonPath("$[0].title").value("Status verloop"))
            .andExpect(jsonPath("$[0].width").value(1))
            .andExpect(jsonPath("$[0].properties.orientation").value("VERTICAL"))
            .andExpect(jsonPath("$[0].properties.source").value("iko:/statushistorie"))
            .andExpect(jsonPath("$[0].properties.titlePath").value("/statustype/omschrijving"))
            .andExpect(jsonPath("$[0].properties.labelPath").value("/statustype/toelichting"))
            .andExpect(jsonPath("$[0].properties.completedPath").value("/datumStatusGezet"))
            .andExpect(jsonPath("$[0].properties.mode").doesNotExist())
    }

    @Test
    fun `should deserialize a metroline DTO posted to the management endpoint`() {
        val widget = metrolineWidget()
        whenever(service.create(eq("demo"), eq("general"), any())).thenReturn(widget)

        val payload = objectMapper.writeValueAsString(widget.toDto())

        managementMockMvc.perform(
            post(
                "/api/management/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget/{widgetKey}",
                "demo",
                "general",
                "status_verloop"
            )
                .content(payload)
                .contentType(APPLICATION_JSON_UTF8_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.type").value("metroline"))
            .andExpect(jsonPath("$.key").value("status_verloop"))
            .andExpect(jsonPath("$.properties.source").value("iko:/statushistorie"))
            .andExpect(jsonPath("$.properties.titlePath").value("/statustype/omschrijving"))
            .andExpect(jsonPath("$.properties.completedPath").value("/datumStatusGezet"))
    }

    private fun metrolineWidget() = MetrolineWidget(
        key = "status_verloop",
        title = "Status verloop",
        order = 0,
        width = 1,
        highContrast = false,
        isCompact = null,
        properties = MetrolineWidgetProperties(
            orientation = MetrolineOrientation.VERTICAL,
            source = "iko:/statushistorie",
            titlePath = "/statustype/omschrijving",
            labelPath = "/statustype/toelichting",
            completedPath = "/datumStatusGezet",
        ),
    )
}
