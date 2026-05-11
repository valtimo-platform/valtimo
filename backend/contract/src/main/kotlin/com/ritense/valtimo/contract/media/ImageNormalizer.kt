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

package com.ritense.valtimo.contract.media

import java.awt.Graphics2D
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.Base64
import javax.imageio.ImageIO
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Shared utility for normalizing and validating base64-encoded images.
 *
 * Strips any data URI prefix, validates size and format, resizes to fit within
 * [MAX_DIMENSION]x[MAX_DIMENSION] pixels, and re-encodes as PNG.
 */
object ImageNormalizer {

    private const val MAX_MB: Int = 10
    private const val MAX_BYTES: Int = MAX_MB * 1024 * 1024
    private const val MAX_DIMENSION: Int = 1024

    /**
     * Normalizes a base64-encoded image: validates it, resizes if needed, and returns
     * a pure base64-encoded PNG string (no data URI prefix).
     *
     * @param base64 the input base64 string, optionally with a data URI prefix
     * @return a pure base64-encoded PNG string
     * @throws IllegalArgumentException if the input is invalid, too large, or unsupported
     * @throws IllegalStateException if PNG encoding fails
     */
    fun normalizeAndValidateImage(base64: String): String {
        val pureBase64 = base64.substringAfter(",", base64)
        val decoder = Base64.getDecoder()
        val originalBytes = try {
            decoder.decode(pureBase64)
        } catch (e: IllegalArgumentException) {
            throw IllegalArgumentException("Invalid base64 image data", e)
        }

        if (originalBytes.size > MAX_BYTES) {
            throw IllegalArgumentException("Image is larger than $MAX_MB MB")
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
            throw IllegalStateException("Failed to encode image as PNG")
        }

        val pngBytes = byteArrayOutputStream.toByteArray()
        if (pngBytes.size > MAX_BYTES) {
            throw IllegalArgumentException("Normalized image is larger than $MAX_MB MB")
        }

        return Base64.getEncoder().encodeToString(pngBytes)
    }
}
