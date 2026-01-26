package com.ritense.zakenapi.domain.rol

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class RolMedewerkerTest {

    @Test
    fun `should throw exception when identificatie or achternaam is not provided`() {
        val exception = assertThrows<IllegalArgumentException> {
            RolMedewerker(
                identificatie = null,
                achternaam = null
            )
        }
        assert(exception.message == "Either identificatie or achternaam should be provided!")
    }

}