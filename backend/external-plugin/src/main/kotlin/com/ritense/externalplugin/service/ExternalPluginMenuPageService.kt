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

package com.ritense.externalplugin.service

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.web.rest.dto.ExternalPluginMenuPageDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Lists the `page` bundles of every activated (`AVAILABLE`) external-plugin configuration so the
 * menu-configuration builder can offer them as a "Plugin pages" catalog category. Each entry carries
 * the resolved bundle URL (via the shared [ExternalPluginBundleUrlResolver]) plus the title/icon the
 * builder renders. No role field — access is PBAC at render time (the page route mints a downscoped
 * user token), so this list is intentionally unfiltered.
 */
@Service
@SkipComponentScan
@Transactional(readOnly = true)
class ExternalPluginMenuPageService(
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val bundleUrlResolver: ExternalPluginBundleUrlResolver,
) {

    fun getMenuPages(): List<ExternalPluginMenuPageDto> {
        return configurationRepository.findAll().flatMap { configuration ->
            val definition = definitionRepository.findById(configuration.definitionId).orElse(null)
                ?: return@flatMap emptyList()
            if (definition.status != ExternalPluginDefinitionStatus.AVAILABLE) return@flatMap emptyList()

            val bundles = definition.manifestJson?.get("frontendBundles")
            if (bundles == null || !bundles.isArray) return@flatMap emptyList()

            val translations = definition.manifestJson?.get("translations")

            bundles.filter { it.get("type")?.asText() == PAGE_TYPE }.map { bundle ->
                val bundleKey = bundle.get("key")?.asText()
                val title = bundle.get("title")?.asText()
                ExternalPluginMenuPageDto(
                    configurationId = configuration.id,
                    configurationTitle = configuration.title,
                    bundleKey = bundleKey,
                    bundleUrl = bundleUrlResolver.resolve(configuration.id, PAGE_TYPE, bundleKey),
                    title = title,
                    titleTranslations = resolveTitleTranslations(translations, title),
                    icon = bundle.get("icon")?.asText(),
                )
            }
        }
    }

    /**
     * Resolves [titleKey] across every locale bucket of the manifest's `translations` block, e.g.
     * `{ en: { "page.overview.title": "Overview" } }` → `{ "en": "Overview" }`. Empty when there are
     * no translations or [titleKey] is itself a literal not present in any bucket.
     */
    private fun resolveTitleTranslations(translations: JsonNode?, titleKey: String?): Map<String, String> {
        if (translations == null || !translations.isObject || titleKey.isNullOrBlank()) return emptyMap()
        val result = linkedMapOf<String, String>()
        translations.fields().forEach { (locale, bucket) ->
            bucket.get(titleKey)?.takeIf { it.isTextual }?.let { result[locale] = it.asText() }
        }
        return result
    }

    companion object {
        private const val PAGE_TYPE = "page"
    }
}
