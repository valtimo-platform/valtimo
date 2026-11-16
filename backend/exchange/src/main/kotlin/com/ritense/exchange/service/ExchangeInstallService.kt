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
import com.ritense.exchange.config.ExchangeProperties
import com.ritense.exchange.exception.ExchangeArtifactNotFoundException
import com.ritense.exchange.exception.ExchangeArtifactNotInstallableException
import com.ritense.exchange.exception.ExchangeDisabledException
import com.ritense.exchange.web.rest.dto.ExchangeConfigurationDto
import com.ritense.valtimo.contract.utils.SecurityUtils
import io.github.oshai.kotlinlogging.KotlinLogging
import java.util.UUID

class ExchangeInstallService(
    private val properties: ExchangeProperties,
    private val client: ExchangeClient,
) {

    fun getConfiguration() = ExchangeConfigurationDto(
        properties.enabled,
        properties.baseUrl,
        if (properties.enabled) properties.resolvedAssetOrigins else emptyList(),
    )

    fun getArtifactContent(publicationId: UUID, artifactId: UUID): Pair<String?, ByteArray> {
        if (!properties.enabled) throw ExchangeDisabledException()

        val publication = client.getPublication(publicationId)
            ?.takeIf { it.status == PUBLISHED }
            ?: throw ExchangeArtifactNotFoundException("Publication not found")
        val artifact = publication.artifacts.firstOrNull { it.id.equals(artifactId.toString(), ignoreCase = true) }
            ?: throw ExchangeArtifactNotFoundException("Artifact not found")
        if (artifact.manifestType !in INSTALLABLE_TYPES) {
            throw ExchangeArtifactNotInstallableException(
                "Artifacts of type ${artifact.manifestType} cannot be installed from the Exchange"
            )
        }

        val content = client.getArtifactContent(publicationId, artifactId)
        logger.info {
            "Exchange artifact $artifactId of publication $publicationId downloaded for install by " +
                "${SecurityUtils.getCurrentUserLogin()}"
        }
        return artifact.fileName to content
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        private const val PUBLISHED = "PUBLISHED"
        private val INSTALLABLE_TYPES = setOf("CASE_DEFINITION", "BUILDING_BLOCK")
    }
}
