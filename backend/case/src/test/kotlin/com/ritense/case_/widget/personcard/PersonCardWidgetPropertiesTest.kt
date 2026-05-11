package com.ritense.case_.widget.personcard

import com.ritense.valtimo.contract.validation.ValidatorHolder.Companion.validate
import jakarta.validation.ConstraintViolationException
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows

class PersonCardWidgetPropertiesTest {

    @Test
    fun `should not pass validation with blank fullName`() {
        val properties = PersonCardWidgetProperties(
            person = PersonCardWidgetProperties.PersonFields(fullName = "")
        )
        val ex = assertThrows<ConstraintViolationException> {
            validate(properties)
        }
        assertThat(ex.constraintViolations.single().propertyPath.toString()).isEqualTo("person.fullName")
        assertThat(ex.constraintViolations.single().message).isEqualTo("must not be blank")
    }

    @Test
    fun `should pass validation with only fullName`() {
        val properties = PersonCardWidgetProperties(
            person = PersonCardWidgetProperties.PersonFields(
                fullName = "doc:/persoon/volledigeNaam"
            )
        )
        assertDoesNotThrow { validate(properties) }
    }

    @Test
    fun `should pass validation with all fields`() {
        val properties = PersonCardWidgetProperties(
            icon = "mdi-home-city",
            person = PersonCardWidgetProperties.PersonFields(
                fullName = "doc:/persoon/volledigeNaam",
                birthDate = "doc:/persoon/geboortedatum",
                bsn = "doc:/persoon/bsn",
                phone = "doc:/persoon/telefoon",
                email = "doc:/persoon/email",
                city = "doc:/persoon/woonplaats"
            )
        )
        assertDoesNotThrow { validate(properties) }
    }
}
