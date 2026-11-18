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

class ChangeLog20261116FixEmptyWidgetKeyIT : BaseIntegrationTest() {

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
    fun `should give the widget with an empty key a valid key and keep it on its dashboard`() {
        val dashboard = dashboardRepository.save(dashboard(key = "my_dashboard", title = "My dashboard"))
        widgetConfigurationRepository.save(widget(dashboard, key = "widget_2026", title = "Other"))
        widgetConfigurationRepository.save(widget(dashboard, key = "", title = "2026"))

        runChange()

        assertThat(widgetConfigurationRepository.existsById("")).isFalse
        val fixed = widgetConfigurationRepository.findById("widget_2026_2").orElseThrow()
        assertThat(fixed.title).isEqualTo("2026")
        assertThat(fixed.dashboard.key).isEqualTo("my_dashboard")
        assertThat(fixed.dataSourceKey).isEqualTo("doorlooptijd")
        assertThat(fixed.dataSourceProperties.get("threshold").asInt()).isEqualTo(50)
        assertThat(fixed.displayType).isEqualTo("gauge")
        assertThat(fixed.displayTypeProperties.get("useKpi").asBoolean()).isTrue
    }

    @Test
    fun `should do nothing when no widget has an empty key`() {
        val dashboard = dashboardRepository.save(dashboard(key = "my_dashboard", title = "My dashboard"))
        widgetConfigurationRepository.save(widget(dashboard, key = "my_widget", title = "My widget"))

        runChange()

        assertThat(widgetConfigurationRepository.findAll().map { it.key }).containsExactly("my_widget")
    }

    private fun runChange() {
        val database = DatabaseFactory.getInstance()
            .findCorrectDatabaseImplementation(JdbcConnection(dataSource.connection))
        try {
            ChangeLog20261116FixEmptyWidgetKey().execute(database)
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

    private fun widget(dashboard: Dashboard, key: String, title: String) = WidgetConfiguration(
        key = key,
        title = title,
        dashboard = dashboard,
        dataSourceKey = "doorlooptijd",
        dataSourceProperties = objectMapper.readTree("""{ "threshold": 50 }""") as ObjectNode,
        displayType = "gauge",
        order = 0,
        displayTypeProperties = objectMapper.readTree("""{ "useKpi": true }""") as ObjectNode,
    )
}
