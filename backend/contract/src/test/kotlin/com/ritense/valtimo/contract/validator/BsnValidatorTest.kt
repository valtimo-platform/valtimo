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

package com.ritense.valtimo.contract.validator

import com.ritense.valtimo.contract.validation.BsnValidator
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BsnValidatorTest {

    @Test
    fun `should return true for valid BSNs`() {
        arrayOf(
            "123456782",
            "012345672",
            "000000012",
            "999990019"
        ).forEach { bsn ->
            assertTrue(BsnValidator.isValid(bsn), "Expected BSN $bsn to be valid")
        }
    }

    @Test
    fun `should return false for invalid numeric BSNs`() {
        arrayOf(
            "123456789",
            "000000000",
            "987654321",
            "999999999",
            "1",
            "1234567890"
        ).forEach { bsn ->
            assertFalse(BsnValidator.isValid(bsn), "Expected BSN $bsn to be invalid")
        }
    }

    @Test
    fun `should return false for non-numeric or malformed input`() {
        arrayOf(
            "",
            " ",
            "abc",
            "1234-56782",
            "BSN1234567",
            "12A456782"
        ).forEach { bsn ->
            assertFalse(BsnValidator.isValid(bsn), "Expected BSN '$bsn' to be invalid")
        }
    }

    @Test
    fun `should return false for null input`() {
        assertFalse(BsnValidator.isValid(null))
    }

    @Test
    fun `should handle 8-digit BSN by padding to 9 digits`() {
        val valid8Digit = "12345672"
        val invalid8Digit = "12345679"
        assertTrue(BsnValidator.isValid(valid8Digit))
        assertFalse(BsnValidator.isValid(invalid8Digit))
    }

    @Test
    fun `should handle values with leading zeros correctly`() {
        assertTrue(BsnValidator.isValid("012345672"))
        assertFalse(BsnValidator.isValid("000000000"))
    }
}
