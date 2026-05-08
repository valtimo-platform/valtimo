package com.ritense.case_.widget.personcard

import com.ritense.case_.domain.tab.CaseWidgetTabWidgetId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever
import org.springframework.data.domain.Pageable
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class PersonCardCaseWidgetDataProviderTest(
    @Mock private val valueResolverService: ValueResolverService
) {

    private val dataProvider = PersonCardCaseWidgetDataProvider(valueResolverService, MapperSingleton.get())
    private val testCaseDefinitionId = CaseDefinitionId("test-case", "1.0.0")

    @Test
    fun `should resolve all person data`() {
        val widget = testWidget()
        val documentId = UUID.randomUUID()

        whenever(valueResolverService.resolveValues(any<Map<String, Any>>(), any())).thenReturn(
            mapOf(
                "doc:/persoon/volledigeNaam" to "Jan de Vries",
                "doc:/persoon/geboortedatum" to "1990-01-15",
                "doc:/persoon/bsn" to "123456789",
                "doc:/persoon/telefoon" to "0612345678",
                "doc:/persoon/email" to "jan@example.com",
                "doc:/persoon/woonplaats" to "Amsterdam"
            )
        )

        @Suppress("UNCHECKED_CAST")
        val result = dataProvider.getData(documentId, widget, Pageable.unpaged(), testCaseDefinitionId) as Map<String, Any?>

        assertThat(result["fullName"]).isEqualTo("Jan de Vries")
        assertThat(result["birthDate"]).isEqualTo("1990-01-15")
        assertThat(result["bsn"]).isEqualTo("123456789")
        assertThat(result["phone"]).isEqualTo("0612345678")
        assertThat(result["email"]).isEqualTo("jan@example.com")
        assertThat(result["city"]).isEqualTo("Amsterdam")
    }

    @Test
    fun `should handle null optional fields`() {
        val widget = PersonCardCaseWidget(
            id = CaseWidgetTabWidgetId("test"),
            title = "Test",
            order = 0,
            width = 2,
            highContrast = false,
            isCompact = null,
            actions = emptyList(),
            displayConditions = emptyList(),
            properties = PersonCardWidgetProperties(
                person = PersonCardWidgetProperties.PersonFields(
                    fullName = "doc:/persoon/volledigeNaam"
                )
            )
        )
        val documentId = UUID.randomUUID()

        whenever(valueResolverService.resolveValues(any<Map<String, Any>>(), any())).thenReturn(
            mapOf("doc:/persoon/volledigeNaam" to "Jan de Vries")
        )

        @Suppress("UNCHECKED_CAST")
        val result = dataProvider.getData(documentId, widget, Pageable.unpaged(), testCaseDefinitionId) as Map<String, Any?>

        assertThat(result["fullName"]).isEqualTo("Jan de Vries")
        assertThat(result).doesNotContainKey("birthDate")
        assertThat(result).doesNotContainKey("bsn")
        assertThat(result).doesNotContainKey("phone")
        assertThat(result).doesNotContainKey("email")
        assertThat(result).doesNotContainKey("city")
    }

    @Test
    fun `should support PersonCardCaseWidget`() {
        assertThat(dataProvider.supports(testWidget())).isTrue()
    }

    @Test
    fun `should not support other widget types`() {
        assertThat(dataProvider.supports("not-a-widget")).isFalse()
    }

    private fun testWidget() = PersonCardCaseWidget(
        id = CaseWidgetTabWidgetId("test"),
        title = "Test",
        order = 0,
        width = 2,
        highContrast = false,
        isCompact = null,
        actions = emptyList(),
        displayConditions = emptyList(),
        properties = PersonCardWidgetProperties(
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
    )
}
