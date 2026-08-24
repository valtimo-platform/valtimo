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

package com.ritense.valtimo.processbean.web.rest

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.processbean.ProcessBeanService
import com.ritense.valtimo.processbean.dto.ProcessBeanDto
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class ProcessBeanResource(
    private val processBeanService: ProcessBeanService
) {
    @GetMapping("/management/v1/process-bean")
    fun getProcessBeans(): ResponseEntity<List<ProcessBeanDto>> {
        return ResponseEntity.ok(processBeanService.getProcessBeans())
    }

    @GetMapping("/management/v1/process-bean/{beanName}")
    fun getProcessBean(
        @PathVariable beanName: String
    ): ResponseEntity<ProcessBeanDto> {
        val bean = processBeanService.getProcessBean(beanName)
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(bean)
    }
}
