package com.ritense.case_.widget.text

import com.fasterxml.jackson.databind.jsontype.NamedType
import com.ritense.case_.rest.dto.CaseWidgetTabWidgetDto
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.widget.domain.NavigateToWidgetAction
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class TextCaseWidgetDtoJsonTest {

    /**
     * At runtime the subtypes are registered by classpath scan (`CaseWidgetJacksonModule` and
     * `WidgetJacksonModule`); a unit test has to register them by hand. `WidgetAction` resolves its
     * subtype by DEDUCTION, so it needs its candidates registered to be deserializable at all.
     */
    private val mapper = MapperSingleton.get().copy().apply {
        registerSubtypes(
            NamedType(TextCaseWidgetDto::class.java),
            NamedType(NavigateToWidgetAction::class.java),
        )
    }

    /**
     * The widget wizard always sends `actions` and `displayConditions`, so the payload below is
     * shaped exactly like the one the frontend posts.
     */
    @Test
    fun `should deserialize the payload sent by the widget wizard`() {
        val json = """
            {
              "key": "explanation",
              "title": "Explanation",
              "icon": "",
              "type": "text",
              "width": 4,
              "highContrast": false,
              "color": "WHITE",
              "isCompact": false,
              "properties": {"content": "## Heading\n\n- first"},
              "actions": [],
              "displayConditions": []
            }
        """.trimIndent()

        val dto = mapper.readValue(json, CaseWidgetTabWidgetDto::class.java)

        assertEquals("explanation", dto.key)
        assertEquals("## Heading\n\n- first", (dto as TextCaseWidgetDto).properties.content)
    }

    /**
     * Regression test: `actions` used to be an overridden getter returning `emptyList()`. Because
     * Jackson has USE_GETTERS_AS_SETTERS enabled by default, it deserialized into that read-only
     * list and this payload failed with "Operation is not supported for read-only collection".
     */
    @Test
    fun `should deserialize a payload that carries an action`() {
        val json = """
            {
              "key": "explanation",
              "title": "Explanation",
              "icon": "",
              "type": "text",
              "width": 4,
              "highContrast": false,
              "color": "WHITE",
              "isCompact": false,
              "properties": {"content": "text"},
              "actions": [{"name": "Handbook", "navigateTo": "https://example.org"}],
              "displayConditions": []
            }
        """.trimIndent()

        val dto = mapper.readValue(json, CaseWidgetTabWidgetDto::class.java)

        assertEquals(
            listOf(NavigateToWidgetAction(name = "Handbook", navigateTo = "https://example.org")),
            dto.actions
        )
    }
}
