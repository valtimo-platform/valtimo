/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.buildingblock.service

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinitionArtwork
import com.ritense.buildingblock.exception.UnknownBuildingBlockDefinitionException
import com.ritense.buildingblock.repository.BuildingBlockDefinitionArtworkRepository
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionArtworkDto
import com.ritense.buildingblock.web.rest.dto.CreateBuildingBlockDefinitionArtworkDto
import com.ritense.buildingblock.web.rest.dto.UpdateBuildingBlockDefinitionArtworkDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.awt.Graphics2D
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.Base64
import javax.imageio.ImageIO
import kotlin.math.min
import kotlin.math.roundToInt

@Service
class BuildingBlockDefinitionArtworkService(
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val buildingBlockDefinitionArtworkRepository: BuildingBlockDefinitionArtworkRepository
) {

    @Transactional(readOnly = true)
    fun getArtwork(key: String, versionTag: String): BuildingBlockDefinitionArtworkDto? {
        val id = BuildingBlockDefinitionId(key, versionTag)
        val artwork = buildingBlockDefinitionArtworkRepository.findByIdOrNull(id) ?: return null

        return BuildingBlockDefinitionArtworkDto(
            key = artwork.id.key,
            versionTag = artwork.id.versionTag.toString(),
            imageBase64 = artwork.imageBase64
        )
    }

    @Transactional
    fun createArtwork(
        key: String,
        versionTag: String,
        dto: CreateBuildingBlockDefinitionArtworkDto
    ): BuildingBlockDefinitionArtworkDto {
        val id = BuildingBlockDefinitionId(key, versionTag)

        val definition = buildingBlockDefinitionRepository.findByIdOrNull(id)
            ?: throw UnknownBuildingBlockDefinitionException(id)

        if (buildingBlockDefinitionArtworkRepository.existsById(id)) {
            throw IllegalStateException("Artwork already exists for building block definition $key:$versionTag")
        }

        val normalizedBase64 = normalizeAndValidateImage(dto.imageBase64)

        val entity = BuildingBlockDefinitionArtwork(
            id = id,
            definition = definition,
            imageBase64 = normalizedBase64
        )

        val saved = buildingBlockDefinitionArtworkRepository.save(entity)

        return BuildingBlockDefinitionArtworkDto(
            key = saved.id.key,
            versionTag = saved.id.versionTag.toString(),
            imageBase64 = saved.imageBase64
        )
    }

    @Transactional
    fun updateArtwork(
        key: String,
        versionTag: String,
        dto: UpdateBuildingBlockDefinitionArtworkDto
    ): BuildingBlockDefinitionArtworkDto {
        val id = BuildingBlockDefinitionId(key, versionTag)

        val existing = buildingBlockDefinitionArtworkRepository.findByIdOrNull(id)
            ?: throw IllegalStateException("No artwork found for building block definition $key:$versionTag")

        val normalizedBase64 = normalizeAndValidateImage(dto.imageBase64)

        existing.imageBase64 = normalizedBase64

        val saved = buildingBlockDefinitionArtworkRepository.save(existing)

        return BuildingBlockDefinitionArtworkDto(
            key = saved.id.key,
            versionTag = saved.id.versionTag.toString(),
            imageBase64 = saved.imageBase64
        )
    }

    @Transactional
    fun deleteArtwork(key: String, versionTag: String) {
        val id = BuildingBlockDefinitionId(key, versionTag)
        if (buildingBlockDefinitionArtworkRepository.existsById(id)) {
            buildingBlockDefinitionArtworkRepository.deleteById(id)
        }
    }

    private fun normalizeAndValidateImage(base64: String): String {
        val decoder = Base64.getDecoder()
        val originalBytes = try {
            decoder.decode(base64)
        } catch (e: IllegalArgumentException) {
            throw IllegalArgumentException("Invalid base64 image data", e)
        }

        if (originalBytes.size > MAX_BYTES) {
            throw IllegalArgumentException("Artwork image is larger than $MAX_MB MB")
        }

        val inputStream = ByteArrayInputStream(originalBytes)
        val originalImage = ImageIO.read(inputStream)
            ?: throw IllegalArgumentException("Unsupported or invalid image format")

        val width = originalImage.width
        val height = originalImage.height

        val scale = min(
            MAX_DIMENSION.toDouble() / width.toDouble(),
            MAX_DIMENSION.toDouble() / height.toDouble()
        ).coerceAtMost(1.0)

        val targetWidth = (width * scale).roundToInt().coerceAtLeast(1)
        val targetHeight = (height * scale).roundToInt().coerceAtLeast(1)

        val resizedImage: BufferedImage =
            if (targetWidth == width && targetHeight == height) {
                originalImage
            } else {
                val tmp = BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_ARGB)
                val g2d: Graphics2D = tmp.createGraphics()
                g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR)
                g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY)
                g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
                g2d.drawImage(originalImage, 0, 0, targetWidth, targetHeight, null)
                g2d.dispose()
                tmp
            }

        val byteArrayOutputStream = ByteArrayOutputStream()
        val wrote = ImageIO.write(resizedImage, "png", byteArrayOutputStream)
        if (!wrote) {
            throw IllegalStateException("Failed to encode artwork as PNG")
        }

        val pngBytes = byteArrayOutputStream.toByteArray()
        if (pngBytes.size > MAX_BYTES) {
            throw IllegalArgumentException("Normalized artwork image is larger than $MAX_MB MB")
        }

        return Base64.getEncoder().encodeToString(pngBytes)
    }

    companion object {
        private const val MAX_MB: Int = 10
        private const val MAX_BYTES: Int = MAX_MB * 1024 * 1024
        private const val MAX_DIMENSION: Int = 1024
    }
}