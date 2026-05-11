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

import com.ritense.adminsettings.domain.AdminSettingsLogo
import com.ritense.adminsettings.domain.LogoType
import com.ritense.adminsettings.repository.AdminSettingsLogoRepository
import com.ritense.adminsettings.web.rest.dto.AdminSettingsLogoDto
import com.ritense.adminsettings.web.rest.dto.AdminSettingsLogosDto
import com.ritense.adminsettings.web.rest.dto.CreateAdminSettingsLogoDto
import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.valtimo.contract.media.ImageNormalizer
import org.springframework.data.repository.findByIdOrNull
import org.springframework.transaction.annotation.Transactional
import java.util.Base64

open class AdminSettingsLogoService(
    private val adminSettingsLogoRepository: AdminSettingsLogoRepository,
    private val authorizationService: AuthorizationService,
) {

    companion object {
        private const val MAX_MB = 10
        private const val MAX_BYTES = MAX_MB * 1024 * 1024
    }

    @Transactional(readOnly = true)
    open fun getLogos(): AdminSettingsLogosDto {
        val all = adminSettingsLogoRepository.findAll()
        val logoMap = all.associateBy { it.logoType }

        return AdminSettingsLogosDto(
            logo = logoMap[LogoType.LOGO]?.toDto(),
            logoDarkMode = logoMap[LogoType.LOGO_DARK_MODE]?.toDto()
        )
    }

    @Transactional(readOnly = true)
    open fun getLogo(logoType: LogoType): AdminSettingsLogoDto? {
        return adminSettingsLogoRepository.findByIdOrNull(logoType)?.toDto()
    }

    @Transactional
    open fun uploadLogo(logoType: LogoType, dto: CreateAdminSettingsLogoDto): AdminSettingsLogoDto {
        denyAuthorization()

        val validatedBase64 = validateAndNormalizeImage(dto.imageBase64)

        val existing = adminSettingsLogoRepository.findByIdOrNull(logoType)
        val entity = if (existing != null) {
            existing.imageBase64 = validatedBase64
            existing
        } else {
            AdminSettingsLogo(
                logoType = logoType,
                imageBase64 = validatedBase64
            )
        }

        val saved = adminSettingsLogoRepository.save(entity)
        return saved.toDto()
    }

    @Transactional
    open fun deleteLogo(logoType: LogoType) {
        denyAuthorization()

        if (adminSettingsLogoRepository.existsById(logoType)) {
            adminSettingsLogoRepository.deleteById(logoType)
        }
    }

    private fun validateAndNormalizeImage(base64: String): String {
        val pureBase64 = base64.substringAfter(",", base64)
        val bytes = try {
            Base64.getDecoder().decode(pureBase64)
        } catch (e: IllegalArgumentException) {
            throw IllegalArgumentException("Invalid base64 image data", e)
        }

        require(bytes.size <= MAX_BYTES) { "Image is larger than $MAX_MB MB" }

        return if (isSvg(bytes)) {
            pureBase64
        } else {
            ImageNormalizer.normalizeAndValidateImage(pureBase64)
        }
    }

    private fun isSvg(bytes: ByteArray): Boolean {
        val header = String(bytes, 0, minOf(bytes.size, 256), Charsets.UTF_8).trimStart()
        return header.startsWith("<?xml") || header.startsWith("<svg")
    }

    private fun denyAuthorization() {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                AdminSettingsLogo::class.java,
                Action.deny()
            )
        )
    }

    private fun AdminSettingsLogo.toDto(): AdminSettingsLogoDto {
        return AdminSettingsLogoDto(
            logoType = logoType.name,
            imageBase64 = imageBase64
        )
    }
}
