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

package com.ritense.case_.rest

import com.ritense.case_.widget.metroline.MetrolineMode
import com.ritense.case_.widget.metroline.ZaakMetrolineDataService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class MetrolineManagementResource(
    private val zaakMetrolineDataService: ZaakMetrolineDataService?,
) {

    @GetMapping("/v1/metroline/available-modes")
    fun getAvailableModes(): ResponseEntity<List<MetrolineMode>> {
        val modes = mutableListOf(MetrolineMode.INTERNAL_CASE_STATUS)
        if (zaakMetrolineDataService != null) {
            modes.add(MetrolineMode.ZAAKSTATUS)
        }
        return ResponseEntity.ok(modes)
    }
}
