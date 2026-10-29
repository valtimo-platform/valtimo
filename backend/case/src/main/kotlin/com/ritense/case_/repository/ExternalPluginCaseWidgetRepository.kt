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

package com.ritense.case_.repository

import com.ritense.case_.domain.tab.CaseWidgetTabWidgetId
import com.ritense.case_.widget.externalplugin.ExternalPluginCaseWidget
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

/**
 * Subtype-typed repository over the single-table-inheritance widget table. Hibernate adds the
 * `case_widget_type = 'external-plugin'` discriminator filter automatically, so these queries only
 * ever return external-plugin widgets. Backs the delete guard and dangling-repair panel, which need
 * to find/rewrite widgets by their (queryable) configuration id.
 */
interface ExternalPluginCaseWidgetRepository :
    JpaRepository<ExternalPluginCaseWidget, CaseWidgetTabWidgetId> {

    fun findAllByExternalPluginConfigurationId(externalPluginConfigurationId: UUID): List<ExternalPluginCaseWidget>

    fun existsByExternalPluginConfigurationId(externalPluginConfigurationId: UUID): Boolean
}
