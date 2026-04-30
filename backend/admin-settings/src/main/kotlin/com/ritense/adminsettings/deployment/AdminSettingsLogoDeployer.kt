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

package com.ritense.adminsettings.deployment

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.adminsettings.domain.AdminSettingsLogo
import com.ritense.adminsettings.domain.LogoType
import com.ritense.adminsettings.repository.AdminSettingsLogoRepository
import com.ritense.valtimo.changelog.domain.ChangesetDeployer
import com.ritense.valtimo.changelog.domain.ChangesetDetails
import com.ritense.valtimo.changelog.service.ChangelogService
import com.ritense.valtimo.contract.media.ImageNormalizer
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.core.io.support.ResourcePatternResolver
import org.springframework.data.repository.findByIdOrNull
import java.util.Base64

class AdminSettingsLogoDeployer(
    private val objectMapper: ObjectMapper,
    private val adminSettingsLogoRepository: AdminSettingsLogoRepository,
    private val changelogService: ChangelogService,
    private val resourcePatternResolver: ResourcePatternResolver,
    private val clearTables: Boolean,
) : ChangesetDeployer {

    override fun getPath() = "classpath*:**/*.admin-settings-logo.json"

    override fun before() {
        if (clearTables) {
            adminSettingsLogoRepository.deleteAll()
            changelogService.deleteChangesetsByKey(KEY)
        }
    }

    override fun getChangelogDetails(filename: String, content: String): List<ChangesetDetails> {
        val changeset = objectMapper.readValue<AdminSettingsLogoChangeset>(content)
        return listOf(
            ChangesetDetails(
                changesetId = changeset.changesetId,
                valueToChecksum = changeset.logos,
                key = KEY,
                deploy = { deploy(changeset.logos) }
            )
        )
    }

    private fun deploy(logos: List<AdminSettingsLogoDeploymentDto>) {
        logos.forEach { logoDto ->
            val logoType = LogoType.valueOf(logoDto.logoType)
            val imageBase64 = resolveImageFile(logoDto.file)

            val existing = adminSettingsLogoRepository.findByIdOrNull(logoType)
            val entity = if (existing != null) {
                existing.imageBase64 = imageBase64
                existing
            } else {
                AdminSettingsLogo(
                    logoType = logoType,
                    imageBase64 = imageBase64
                )
            }
            adminSettingsLogoRepository.save(entity)
        }
    }

    private fun resolveImageFile(file: String): String {
        val pattern = "classpath*:**/$file"
        val resources = resourcePatternResolver.getResources(pattern)
        require(resources.isNotEmpty()) { "Logo file not found: $file (searched with pattern $pattern)" }
        val resource = resources.first()

        val bytes = resource.inputStream.use { it.readBytes() }
        val base64 = Base64.getEncoder().encodeToString(bytes)

        val lowerName = file.lowercase()
        return if (lowerName.endsWith(".svg")) {
            logger.debug { "Deploying SVG logo from $file" }
            base64
        } else {
            logger.debug { "Deploying raster logo from $file, normalizing as PNG" }
            ImageNormalizer.normalizeAndValidateImage(base64)
        }
    }

    companion object {
        private const val KEY = "admin-settings-logo"
        private val logger = KotlinLogging.logger {}
    }
}
