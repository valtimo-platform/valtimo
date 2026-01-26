package com.ritense.zakenapi.domain.rol

import org.assertj.core.api.Assertions.assertThat
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
        assertThat(exception.message).isEqualTo("Either identificatie or achternaam should be provided!")
    }
}