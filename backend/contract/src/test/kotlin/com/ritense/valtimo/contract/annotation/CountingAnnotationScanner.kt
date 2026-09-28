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

package com.ritense.valtimo.contract.annotation

import io.github.classgraph.ScanResult
import org.springframework.context.ApplicationContext

/** Counts scans. Keeping the count at one guards against the startup scan count creeping back up. */
class CountingAnnotationScanner(context: ApplicationContext) : AnnotationScanner(context) {

    var scanCount: Int = 0
        private set

    override fun scan(acceptPackages: Array<String>): ScanResult {
        scanCount++
        return super.scan(acceptPackages)
    }
}
