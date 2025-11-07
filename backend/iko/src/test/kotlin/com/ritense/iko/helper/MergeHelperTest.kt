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

package com.ritense.iko.helper

import com.ritense.iko.helper.MergeHelper.deepMerge
import kotlin.test.assertEquals
import org.junit.jupiter.api.Test

class MergeHelperTest {

    @Test
    fun `deepMerge should combine maps with non-overlapping keys`() {
        val left = mapOf("a" to 1)
        val right = mapOf("b" to 2)

        val result = left.deepMerge(right)

        val expected = mapOf("a" to 1, "b" to 2)
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should overwrite value for overlapping keys`() {
        val left = mapOf("a" to 1)
        val right = mapOf("a" to 2)

        val result = left.deepMerge(right)

        val expected = mapOf("a" to 2)
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should recursively merge nested maps with non-overlapping keys`() {
        val left = mapOf("a" to mapOf("x" to 1))
        val right = mapOf("a" to mapOf("y" to 2))

        val result = left.deepMerge(right)

        val expected = mapOf("a" to mapOf("x" to 1, "y" to 2))
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should overwrite values in nested maps for overlapping keys`() {
        val left = mapOf("a" to mapOf("x" to 1))
        val right = mapOf("a" to mapOf("x" to 2))

        val result = left.deepMerge(right)

        val expected = mapOf("a" to mapOf("x" to 2))
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should correctly merge maps with multiple nested levels`() {
        val left = mapOf(
            "a" to mapOf(
                "b" to mapOf(
                    "c" to 1,
                    "shared" to mapOf("x" to 10)
                )
            )
        )

        val right = mapOf(
            "a" to mapOf(
                "b" to mapOf(
                    "d" to 2,
                    "shared" to mapOf("y" to 20)
                )
            )
        )

        val result = left.deepMerge(right)

        val expected = mapOf(
            "a" to mapOf(
                "b" to mapOf(
                    "c" to 1,
                    "d" to 2,
                    "shared" to mapOf("x" to 10, "y" to 20)
                )
            )
        )

        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should merge maps with compatible key types`() {
        val left = mapOf(1 to "a")
        val right = mapOf(2 to "b")

        val result = left.deepMerge(right)

        val expected = mapOf(1 to "a", 2 to "b")
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should overwrite when values are of incompatible types`() {
        val left = mapOf("a" to 1)
        val right = mapOf("a" to "string")

        val result = left.deepMerge(right)

        // Right overwrites left because value types differ (Int vs String)
        val expected = mapOf("a" to "string")
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should recursively merge compatible mixed value types`() {
        val left = mapOf("a" to mapOf("x" to 1))
        val right = mapOf("a" to mapOf("y" to "b"))

        val result = left.deepMerge(right)

        val expected = mapOf("a" to mapOf("x" to 1, "y" to "b"))
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should replace null value on left with non-null from right`() {
        val left = mapOf("a" to null)
        val right = mapOf("a" to 1)

        val result = left.deepMerge(right)

        val expected = mapOf("a" to 1)
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should keep left non-null value when right is null`() {
        val left = mapOf("a" to 1)
        val right = mapOf("a" to null)

        val result = left.deepMerge(right)

        val expected = mapOf("a" to 1)
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should keep null when both sides are null`() {
        val left = mapOf("a" to null)
        val right = mapOf("a" to null)

        val result = left.deepMerge(right)

        val expected = mapOf("a" to null)
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should handle empty maps correctly`() {
        val leftEmpty = emptyMap<String, Any?>()
        val rightNonEmpty = mapOf("a" to 1)
        val leftNonEmpty = mapOf("a" to 1)
        val rightEmpty = emptyMap<String, Any?>()

        val result1 = leftEmpty.deepMerge(rightNonEmpty)
        val result2 = leftNonEmpty.deepMerge(rightEmpty)

        // When left is empty, right should be returned
        assertEquals(rightNonEmpty, result1)

        // When right is empty, result should be equal to left (clone)
        assertEquals(leftNonEmpty, result2)
    }

    @Test
    fun `deepMerge should concatenate lists`() {
        val left = mapOf("a" to listOf(1, 2))
        val right = mapOf("a" to listOf(3))

        val result = left.deepMerge(right)

        val expected = mapOf("a" to listOf(1, 2, 3))
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should union sets without duplicates`() {
        val left = mapOf("a" to setOf(1, 2))
        val right = mapOf("a" to setOf(2, 3))

        val result = left.deepMerge(right)

        // Note: Set order is not guaranteed, so compare as sets.
        val expected = mapOf("a" to setOf(1, 2, 3))
        assertEquals(expected["a"], (result["a"] as? Set<*>))
    }

    @Test
    fun `deepMerge should overwrite when left and right have incompatible collection types`() {
        val left = mapOf("a" to listOf(1))
        val right = mapOf("a" to setOf(2))

        val result = left.deepMerge(right)

        // Since List and Set are incompatible, right overwrites left.
        val expected = mapOf("a" to setOf(2))
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should not modify immutable receiver and return merged result`() {
        // Arrange
        val a = mapOf("a" to 1)
        val right = mapOf("b" to 2)

        // Act
        val merged = a.deepMerge(right)

        // Assert
        assertEquals(mapOf("a" to 1), a, "Immutable map should not be modified")
        assertEquals(mapOf("a" to 1, "b" to 2), merged, "Merged map should contain entries from both maps")
    }

    @Test
    fun `deepMerge should return empty map when both maps are empty`() {
        val left = emptyMap<Any, Any>()
        val right = emptyMap<Any, Any>()

        val result = left.deepMerge(right)

        val expected = emptyMap<Any, Any>()
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should merge maps containing null keys with right overwriting`() {
        val left = mapOf(null to "x")
        val right = mapOf(null to "y")

        val result = left.deepMerge(right)

        val expected = mapOf(null to "y")
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should overwrite when nested types are heterogeneous`() {
        val left = mapOf("a" to listOf(1))
        val right = mapOf("a" to mapOf("x" to 2))

        val result = left.deepMerge(right)

        // Because List and Map are incompatible, the right value replaces the left one.
        val expected = mapOf("a" to mapOf("x" to 2))
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should compile and merge correctly with Map String Any`() {
        val left: Map<String, Any?> = mapOf("a" to 1)
        val right: Map<String, Any?> = mapOf("b" to 2)

        val result = left.deepMerge(right)

        val expected = mapOf("a" to 1, "b" to 2)
        assertEquals(expected, result)
    }

    @Test
    fun `deepMerge should merge Kotlin and Java map implementations normally`() {
        val left = java.util.HashMap<String, Any?>()
        left["a"] = 1
        val right = java.util.LinkedHashMap<String, Any?>()
        right["b"] = 2

        val result = left.deepMerge(right)

        val expected = mapOf("a" to 1, "b" to 2)
        assertEquals(expected, result)
    }
}
