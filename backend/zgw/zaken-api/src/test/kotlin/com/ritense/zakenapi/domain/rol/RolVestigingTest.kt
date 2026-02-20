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

package com.ritense.zakenapi.domain.rol

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class RolVestigingTest {

    @Test
    fun `should throw IllegalArgumentException when all three fields are null or invalid`() {
        val exception = assertThrows<IllegalArgumentException> {
            RolVestiging(
                vestigingsNummer = null,
                handelsnaam = null,
                kvkNummer = null
            )
        }
        assertThat(exception.message).isEqualTo("Either vestigingsNummer, handelsnaam or kvkNummer should be provided!")
    }

    @Test
    fun `should throw IllegalArgumentException when handelsnaam is empty`() {
        val exception = assertThrows<IllegalArgumentException> {
            RolVestiging(
                handelsnaam = listOf(),
                kvkNummer = null,
                vestigingsNummer = null
            )
        }
        assertThat(exception.message).isEqualTo("Either vestigingsNummer, handelsnaam or kvkNummer should be provided!")
    }

    @Test
    fun `should throw IllegalArgumentException when handelsnaam contains only blank values`() {
        val exception = assertThrows<IllegalArgumentException> {
            RolVestiging(
                handelsnaam = listOf("  ", "\t", "\n"),
                kvkNummer = null,
                vestigingsNummer = null
            )
        }
        assertThat(exception.message).isEqualTo("Either vestigingsNummer, handelsnaam or kvkNummer should be provided!")
    }
}