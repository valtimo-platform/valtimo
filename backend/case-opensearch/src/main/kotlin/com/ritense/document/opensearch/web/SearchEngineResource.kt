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

package com.ritense.document.opensearch.web

import com.ritense.document.opensearch.service.SearchEngineToggle
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/management/v1/search-engine")
class SearchEngineResource(
    private val toggle: SearchEngineToggle,
) {

    @GetMapping
    fun getActive(): ResponseEntity<Map<String, String>> =
        ResponseEntity.ok(mapOf("active" to toggle.get().name))

    @PutMapping
    fun setActive(@RequestBody body: Map<String, String>): ResponseEntity<Map<String, String>> {
        val engine = SearchEngineToggle.Engine.valueOf(body["active"]!!.uppercase())
        toggle.set(engine)
        return ResponseEntity.ok(mapOf("active" to toggle.get().name))
    }
}
