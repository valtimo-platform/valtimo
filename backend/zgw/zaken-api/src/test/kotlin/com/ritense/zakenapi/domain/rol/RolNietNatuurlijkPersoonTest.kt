package com.ritense.zakenapi.domain.rol

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

internal class RolNietNatuurlijkPersoonTest {

    @Test
    fun `should throw exception when annIdentificatie, innNnpId, kvkNummer or vestigingsNummer is not provided`() {
        val exception = assertThrows<IllegalArgumentException> {
            RolNietNatuurlijkPersoon(
                annIdentificatie = null,
                innNnpId = null,
                kvkNummer = null,
                vestigingsNummer = null
            )
        }
        assertThat(exception.message)
            .isEqualTo("Either annIdentificatie, innNnpId, kvkNummer or vestigingsNummer should be provided!")
    }
}