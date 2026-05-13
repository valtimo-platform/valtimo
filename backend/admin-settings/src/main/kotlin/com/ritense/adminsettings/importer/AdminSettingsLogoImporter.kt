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

package com.ritense.adminsettings.importer

import com.ritense.adminsettings.domain.AdminSettingsLogo
import com.ritense.adminsettings.domain.LogoType
import com.ritense.adminsettings.repository.AdminSettingsLogoRepository
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.ADMIN_SETTINGS_LOGO
import com.ritense.valtimo.contract.media.ImageNormalizer
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.repository.findByIdOrNull
import org.springframework.transaction.annotation.Transactional
import java.util.Base64

@Transactional
class AdminSettingsLogoImporter(
    private val adminSettingsLogoRepository: AdminSettingsLogoRepository,
) : Importer {

    override fun type(): String = ADMIN_SETTINGS_LOGO

    override fun dependsOn(): Set<String> = emptySet()

    override fun supports(fileName: String): Boolean = fileName.matches(FILENAME_REGEX)

    override fun partOfCaseDefinition(): Boolean = false

    override fun partOfBuildingBlockDefinition(): Boolean = false

    override fun import(request: ImportRequest) {
        val logoType = resolveLogoType(request.fileName)
        val base64 = Base64.getEncoder().encodeToString(request.content)

        val imageBase64 = if (request.fileName.lowercase().endsWith(".svg")) {
            logger.debug { "Importing SVG logo from ${request.fileName}" }
            base64
        } else {
            logger.debug { "Importing raster logo from ${request.fileName}, normalizing as PNG" }
            ImageNormalizer.normalizeAndValidateImage(base64)
        }

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

    private fun resolveLogoType(fileName: String): LogoType {
        val name = fileName.substringAfterLast('/')
        return if (name.startsWith("logo-dark-mode")) {
            LogoType.LOGO_DARK_MODE
        } else {
            LogoType.LOGO
        }
    }

    companion object {
        val FILENAME_REGEX = """/global/admin-settings/logo(?:-dark-mode)?\.(svg|png)""".toRegex()
        private val logger = KotlinLogging.logger {}
    }
}
