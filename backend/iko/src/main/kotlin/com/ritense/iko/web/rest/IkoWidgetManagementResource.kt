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

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.iko.service.IkoWidgetService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.widget.web.rest.dto.WidgetDto
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import java.util.UUID

@Controller
@SkipComponentScan
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class IkoWidgetManagementResource(
    private val service: IkoWidgetService,
) {

    @RunWithoutAuthorization
    @GetMapping("/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget")
    fun getIkoWidgetsForManagement(
        @PathVariable ikoViewKey: String,
        @PathVariable tabKey: String,
    ): ResponseEntity<List<WidgetDto>> {
        val ikoWidgets = service.findAllByTabKey(
            ikoViewKey = ikoViewKey,
            tabKey = tabKey,
        )
        return ResponseEntity.ok(ikoWidgets.map { it.toDto() })
    }

    @RunWithoutAuthorization
    @GetMapping("/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget/{key}")
    fun getIkoWidget(
        @PathVariable ikoViewKey: String,
        @PathVariable tabKey: String,
        @PathVariable key: String,
    ): ResponseEntity<WidgetDto> {
        val ikoWidget = service.getByKey(ikoViewKey, tabKey, key)
        return ResponseEntity.ok(ikoWidget.toDto())
    }

    @RunWithoutAuthorization
    @PostMapping("/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget/{key}")
    fun createIkoWidget(
        @PathVariable ikoViewKey: String,
        @PathVariable tabKey: String,
        @PathVariable key: String,
        @Valid @RequestBody request: WidgetDto
    ): ResponseEntity<WidgetDto> {
        val existingWidgets = service.findAllByTabKey(ikoViewKey, tabKey)
        val ikoWidget = service.create(
            ikoViewKey = ikoViewKey,
            tabKey = tabKey,
            widget = request.toEntity(UUID.randomUUID(), existingWidgets.maxOfOrNull { it.order + 1 } ?: 0)
        )
        return ResponseEntity.ok(ikoWidget.toDto())
    }

    @RunWithoutAuthorization
    @PutMapping("/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget/{key}")
    fun updateIkoWidget(
        @PathVariable ikoViewKey: String,
        @PathVariable tabKey: String,
        @PathVariable key: String,
        @Valid @RequestBody request: WidgetDto,
    ): ResponseEntity<WidgetDto> {
        require(request.key == key)
        val existingWidget = service.findByKey(ikoViewKey, tabKey, key)
        requireNotNull(existingWidget)
        val ikoWidget = service.update(
            ikoViewKey,
            tabKey = tabKey,
            widget = request.toEntity(existingWidget.id, existingWidget.order)
        )
        return ResponseEntity.ok(ikoWidget.toDto())
    }

    @RunWithoutAuthorization
    @PutMapping("/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget")
    fun updateIkoWidget(
        @PathVariable ikoViewKey: String,
        @PathVariable tabKey: String,
        @Valid @RequestBody request: List<WidgetDto>,
    ): ResponseEntity<List<WidgetDto>> {
        val existingWidgets = service.findAllByTabKey(ikoViewKey, tabKey)
        val ikoWidgets = request.mapIndexed { index, updatedWidget ->
            val existingWidget = existingWidgets.firstOrNull { it.key == updatedWidget.key }
            if (existingWidget == null) {
                service.create(
                    ikoViewKey,
                    tabKey = tabKey,
                    widget = updatedWidget.toEntity(UUID.randomUUID(), index),
                )
            } else {
                service.update(
                    ikoViewKey,
                    tabKey = tabKey,
                    widget = updatedWidget.toEntity(existingWidget.id, index),
                )
            }
        }
        existingWidgets
            .filter { existing -> ikoWidgets.none { existing.id == it.id } }
            .forEach { existing -> service.deleteByKey(ikoViewKey, tabKey, existing.key) }
        return ResponseEntity.ok(ikoWidgets.map { it.toDto() })
    }

    @RunWithoutAuthorization
    @DeleteMapping("/v1/iko-view/{ikoViewKey}/tab/{tabKey}/widget/{key}")
    fun deleteIkoWidget(
        @PathVariable ikoViewKey: String,
        @PathVariable tabKey: String,
        @PathVariable key: String,
    ): ResponseEntity<WidgetDto> {
        service.deleteByKey(ikoViewKey, tabKey, key)
        return ResponseEntity.noContent().build()
    }
}
