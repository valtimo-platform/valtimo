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

package com.ritense.widget.map.geojson

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.valtimo.contract.annotation.AllOpen
import com.ritense.widget.pdok.client.DutchAddress
import com.ritense.widget.pdok.client.PdokLocatieserverClient
import io.github.oshai.kotlinlogging.KotlinLogging

@AllOpen
class GeoJsonDutchAddressMapper(
    private val locatieserverClient: PdokLocatieserverClient,
) : GeoJsonMapper {

    override fun supports(node: JsonNode): Boolean {
        if (!node.isObject) return false
        val address = extractDutchAddress(node)

        val hasPostcodeAndHouseNumber = address.postcode != null && address.huisnummer != null
        val hasStreetHouseNumberAndLocation = address.straatnaam != null && address.huisnummer != null &&
            (address.postcode != null || address.woonplaats != null)
        val hasStreetAndCity = address.straatnaam != null && address.woonplaats != null
        val hasPostcodeAndCity = address.postcode != null && address.woonplaats != null

        return hasPostcodeAndHouseNumber ||
            hasStreetHouseNumberAndLocation ||
            hasStreetAndCity ||
            hasPostcodeAndCity
    }

    override fun mapToFeatures(node: JsonNode): List<GeoJson.Feature> {
        val coordinates = geocode(node) ?: return emptyList()
        return listOf(
            GeoJson.Feature(
                geometry = GeoJson.Point(listOf(coordinates.first, coordinates.second)),
            )
        )
    }

    private fun geocode(node: JsonNode): Pair<Double, Double>? {
        val address = extractDutchAddress(node)
        return try {
            val response = locatieserverClient.searchAddress(address)
            val wkt = response.response.docs.firstOrNull()?.centroideLl ?: return null
            parseWkt(wkt)
        } catch (e: Exception) {
            logger.error(e) { "Failed to geocode Dutch address: $address" }
            null
        }
    }

    private fun extractDutchAddress(node: JsonNode) = DutchAddress(
        straatnaam = node.textOrNull("straatnaam"),
        huisnummer = node.numberOrTextOrNull("huisnummer"),
        huisletter = node.textOrNull("huisletter"),
        huisnummertoevoeging = node.numberOrTextOrNull("huisnummertoevoeging"),
        postcode = node.textOrNull("postcode")?.let(::normalizePostcode),
        woonplaats = node.textOrNull("woonplaats"),
    )

    private fun normalizePostcode(postcode: String): String {
        return postcode.replace(WHITESPACE_REGEX, "").uppercase()
    }

    private fun parseWkt(wkt: String): Pair<Double, Double>? {
        val match = WKT_POINT_REGEX.matchEntire(wkt.trim()) ?: return null
        val lon = match.groupValues[1].toDoubleOrNull() ?: return null
        val lat = match.groupValues[2].toDoubleOrNull() ?: return null
        return lon to lat
    }

    private fun JsonNode.textOrNull(field: String): String? {
        val value = this[field] ?: return null
        if (!value.isTextual) return null
        return value.textValue()?.trim()?.takeUnless { it.isEmpty() }
    }

    private fun JsonNode.numberOrTextOrNull(field: String): String? {
        val value = this[field] ?: return null
        return when {
            value.isNumber -> value.asText()
            value.isTextual -> value.textValue()?.trim()?.takeUnless { it.isEmpty() }
            else -> null
        }
    }

    companion object {
        private val WKT_POINT_REGEX = Regex("""POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)""")
        private val WHITESPACE_REGEX = Regex("""\s+""")
        private val logger = KotlinLogging.logger {}
    }
}
