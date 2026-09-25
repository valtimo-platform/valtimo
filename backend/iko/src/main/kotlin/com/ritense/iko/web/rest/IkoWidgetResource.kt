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

import com.ritense.iko.service.IkoWidgetService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.IKO_VIEW_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.NO_PAGE_SIZE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PAGEABLE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.TAB_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.WIDGET_KEY
import com.ritense.widget.web.rest.dto.WidgetDataEnvelope
import com.ritense.widget.web.rest.dto.WidgetDto
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.constraints.Size
import org.springframework.data.domain.Pageable
import org.springframework.data.web.PageableDefault
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.util.LinkedMultiValueMap
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam

@Controller
@SkipComponentScan
@Validated
@RequestMapping("/api", produces = [ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE])
class IkoWidgetResource(
    private val ikoWidgetService: IkoWidgetService,
) {

    @EndpointDescription(
        en = "List IKO widgets",
        nl = "IKO-widgets ophalen",
    )
    @GetMapping("/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget")
    fun getIkoWidgets(
        @PathVariable @Size(max = 256) ikoViewKey: String,
        @PathVariable @Size(max = 256) tabKey: String,
    ): ResponseEntity<List<WidgetDto>> {
        val widgets = ikoWidgetService.findAllByTabKeyFilteredByDisplayConditions(ikoViewKey, tabKey)
        val groupIds = ikoWidgetService.dataGroupIds(ikoViewKey, tabKey, widgets)
        return ResponseEntity.ok(
            widgets.map { widget ->
                widget.toDto().apply { dataGroupId = groupIds[widget.key] }
            }
        )
    }

    @EndpointDescription(
        en = "Get grouped IKO widget data",
        nl = "Gegroepeerde IKO-widgetgegevens ophalen",
    )
    @GetMapping("/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget/data")
    fun getIkoWidgetDataGroup(
        @PathVariable @Size(max = 256) ikoViewKey: String,
        @PathVariable @Size(max = 256) tabKey: String,
        @RequestParam @Size(max = 64) group: String,
        @RequestParam properties: LinkedMultiValueMap<String, List<Any>>,
    ): ResponseEntity<Map<String, WidgetDataEnvelope>> {
        // 'group' routes the request — not a widget property, and a filter could be keyed 'group'
        val allProperties = collapseSingleValues(properties).minus(GROUP_PARAM) + mapOf(
            IKO_VIEW_KEY to ikoViewKey,
            TAB_KEY to tabKey,
            // Initial load only — paging and filtering go to the per-widget endpoint
            NO_PAGE_SIZE to true
        )

        return ResponseEntity.ofNullable(
            ikoWidgetService.getWidgetDataGroup(ikoViewKey, tabKey, group, allProperties)
        )
    }

    @EndpointDescription(
        en = "Get IKO widget data",
        nl = "IKO-widgetgegevens ophalen",
    )
    @GetMapping("/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget/{widgetKey}/data")
    fun getIkoWidgetData(
        @PathVariable @Size(max = 256) ikoViewKey: String,
        @PathVariable @Size(max = 256) tabKey: String,
        @PathVariable @Size(max = 256) widgetKey: String,
        @RequestParam properties: LinkedMultiValueMap<String, List<Any>>,
        @PageableDefault pageable: Pageable,
        request: HttpServletRequest,
    ): ResponseEntity<Any?> {
        val pageSize = request.parameterMap["size"]?.firstOrNull()?.toIntOrNull()
        val allProperties = collapseSingleValues(properties) + mapOf(
            IKO_VIEW_KEY to ikoViewKey,
            TAB_KEY to tabKey,
            WIDGET_KEY to widgetKey,
            PAGEABLE to pageable,
            NO_PAGE_SIZE to (pageSize == null || pageSize <= 0)
        )

        return ResponseEntity.ok(
            ikoWidgetService.getWidgetData(ikoViewKey, tabKey, widgetKey, allProperties)
        )
    }

    private fun collapseSingleValues(properties: LinkedMultiValueMap<String, List<Any>>): Map<String, Any> =
        properties
            .map { if (it.value.size == 1) it.key to it.value.first() else it.key to it.value }
            .toMap()

    companion object {
        private const val GROUP_PARAM = "group"
    }
}
