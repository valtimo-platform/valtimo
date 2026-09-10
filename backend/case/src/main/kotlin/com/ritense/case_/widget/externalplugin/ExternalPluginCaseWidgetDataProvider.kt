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

package com.ritense.case_.widget.externalplugin

import com.ritense.case_.rest.dto.ExternalPluginWidgetContentDto
import com.ritense.case_.rest.dto.ExternalPluginWidgetContext
import com.ritense.case_.service.ExternalPluginCaseWidgetResolver
import com.ritense.case_.widget.CaseWidgetDataProvider
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.data.domain.Pageable
import java.util.Optional
import java.util.UUID

/**
 * Returns the iframe descriptor (bundle URL + context) for an `external-plugin` case widget, served
 * through the existing widget-data endpoint. Unlike a first-party widget's data provider it returns
 * no document business data — only what the frontend needs to render the sandboxed plugin iframe.
 *
 * Resolving the bundle URL lives here rather than in the mapper's `toDto` because only the data
 * provider has the [documentId] needed to build the context; it also reuses the endpoint's
 * per-widget PBAC check. When the resolver is absent (external-plugin not on the classpath) or the
 * configuration is dangling/unresolvable, [ExternalPluginWidgetContentDto.bundleUrl] is `null` and
 * the frontend shows an unavailable state — matching the case tab.
 */
class ExternalPluginCaseWidgetDataProvider(
    private val resolver: Optional<ExternalPluginCaseWidgetResolver>,
) : CaseWidgetDataProvider {

    override fun supports(widget: Any): Boolean = widget is ExternalPluginCaseWidget

    override fun getData(
        documentId: UUID,
        widget: Any,
        pageable: Pageable,
        caseDefinitionId: CaseDefinitionId
    ): Any {
        widget as ExternalPluginCaseWidget
        val configurationId = widget.externalPluginConfigurationId
        val bundleUrl = configurationId?.let {
            resolver.orElse(null)?.resolveBundleUrl(it, widget.bundleKey)
        }

        return ExternalPluginWidgetContentDto(
            bundleUrl = bundleUrl,
            configurationId = configurationId,
            bundleKey = widget.bundleKey,
            context = ExternalPluginWidgetContext(
                documentId = documentId.toString(),
                caseDefinitionKey = caseDefinitionId.key,
                caseDefinitionVersionTag = caseDefinitionId.versionTag.toString(),
                pluginConfigurationId = configurationId?.toString(),
            ),
        )
    }
}
