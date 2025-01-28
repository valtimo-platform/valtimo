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

package com.ritense.objectenapi.client.dto

import mu.KLogger
import mu.KotlinLogging

data class TypedObjectsPage<T>(
    val count: Int,
    val next: String? = null,
    val previous: String? = null,
    val results: List<TypedObjectWrapper<T>>
) {
    companion object {
        fun <T> getAll(
            pageLimit: Int? = 100,
            getPage: (page: Int) -> TypedObjectsPage<T>
        ): List<TypedObjectWrapper<T>> {
            if (pageLimit != null) {
                require(pageLimit > 0) { "pageLimit should be > 0 but was: $pageLimit" }
            } else {
                logger.warn { "No page limit is used. Please consider using a limit!" }
            }

            var page = 0
            val results = generateSequence(getPage(page)) { previousPage ->
                if (pageLimit?.let { page < pageLimit - 1  } != false && previousPage.next != null) {
                    getPage(++page)
                } else {
                    null
                }
            }.toList()

            if (results.last().next != null) {
                logger.error { "Too many page request: Truncated after ${page + 1} pages. Please use a paginated result!" }
            } else if (pageLimit != null && page >= (pageLimit - 1) / 2) {
                logger.warn { "Retrieved ${page + 1} pages. Page limit is $pageLimit. Please consider using a paginated result!" }
            }

            return results.flatMap(TypedObjectsPage<T>::results)
        }

        private val logger: KLogger = KotlinLogging.logger {}
    }
}