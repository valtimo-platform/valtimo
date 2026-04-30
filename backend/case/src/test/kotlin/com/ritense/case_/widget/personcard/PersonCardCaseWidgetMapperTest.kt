package com.ritense.case_.widget.personcard

import com.ritense.case_.domain.tab.CaseWidgetTabWidgetId
import com.ritense.widget.domain.WidgetColor
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class PersonCardCaseWidgetMapperTest {

    private val mapper = PersonCardCaseWidgetMapper()

    @Test
    fun `toEntity should default color to WHITE`() {
        val dto = PersonCardCaseWidgetDto(
            key = "key",
            title = "title",
            icon = null,
            color = null,
            width = 2,
            highContrast = false,
            isCompact = null,
            actions = emptyList(),
            displayConditions = emptyList(),
            properties = testProperties()
        )

        val entity = mapper.toEntity(dto, 0)

        assertEquals(WidgetColor.WHITE, entity.color)
    }

    @Test
    fun `toDto should map all properties`() {
        val entity = PersonCardCaseWidget(
            id = CaseWidgetTabWidgetId("key"),
            title = "Inwoner gegevens",
            icon = "mdi-account",
            color = WidgetColor.BLUE,
            order = 0,
            width = 2,
            highContrast = false,
            isCompact = true,
            actions = emptyList(),
            displayConditions = emptyList(),
            properties = testProperties()
        )

        val dto = mapper.toDto(entity)

        assertEquals("key", dto.key)
        assertEquals("Inwoner gegevens", dto.title)
        assertEquals("mdi-account", dto.icon)
        assertEquals(WidgetColor.BLUE, dto.color)
        assertEquals(2, dto.width)
        assertEquals(false, dto.highContrast)
        assertEquals(true, dto.isCompact)
        assertEquals(testProperties(), dto.properties)
    }

    @Test
    fun `toEntity should preserve person properties`() {
        val properties = testProperties()
        val dto = PersonCardCaseWidgetDto(
            key = "key",
            title = "title",
            icon = null,
            width = 2,
            highContrast = false,
            isCompact = null,
            actions = emptyList(),
            displayConditions = emptyList(),
            properties = properties
        )

        val entity = mapper.toEntity(dto, 0)

        assertEquals(properties.icon, entity.properties.icon)
        assertEquals(properties.person.fullName, entity.properties.person.fullName)
        assertEquals(properties.person.birthDate, entity.properties.person.birthDate)
        assertEquals(properties.person.bsn, entity.properties.person.bsn)
        assertEquals(properties.person.phone, entity.properties.person.phone)
        assertEquals(properties.person.email, entity.properties.person.email)
        assertEquals(properties.person.city, entity.properties.person.city)
    }

    private fun testProperties() = PersonCardWidgetProperties(
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
}
