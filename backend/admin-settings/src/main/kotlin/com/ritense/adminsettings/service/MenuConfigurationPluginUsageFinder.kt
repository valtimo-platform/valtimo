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

package com.ritense.adminsettings.service

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.plugin.MenuPagePluginUsage
import com.ritense.valtimo.contract.plugin.MenuPagePluginUsageFinder
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Reports the `plugin-page` menu nodes that reference a plugin configuration, so the plugin delete
 * guards can refuse to delete a configuration a live menu page is built on.
 *
 * [com.ritense.adminsettings.domain.MenuConfiguration] documents the menu JSON as opaque and
 * frontend-owned, and the backend never interprets its structure. This guard is the single,
 * deliberate exception: it reads only `kind`, `configurationId`, `title` and `bundleKey`, ignores
 * everything else, and never rejects a document it doesn't understand. The alternative is a delete
 * that silently leaves a dangling menu item behind.
 */
@Service
@SkipComponentScan
@Transactional(readOnly = true)
class MenuConfigurationPluginUsageFinder(
    private val menuConfigurationService: MenuConfigurationService,
) : MenuPagePluginUsageFinder {

    override fun findUsages(configurationId: UUID): List<MenuPagePluginUsage> {
        val root = menuConfigurationService.getMenuConfiguration().configuration
        if (!root.isObject) return emptyList()

        val usages = mutableListOf<MenuPagePluginUsage>()
        // Explicit work queue rather than recursion: the document is frontend-owned and only bounded
        // by MenuConfigurationService.MAX_CONFIGURATION_LENGTH, so a pathologically deep menu must
        // not be able to overflow the stack on the delete path.
        val queue = ArrayDeque<JsonNode>()
        queue.addAll(childrenOf(root))
        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            if (!node.isObject) continue
            queue.addAll(childrenOf(node))
            if (node.get(KIND_FIELD)?.asText() != PLUGIN_PAGE_KIND) continue
            val nodeConfigurationId = parseConfigurationIdOrNull(node) ?: continue
            if (nodeConfigurationId != configurationId) continue
            usages += MenuPagePluginUsage(
                configurationId = nodeConfigurationId,
                title = node.get(TITLE_FIELD)?.takeIf { it.isTextual }?.asText(),
                bundleKey = node.get(BUNDLE_KEY_FIELD)?.takeIf { it.isTextual }?.asText(),
            )
        }
        return usages
    }

    /** Both nesting keys the persisted menu uses: top-level `items` and a group's `children`. */
    private fun childrenOf(node: JsonNode): List<JsonNode> {
        return CHILD_FIELDS.flatMap { field ->
            node.get(field)?.takeIf { it.isArray }?.toList() ?: emptyList()
        }
    }

    /**
     * Tolerant by design, like `CaseExternalPluginTabService`'s content-key parsing: a `plugin-page`
     * node with a missing or non-UUID `configurationId` is logged and skipped. The menu JSON is
     * written by the frontend and never validated backend-side, so a malformed node must not be able
     * to break deleting an unrelated configuration.
     */
    private fun parseConfigurationIdOrNull(node: JsonNode): UUID? {
        val raw = node.get(CONFIGURATION_ID_FIELD)?.takeIf { it.isTextual }?.asText()
        if (raw.isNullOrBlank()) {
            logger.warn { "Skipping '$PLUGIN_PAGE_KIND' menu node without a '$CONFIGURATION_ID_FIELD'" }
            return null
        }
        return try {
            UUID.fromString(raw)
        } catch (e: IllegalArgumentException) {
            logger.warn(e) {
                "Skipping '$PLUGIN_PAGE_KIND' menu node: '$CONFIGURATION_ID_FIELD' is not a UUID"
            }
            null
        }
    }

    companion object {
        private const val PLUGIN_PAGE_KIND = "plugin-page"
        private const val KIND_FIELD = "kind"
        private const val CONFIGURATION_ID_FIELD = "configurationId"
        private const val TITLE_FIELD = "title"
        private const val BUNDLE_KEY_FIELD = "bundleKey"
        private val CHILD_FIELDS = listOf("items", "children")
        private val logger = KotlinLogging.logger {}
    }
}
