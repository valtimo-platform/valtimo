/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.case_.widget.metroline

import com.ritense.case_.domain.tab.CaseWidgetTabWidgetId
import com.ritense.document.domain.InternalCaseStatus
import com.ritense.document.domain.InternalCaseStatusColor
import com.ritense.document.domain.InternalCaseStatusHistory
import com.ritense.document.domain.InternalCaseStatusId
import com.ritense.document.repository.InternalCaseStatusHistoryRepository
import com.ritense.document.service.InternalCaseStatusService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.whenever
import org.springframework.data.domain.Pageable
import java.time.LocalDateTime
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class MetrolineCaseWidgetDataProviderTest {

    @Mock
    private lateinit var internalCaseStatusService: InternalCaseStatusService

    @Mock
    private lateinit var internalCaseStatusHistoryRepository: InternalCaseStatusHistoryRepository

    @Mock
    private lateinit var zaakMetrolineDataService: ZaakMetrolineDataService

    private lateinit var dataProvider: MetrolineCaseWidgetDataProvider

    private val caseDefinitionId = CaseDefinitionId("test-case", "1.0.0")
    private val documentId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        dataProvider = MetrolineCaseWidgetDataProvider(
            internalCaseStatusService,
            internalCaseStatusHistoryRepository,
            zaakMetrolineDataService,
        )
    }

    @Test
    fun `should return only reached statuses for internal case status mode`() {
        val statuses = listOf(
            internalCaseStatus("open", "Open", "Opened", 0),
            internalCaseStatus("in-progress", "In progress", "Started", 1),
            internalCaseStatus("closed", "Closed", null, 2),
        )
        whenever(internalCaseStatusService.getInternalCaseStatuses(caseDefinitionId.key))
            .thenReturn(statuses)

        val history = listOf(
            statusHistory("open", LocalDateTime.of(2026, 1, 1, 10, 0)),
            statusHistory("in-progress", LocalDateTime.of(2026, 1, 2, 10, 0)),
        )
        whenever(internalCaseStatusHistoryRepository.findByDocumentIdOrderByCreatedOn(documentId))
            .thenReturn(history)

        val result = dataProvider.getData(
            documentId,
            testWidget(MetrolineMode.INTERNAL_CASE_STATUS),
            Pageable.unpaged(),
            caseDefinitionId,
        ) as List<MetrolineItem>

        assertThat(result).hasSize(2)
        assertThat(result[0].title).isEqualTo("Open")
        assertThat(result[0].label).isEqualTo("Opened")
        assertThat(result[0].completed).isEqualTo(LocalDateTime.of(2026, 1, 1, 10, 0))
        assertThat(result[1].title).isEqualTo("In progress")
        assertThat(result[1].label).isEqualTo("Started")
        assertThat(result[1].completed).isEqualTo(LocalDateTime.of(2026, 1, 2, 10, 0))
    }

    @Test
    fun `should return empty list when no statuses reached`() {
        whenever(internalCaseStatusService.getInternalCaseStatuses(caseDefinitionId.key))
            .thenReturn(emptyList())
        whenever(internalCaseStatusHistoryRepository.findByDocumentIdOrderByCreatedOn(documentId))
            .thenReturn(emptyList())

        val result = dataProvider.getData(
            documentId,
            testWidget(MetrolineMode.INTERNAL_CASE_STATUS),
            Pageable.unpaged(),
            caseDefinitionId,
        ) as List<MetrolineItem>

        assertThat(result).isEmpty()
    }

    @Test
    fun `should use status key as title when status definition not found`() {
        whenever(internalCaseStatusService.getInternalCaseStatuses(caseDefinitionId.key))
            .thenReturn(emptyList())

        val history = listOf(
            statusHistory("deleted-status", LocalDateTime.of(2026, 1, 1, 10, 0)),
        )
        whenever(internalCaseStatusHistoryRepository.findByDocumentIdOrderByCreatedOn(documentId))
            .thenReturn(history)

        val result = dataProvider.getData(
            documentId,
            testWidget(MetrolineMode.INTERNAL_CASE_STATUS),
            Pageable.unpaged(),
            caseDefinitionId,
        ) as List<MetrolineItem>

        assertThat(result).hasSize(1)
        assertThat(result[0].title).isEqualTo("deleted-status")
        assertThat(result[0].label).isNull()
        assertThat(result[0].completed).isEqualTo(LocalDateTime.of(2026, 1, 1, 10, 0))
    }

    @Test
    fun `should preserve history order`() {
        val statuses = listOf(
            internalCaseStatus("first", "First", null, 0),
            internalCaseStatus("second", "Second", null, 1),
            internalCaseStatus("third", "Third", null, 2),
        )
        whenever(internalCaseStatusService.getInternalCaseStatuses(caseDefinitionId.key))
            .thenReturn(statuses)

        val history = listOf(
            statusHistory("second", LocalDateTime.of(2026, 1, 1, 10, 0)),
            statusHistory("first", LocalDateTime.of(2026, 1, 2, 10, 0)),
        )
        whenever(internalCaseStatusHistoryRepository.findByDocumentIdOrderByCreatedOn(documentId))
            .thenReturn(history)

        val result = dataProvider.getData(
            documentId,
            testWidget(MetrolineMode.INTERNAL_CASE_STATUS),
            Pageable.unpaged(),
            caseDefinitionId,
        ) as List<MetrolineItem>

        assertThat(result).hasSize(2)
        assertThat(result[0].title).isEqualTo("Second")
        assertThat(result[1].title).isEqualTo("First")
    }

    @Test
    fun `should delegate to zaak metroline data service for zaakstatus mode`() {
        val expected = listOf(
            MetrolineItem("Zaak gestart", "Aanvraag ontvangen", LocalDateTime.of(2026, 1, 1, 10, 0)),
            MetrolineItem("In behandeling", null, null),
        )
        whenever(zaakMetrolineDataService.getMetrolineItems(documentId))
            .thenReturn(expected)

        val result = dataProvider.getData(
            documentId,
            testWidget(MetrolineMode.ZAAKSTATUS),
            Pageable.unpaged(),
            caseDefinitionId,
        ) as List<MetrolineItem>

        assertThat(result).isEqualTo(expected)
    }

    @Test
    fun `should throw when zaakstatus mode used without zaken-api module`() {
        val providerWithoutZaak = MetrolineCaseWidgetDataProvider(
            internalCaseStatusService,
            internalCaseStatusHistoryRepository,
            null,
        )

        assertThrows<IllegalStateException> {
            providerWithoutZaak.getData(
                documentId,
                testWidget(MetrolineMode.ZAAKSTATUS),
                Pageable.unpaged(),
                caseDefinitionId,
            )
        }
    }

    @Test
    fun `should support MetrolineCaseWidget`() {
        assertThat(dataProvider.supports(testWidget(MetrolineMode.INTERNAL_CASE_STATUS))).isTrue()
    }

    @Test
    fun `should not support other widget types`() {
        assertThat(dataProvider.supports("not a widget")).isFalse()
    }

    private fun testWidget(mode: MetrolineMode) = MetrolineCaseWidget(
        id = CaseWidgetTabWidgetId("metroline-test"),
        title = "Metroline",
        order = 0,
        width = 4,
        highContrast = false,
        isCompact = false,
        actions = emptyList(),
        displayConditions = emptyList(),
        properties = MetrolineCaseWidgetProperties(
            orientation = MetrolineOrientation.HORIZONTAL,
            mode = mode,
        ),
    )

    private fun internalCaseStatus(key: String, title: String, label: String?, order: Int) =
        InternalCaseStatus(
            id = InternalCaseStatusId(caseDefinitionId.key, key),
            title = title,
            visibleInCaseListByDefault = true,
            order = order,
            retentionPeriodInDays = -1,
            color = InternalCaseStatusColor.BLUE,
            label = label,
        )

    private fun statusHistory(statusKey: String, createdOn: LocalDateTime) =
        InternalCaseStatusHistory(
            documentId = documentId,
            caseDefinitionKey = caseDefinitionId.key,
            internalCaseStatusKey = statusKey,
            createdOn = createdOn,
        )
}
