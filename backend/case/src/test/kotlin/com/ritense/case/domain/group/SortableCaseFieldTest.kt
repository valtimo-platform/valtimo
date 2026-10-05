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


package com.ritense.case.domain.group

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SortableCaseFieldTest {

    @Test
    fun `returns null for empty mappings`() {
        assertNull(SortableCaseField.sortPathOf(emptyList()))
    }

    @Test
    fun `returns path for one or many identical case paths`() {
        assertEquals("case:createdOn", SortableCaseField.sortPathOf(listOf("case:createdOn")))
        assertEquals("case:createdOn", SortableCaseField.sortPathOf(listOf("case:createdOn", "case:createdOn")))
    }

    @Test
    fun `supports nested definition name field`() {
        assertEquals(
            "case:documentDefinitionId.name",
            SortableCaseField.sortPathOf(listOf("case:documentDefinitionId.name"))
        )
    }

    @Test
    fun `returns null for different case paths`() {
        assertNull(SortableCaseField.sortPathOf(listOf("case:createdOn", "case:modifiedOn")))
    }

    @Test
    fun `returns null for document paths`() {
        assertNull(SortableCaseField.sortPathOf(listOf("doc:street")))
    }

    @Test
    fun `returns null for mixed case and document paths`() {
        assertNull(SortableCaseField.sortPathOf(listOf("case:createdOn", "doc:street")))
    }

    @Test
    fun `returns null for non whitelisted case fields`() {
        assertNull(SortableCaseField.sortPathOf(listOf("case:assignedTeamKey")))
        assertNull(SortableCaseField.sortPathOf(listOf("case:caseTags")))
    }
}
