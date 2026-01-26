package com.ritense.zakenapi.domain.rol

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
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
        assertEquals("Either vestigingsNummer, handelsnaam or kvkNummer should be provided!", exception.message)
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
        assertEquals("Either vestigingsNummer, handelsnaam or kvkNummer should be provided!", exception.message)
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
        assertEquals("Either vestigingsNummer, handelsnaam or kvkNummer should be provided!", exception.message)
    }
}