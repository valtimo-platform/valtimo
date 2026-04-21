/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.IKO_VIEW_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.NO_PAGE_SIZE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PAGEABLE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.TAB_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.WIDGET_KEY
import com.ritense.widget.web.rest.dto.WidgetDto
import jakarta.servlet.http.HttpServletRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.web.PageableDefault
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam

@Controller
@SkipComponentScan
@RequestMapping("/api", produces = [ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE])
class IkoWidgetResource(
    private val ikoWidgetService: IkoWidgetService
) {

    @GetMapping("/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget")
    fun getIkoWidgets(
        @PathVariable ikoViewKey: String,
        @PathVariable tabKey: String,
    ): ResponseEntity<List<WidgetDto>> {
        return ResponseEntity.ok(
            ikoWidgetService.findAllByTabKeyFilteredByDisplayConditions(ikoViewKey, tabKey).map { it.toDto() })
    }

    @GetMapping("/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget/{widgetKey}/data")
    fun getIkoWidgetData(
        @PathVariable ikoViewKey: String,
        @PathVariable tabKey: String,
        @PathVariable widgetKey: String,
        @RequestParam properties: LinkedMultiValueMap<String, List<Any>>,
        @PageableDefault pageable: Pageable,
        request: HttpServletRequest,
    ): ResponseEntity<Any> {
        val pageSize = request.parameterMap["size"]?.firstOrNull()?.toIntOrNull()
        val collapsedValuesPropertiesMap =
            properties
                .map { if (it.value.size == 1) it.key to it.value.first() else it.key to it.value }
                .toMap()
        val allProperties = collapsedValuesPropertiesMap + mapOf(
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

}
