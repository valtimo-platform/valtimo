/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.extension

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import mu.KotlinLogging
import org.pf4j.update.DefaultUpdateRepository
import org.pf4j.update.PluginInfo
import java.net.MalformedURLException
import java.net.URL

class ExtensionUpdateRepository(
    private val id: String,
    private val url: URL
) : DefaultUpdateRepository(id, url, "extensions.json") {

    private val extensions: MutableMap<String, ExtensionInfo> = mutableMapOf()
    private var refresh: Boolean = true

    override fun getPlugins(): Map<String, PluginInfo> {
        if (refresh) {
            initExtensions()
        }

        return extensions
    }

    fun getRepositories(): List<ExtensionUpdateRepository> {
        return try {
            val repositoriesUrl = URL(url, "repositories.json")
            logger.debug { "Read repositories of '$id' repository from '$repositoriesUrl'" }
            jacksonObjectMapper().readValue<List<ExtensionUpdateRepository>>(repositoriesUrl)
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun initExtensions() {
        val items = try {
            val extensionsUrl = URL(url, pluginsJsonFileName)
            logger.debug { "Read extensions of '$id' repository from '$extensionsUrl'" }
            jacksonObjectMapper().readValue<List<ExtensionInfo>>(extensionsUrl)
        } catch (e: Exception) {
            extensions.clear()
            return
        }

        items.forEach { item ->
            item.releases.forEach { release ->
                item.repositoryId = getId()
                extensions[item.id] = item
                try {
                    release.url = URL(url, release.url).toString()
                    if (release.date.time == 0L) {
                        logger.warn { "Illegal release date when parsing ${item.id}@${release.version}, setting to epoch" }
                    }
                } catch (e: MalformedURLException) {
                    logger.debug { "Skipping release ${release.version} of extension ${item.id} due to failure to build valid absolute URL. Url was $url${release.url}" }
                }
            }
        }
        logger.debug("Found {} extensions in repository '{}'", extensions.size, id)
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}