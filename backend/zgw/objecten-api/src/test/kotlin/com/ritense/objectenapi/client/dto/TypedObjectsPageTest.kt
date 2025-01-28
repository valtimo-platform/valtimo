/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 *  Licensed under EUPL, Version 1.2 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" basis,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package com.ritense.objectenapi.client.dto

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import java.net.URI
import java.util.UUID

class TypedObjectsPageTest {

    @Test
    fun `should get all page results`() {
        val pages = IntRange(1, 10).map { i ->
            TypedObjectsPage(
                1,
                (if (i >= 10) null else ""),
                (if (i <= 1) null else ""),
                listOf(TypedObjectWrapper(
                    url = URI(i.toString()),
                    uuid = UUID.randomUUID(),
                    type = URI(""),
                    record = mock<TypedObjectRecord<Int>>()
                ))
            )
        }

        var callCount = 0
        val all = TypedObjectsPage.getAll(20) { page ->
            callCount++
            pages[page]
        }

        assertThat(callCount).isEqualTo(10)
        assertThat(all.map { it.url.toString().toInt() }).isEqualTo(listOf(1,2,3,4,5,6,7,8,9,10))
    }

    @Test
    fun `should stop after maxPages`() {
        val pages = IntRange(1, 10).map { i ->
            TypedObjectsPage(
                1,
                (if (i >= 10) null else ""),
                (if (i <= 1) null else ""),
                listOf(TypedObjectWrapper(
                    url = URI(i.toString()),
                    uuid = UUID.randomUUID(),
                    type = URI(""),
                    record = mock<TypedObjectRecord<Int>>()
                ))
            )
        }

        var callCount = 0
        val all = TypedObjectsPage.getAll(3) { page ->
            callCount++
            pages[page]
        }

        assertThat(callCount).isEqualTo(3)
        assertThat(all.map { it.url.toString().toInt() }).isEqualTo(listOf(1,2,3))
    }

    @Test
    fun `should throw an exception when pageLimit is invalid`() {
        val ex = assertThrows<IllegalArgumentException> {
            TypedObjectsPage.getAll(0) { _ ->
                mock<TypedObjectsPage<Int>>()
            }
        }

        assertThat(ex.message).isEqualTo("pageLimit should be > 0 but was: 0")
    }
}