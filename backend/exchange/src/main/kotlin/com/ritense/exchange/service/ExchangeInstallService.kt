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

package com.ritense.exchange.service

import com.ritense.exchange.client.ExchangeClient
import com.ritense.exchange.client.dto.ExchangeArtifact
import com.ritense.exchange.client.dto.ExchangePublication
import com.ritense.exchange.config.ExchangeProperties
import com.ritense.exchange.exception.ExchangeArtifactNotFoundException
import com.ritense.exchange.exception.ExchangeArtifactNotInstallableException
import com.ritense.exchange.exception.ExchangeDisabledException
import com.ritense.exchange.web.rest.dto.ExchangeArtifactDto
import com.ritense.exchange.web.rest.dto.ExchangeArtifactType
import com.ritense.exchange.web.rest.dto.ExchangeCompatibility
import com.ritense.exchange.web.rest.dto.ExchangeDependencyDto
import com.ritense.exchange.web.rest.dto.ExchangeDependencyType
import com.ritense.exchange.web.rest.dto.ExchangeConfigurationDto
import com.ritense.exporter.manifest.ValtimoVersionResolver
import java.util.UUID

class ExchangeInstallService(
    private val properties: ExchangeProperties,
    private val client: ExchangeClient,
    private val valtimoVersionResolver: ValtimoVersionResolver,
) {

    fun getConfiguration() = ExchangeConfigurationDto(properties.enabled, properties.baseUrl)

    fun getArtifact(publicationId: UUID, artifactId: UUID): ExchangeArtifactDto {
        val (publication, artifact, type) = resolve(publicationId, artifactId)
        val running = valtimoVersionResolver.getValtimoVersion()

        return ExchangeArtifactDto(
            publicationId = publicationId,
            publicationName = publication.name,
            artifactId = artifactId,
            type = type,
            title = artifact.title,
            versionTag = artifact.versionTag,
            fileName = artifact.fileName,
            valtimoVersion = artifact.valtimoVersion,
            runningValtimoVersion = running.ifBlank { null },
            compatibility = compatibility(artifact.valtimoVersion, running),
            dependencies = artifact.dependencies.mapNotNull { dependency ->
                val dependencyType = ExchangeDependencyType.entries
                    .firstOrNull { it.name == dependency.dependencyType }
                    ?: return@mapNotNull null
                ExchangeDependencyDto(dependencyType, dependency.key, dependency.title, dependency.versionTag)
            },
        )
    }

    fun getArtifactContent(publicationId: UUID, artifactId: UUID): Pair<String?, ByteArray> {
        val (_, artifact, _) = resolve(publicationId, artifactId)
        return artifact.fileName to client.getArtifactContent(publicationId, artifactId)
    }

    private fun resolve(
        publicationId: UUID,
        artifactId: UUID,
    ): Triple<ExchangePublication, ExchangeArtifact, ExchangeArtifactType> {
        if (!properties.enabled) throw ExchangeDisabledException()

        val publication = client.getPublication(publicationId)
            ?.takeIf { it.status == PUBLISHED }
            ?: throw ExchangeArtifactNotFoundException("Publication not found")
        val artifact = publication.artifacts.firstOrNull { it.id.equals(artifactId.toString(), ignoreCase = true) }
            ?: throw ExchangeArtifactNotFoundException("Artifact not found")
        val type = ExchangeArtifactType.entries.firstOrNull { it.name == artifact.manifestType }
            ?: throw ExchangeArtifactNotInstallableException(
                "Artifacts of type ${artifact.manifestType} cannot be installed from the Exchange"
            )

        return Triple(publication, artifact, type)
    }

    companion object {
        private const val PUBLISHED = "PUBLISHED"
        private val VERSION_PATTERN = Regex("""^(\d+)(?:\.(\d+))?(?:\.(\d+))?$""")

        internal fun compatibility(artifactVersion: String?, runningVersion: String?): ExchangeCompatibility {
            val artifact = parse(artifactVersion) ?: return ExchangeCompatibility.UNKNOWN
            val running = parse(runningVersion) ?: return ExchangeCompatibility.UNKNOWN
            val newer = artifact.zip(running).firstOrNull { (a, r) -> a != r }?.let { (a, r) -> a > r } ?: false
            return if (newer) ExchangeCompatibility.NEWER else ExchangeCompatibility.COMPATIBLE
        }

        private fun parse(version: String?): List<Int>? {
            val core = version?.trim()?.substringBefore('-')?.substringBefore('+')
            if (core.isNullOrBlank()) return null
            val match = VERSION_PATTERN.matchEntire(core) ?: return null
            return match.groupValues.drop(1).map { it.toIntOrNull() ?: 0 }
        }
    }
}
