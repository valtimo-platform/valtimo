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

package com.ritense.dashboard.liquibase.changelog

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.dashboard.BaseIntegrationTest
import com.ritense.dashboard.domain.Dashboard
import com.ritense.dashboard.domain.WidgetConfiguration
import com.ritense.dashboard.repository.DashboardRepository
import com.ritense.dashboard.repository.WidgetConfigurationRepository
import liquibase.database.DatabaseFactory
import liquibase.database.jvm.JdbcConnection
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import javax.sql.DataSource

class ChangeLog20261116FixEmptyDashboardKeyIT : BaseIntegrationTest() {

    @Autowired
    lateinit var dataSource: DataSource

    @Autowired
    lateinit var dashboardRepository: DashboardRepository

    @Autowired
    lateinit var widgetConfigurationRepository: WidgetConfigurationRepository

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @BeforeEach
    @AfterEach
    fun cleanUp() {
        widgetConfigurationRepository.deleteAll()
        dashboardRepository.deleteAll()
    }

    @Test
    fun `should give the dashboard with an empty key a valid key and keep its widgets`() {
        dashboardRepository.save(dashboard(key = "dashboard_2026", title = "Other"))
        val legacy = dashboardRepository.save(dashboard(key = "", title = "2026"))
        widgetConfigurationRepository.save(widget(legacy))

        runChange()

        assertThat(dashboardRepository.existsById("")).isFalse
        val fixed = dashboardRepository.findById("dashboard_2026_2").orElseThrow()
        assertThat(fixed.title).isEqualTo("2026")
        assertThat(fixed.order).isEqualTo(1)
        assertThat(fixed.widgetConfigurations.map { it.key }).containsExactly("legacy-widget")
    }

    @Test
    fun `should do nothing when no dashboard has an empty key`() {
        dashboardRepository.save(dashboard(key = "my_dashboard", title = "My dashboard"))
        val keysBefore = dashboardRepository.findAll().map { it.key }

        runChange()

        assertThat(dashboardRepository.findAll().map { it.key }).containsExactlyInAnyOrderElementsOf(keysBefore)
    }

    private fun runChange() {
        val database = DatabaseFactory.getInstance()
            .findCorrectDatabaseImplementation(JdbcConnection(dataSource.connection))
        try {
            ChangeLog20261116FixEmptyDashboardKey().execute(database)
            database.commit()
        } finally {
            database.close()
        }
    }

    private fun dashboard(key: String, title: String) = Dashboard(
        key = key,
        title = title,
        description = "Test description",
        order = dashboardRepository.count().toInt(),
        createdBy = "test",
    )

    private fun widget(dashboard: Dashboard) = WidgetConfiguration(
        key = "legacy-widget",
        title = "Legacy widget",
        dashboard = dashboard,
        dataSourceKey = "doorlooptijd",
        dataSourceProperties = objectMapper.readTree("""{ "threshold": 50 }""") as ObjectNode,
        displayType = "gauge",
        order = 0,
        displayTypeProperties = objectMapper.readTree("""{ "useKpi": true }""") as ObjectNode,
    )
}
