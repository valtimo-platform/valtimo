package com.ritense.case_.widget.text

import com.ritense.case_.domain.tab.CaseWidgetTabWidgetId
import com.ritense.widget.domain.NavigateToWidgetAction
import com.ritense.widget.domain.WidgetAction
import com.ritense.widget.domain.WidgetColor
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class TextCaseWidgetMapperTest {

    private val mapper = TextCaseWidgetMapper()

    @Test
    fun `toEntity should default color to WHITE`() {
        val dto = textDto(color = null)

        val entity = mapper.toEntity(dto, 0)

        assertEquals(WidgetColor.WHITE, entity.color)
    }

    @Test
    fun `toEntity should preserve the content`() {
        val dto = textDto(content = "## Heading\n\n- first\n- second")

        val entity = mapper.toEntity(dto, 0)

        assertEquals("## Heading\n\n- first\n- second", entity.properties.content)
    }

    @Test
    fun `toEntity should use the index as order`() {
        val entity = mapper.toEntity(textDto(), 3)

        assertEquals(3, entity.order)
    }

    @Test
    fun `toDto should map all properties`() {
        val entity = TextCaseWidget(
            id = CaseWidgetTabWidgetId("key"),
            title = "Explanation",
            icon = "mdi-information",
            color = WidgetColor.BLUE,
            order = 0,
            width = 2,
            highContrast = false,
            isCompact = true,
            actions = emptyList(),
            displayConditions = emptyList(),
            properties = TextWidgetProperties(content = "Some **explanation**")
        )

        val dto = mapper.toDto(entity)

        assertEquals("key", dto.key)
        assertEquals("Explanation", dto.title)
        assertEquals("mdi-information", dto.icon)
        assertEquals(WidgetColor.BLUE, dto.color)
        assertEquals(2, dto.width)
        assertEquals(false, dto.highContrast)
        assertEquals(true, dto.isCompact)
        assertEquals("Some **explanation**", dto.properties.content)
    }

    @Test
    fun `toEntity should default null actions to an empty list`() {
        val entity = mapper.toEntity(textDto(actions = null), 0)

        assertEquals(emptyList<WidgetAction>(), entity.actions)
    }

    @Test
    fun `should map actions in both directions`() {
        val action = NavigateToWidgetAction(name = "Handbook", navigateTo = "https://example.org")

        val entity = mapper.toEntity(textDto(actions = listOf(action)), 0)

        assertEquals(listOf(action), entity.actions)
        assertEquals(listOf(action), mapper.toDto(entity).actions)
    }

    private fun textDto(
        color: WidgetColor? = WidgetColor.BLUE,
        content: String = "Some explanation",
        actions: List<WidgetAction>? = emptyList(),
    ) = TextCaseWidgetDto(
        key = "key",
        title = "title",
        icon = null,
        color = color,
        width = 2,
        highContrast = false,
        isCompact = null,
        actions = actions,
        displayConditions = emptyList(),
        properties = TextWidgetProperties(content = content)
    )
}
