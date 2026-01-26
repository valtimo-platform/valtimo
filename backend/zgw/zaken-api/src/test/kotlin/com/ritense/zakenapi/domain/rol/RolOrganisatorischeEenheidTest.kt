package com.ritense.zakenapi.domain.rol

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class RolOrganisatorischeEenheidTest {

    @Test
    fun `should throw exception when identificatie or naam is not provided`() {
        val exception = assertThrows<IllegalArgumentException> {
            RolOrganisatorischeEenheid(
                identificatie = null,
                naam = null
            )
        }
        assertThat(exception.message).isEqualTo("Either identificatie or name should be provided!")
    }
}