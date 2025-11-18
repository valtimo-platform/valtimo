package com.ritense.zakenapi.domain.rol

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

internal class RolNietNatuurlijkPersoonTest {

    @Test
    fun `should throw exception when annIdentificatie, innNnpId, kvkNummer or vestigingsNummer is not provided`() {
        assertThrows<IllegalArgumentException> {
            RolNietNatuurlijkPersoon()
        }
    }
}