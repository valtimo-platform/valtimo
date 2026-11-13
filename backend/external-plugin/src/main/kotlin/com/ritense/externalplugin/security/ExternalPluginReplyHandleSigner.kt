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

package com.ritense.externalplugin.security

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import java.security.MessageDigest
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.Base64
import java.util.UUID
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Signs the reply handle an action invocation carries, so a job reply can only ever be routed to the
 * process instance GZAC handed to that configuration. Deliberately not a JWT and not a
 * `SecretKeyProvider`: a handle names a reply target and must never authenticate a request.
 *
 * Format: `base64url(json).base64url(HMAC-SHA256(key, json))`, unpadded, with
 * `json = {"cfg","pi","bk","exp"}` and `key = SHA-256("<encryption-secret>|reply-handle")`.
 */
class ExternalPluginReplyHandleSigner(
    secret: String,
    private val ttl: Duration,
    private val clock: Clock = Clock.systemUTC(),
) {

    init {
        require(secret.isNotBlank()) { "valtimo.plugin.encryption-secret must not be blank" }
    }

    private val key = SecretKeySpec(
        MessageDigest.getInstance("SHA-256").digest("$secret|$DOMAIN".toByteArray(Charsets.UTF_8)),
        MAC_ALGORITHM,
    )

    fun issue(configurationId: UUID, processInstanceId: String, businessKey: String?): String {
        val claims = objectMapper.createObjectNode().apply {
            put("cfg", configurationId.toString())
            put("pi", processInstanceId)
            if (businessKey == null) putNull("bk") else put("bk", businessKey)
            put("exp", clock.instant().plus(ttl).epochSecond)
        }
        val json = objectMapper.writeValueAsBytes(claims)
        return "${encoder.encodeToString(json)}.${encoder.encodeToString(mac(json))}"
    }

    /** Null when malformed, oversized, tampered with, expired, or issued for another configuration. */
    fun verify(handle: String, configurationId: UUID): ReplyHandle? {
        if (handle.length > MAX_HANDLE_LENGTH) return null
        val parts = handle.split('.')
        if (parts.size != 2) return null
        val json = decode(parts[0]) ?: return null
        val signature = decode(parts[1]) ?: return null
        if (!MessageDigest.isEqual(mac(json), signature)) return null

        val claims = runCatching { objectMapper.readTree(json) }.getOrNull()?.takeIf { it.isObject } ?: return null
        val cfg = claims.text("cfg")?.let { runCatching { UUID.fromString(it) }.getOrNull() } ?: return null
        val processInstanceId = claims.text("pi")?.takeIf { it.isNotEmpty() } ?: return null
        val businessKeyNode = claims.get("bk")
        val businessKey = when {
            businessKeyNode == null || businessKeyNode.isNull -> null
            businessKeyNode.isTextual -> businessKeyNode.asText()
            else -> return null
        }
        val expiresAt = claims.get("exp")?.takeIf { it.isIntegralNumber && it.canConvertToLong() }
            ?.let { Instant.ofEpochSecond(it.asLong()) } ?: return null

        if (!expiresAt.isAfter(clock.instant()) || cfg != configurationId) return null
        return ReplyHandle(cfg, processInstanceId, businessKey, expiresAt)
    }

    private fun mac(bytes: ByteArray): ByteArray = Mac.getInstance(MAC_ALGORITHM).apply { init(key) }.doFinal(bytes)

    private fun decode(part: String): ByteArray? =
        if (part.isEmpty()) null else runCatching { decoder.decode(part) }.getOrNull()

    private fun JsonNode.text(field: String): String? = get(field)?.takeIf { it.isTextual }?.asText()

    data class ReplyHandle(
        val configurationId: UUID,
        val processInstanceId: String,
        val businessKey: String?,
        val expiresAt: Instant,
    )

    companion object {
        const val MAX_HANDLE_LENGTH = 4096
        private const val DOMAIN = "reply-handle"
        private const val MAC_ALGORITHM = "HmacSHA256"
        private val objectMapper = ObjectMapper()
        private val encoder = Base64.getUrlEncoder().withoutPadding()
        private val decoder = Base64.getUrlDecoder()
    }
}
