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

package com.ritense.marketplace

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import io.github.oshai.kotlinlogging.KotlinLogging
import org.pf4j.update.DefaultUpdateRepository
import org.pf4j.update.PluginInfo
import java.net.MalformedURLException
import java.net.URL

class PackageUpdateRepository(
    private val id: String,
    private val url: URL
) : DefaultUpdateRepository(id, url, "packages.json") {

    private val packages: MutableMap<String, PackageInfo> = mutableMapOf()

    // Whether the next getPlugins() must go to the network. Set false once the
    // manifest has been read so the cached map is reused: getPlugins() is called
    // for every repository on every catalogue read, and re-fetching packages.json
    // each time made listing packages an O(repositories) network round trip.
    // refresh() (pf4j's "look for new updates" hook) flips it back on.
    private var stale: Boolean = true

    override fun getPlugins(): Map<String, PluginInfo> {
        if (stale) {
            initPackages()
        }

        return packages
    }

    override fun refresh() {
        stale = true
    }

    fun getRepositories(): List<PackageUpdateRepository> {
        return try {
            val repositoriesUrl = URL(url, "repositories.json")
            logger.debug { "Read repositories of '$id' repository from '$repositoriesUrl'" }
            objectMapper.readValue<List<PackageUpdateRepository>>(repositoriesUrl)
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun initPackages() {
        // Mark fresh up front, whether or not the read succeeds: an unreachable
        // repository (e.g. a not-yet-created local package dir) must not make every
        // subsequent catalogue read retry it. Recovery happens on the next
        // scheduled or explicit refresh.
        stale = false
        val items = try {
            val packagesUrl = URL(url, pluginsJsonFileName)
            logger.debug { "Read packages of '$id' repository from '$packagesUrl'" }
            objectMapper.readValue<List<PackageInfo>>(packagesUrl)
        } catch (e: Exception) {
            packages.clear()
            return
        }

        // Replace rather than merge, so a package removed from the manifest also
        // disappears from the cached map on refresh.
        packages.clear()
        items.forEach { item ->
            item.repositoryId = getId()
            packages[item.id] = item
            item.releases.forEach { release ->
                try {
                    release.url = URL(url, release.url).toString()
                    if (release.date.time == 0L) {
                        logger.warn { "Illegal release date when parsing ${item.id}@${release.version}, setting to epoch" }
                    }
                } catch (e: MalformedURLException) {
                    logger.debug { "Skipping release ${release.version} of package ${item.id} due to failure to build valid absolute URL. Url was $url${release.url}" }
                }
            }
        }
        logger.debug("Found {} packages in repository '{}'", packages.size, id)
    }

    companion object {
        private val logger = KotlinLogging.logger {}

        // Package manifests are produced by external pipelines (e.g. the
        // extension-store) and may carry fields the PackageInfo/PluginInfo model
        // does not map (e.g. "type", "verified"). Ignore unknown properties so a
        // richer manifest doesn't fail parsing and silently yield zero packages.
        private val objectMapper = jacksonObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
    }
}