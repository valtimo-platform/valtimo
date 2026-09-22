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

package com.ritense.case_.service

import com.ritense.authorization.AuthorizationService
import com.ritense.case.domain.CaseTabId
import com.ritense.case_.domain.tab.CaseWidgetTab
import com.ritense.case_.domain.tab.CaseWidgetTabWidget
import com.ritense.case_.repository.CaseWidgetTabRepository
import com.ritense.case_.rest.dto.CaseWidgetTabDto
import com.ritense.case_.rest.dto.CaseWidgetTabWidgetDto
import com.ritense.case_.widget.CaseWidgetMapper
import com.ritense.case_.widget.externalplugin.ExternalPluginCaseWidgetDto
import com.ritense.case_.widget.externalplugin.ExternalPluginCaseWidgetMapper
import com.ritense.case_.widget.externalplugin.ExternalPluginWidgetProperties
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

class CaseWidgetServiceTest {

    private val caseWidgetTabRepository = mock<CaseWidgetTabRepository>()

    @Suppress("UNCHECKED_CAST")
    private val mappers = listOf(ExternalPluginCaseWidgetMapper())
        as List<CaseWidgetMapper<CaseWidgetTabWidget, CaseWidgetTabWidgetDto>>

    private val mappingResolver = mock<PluginConfigurationMappingResolver>()

    private val caseWidgetService = CaseWidgetService(
        documentService = mock(),
        caseWidgetTabRepository = caseWidgetTabRepository,
        caseTabRepository = mock(),
        authorizationService = mock<AuthorizationService>(),
        caseWidgetMappers = mappers,
        caseWidgetDataProviders = emptyList(),
        caseDefinitionChecker = mock(),
        valueResolverService = mock(),
        pluginConfigurationMappingResolvers = listOf(mappingResolver),
    )

    private val caseDefinitionId = CaseDefinitionId.of("my-case", "1.0.0")

    @Test
    fun `updateWidgetTab rechecks configuration issues for the case definition`() {
        val tabId = CaseTabId(caseDefinitionId, "widgets-tab")
        whenever(caseWidgetTabRepository.findById(tabId)).thenReturn(Optional.of(CaseWidgetTab(tabId)))
        whenever(caseWidgetTabRepository.save(any<CaseWidgetTab>())).thenAnswer { it.arguments[0] }

        caseWidgetService.updateWidgetTab(
            CaseWidgetTabDto(
                caseDefinitionKey = "my-case",
                caseDefinitionVersionTag = "1.0.0",
                key = "widgets-tab",
                widgets = listOf(
                    ExternalPluginCaseWidgetDto(
                        key = "summary-widget",
                        title = "Summary",
                        icon = null,
                        width = 2,
                        highContrast = false,
                        isCompact = null,
                        properties = ExternalPluginWidgetProperties(
                            configurationId = UUID.randomUUID(),
                            bundleKey = null,
                        ),
                    )
                ),
            )
        )

        verify(mappingResolver).recheckIssuesForCaseDefinition(caseDefinitionId)
    }
}
