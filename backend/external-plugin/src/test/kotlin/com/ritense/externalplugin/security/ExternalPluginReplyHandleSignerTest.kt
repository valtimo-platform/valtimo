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

import com.ritense.valtimo.contract.security.jwt.provider.SecretKeyProvider
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.security.MessageDigest
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.Base64
import java.util.UUID
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * The reply handle's wire format is shared with the plugin host and SDK, so it is recomputed here
 * with a plain JDK HMAC over the spec'd key derivation rather than with the signer itself.
 */
class ExternalPluginReplyHandleSignerTest {

    private val secret = "abcdefghijklmnop"
    private val clock = MutableClock(Instant.parse("2026-10-15T10:00:00Z"))
    private val signer = ExternalPluginReplyHandleSigner(secret, Duration.ofDays(1), clock)
    private val configurationId = UUID.randomUUID()

    @Test
    fun `a handle round-trips the process instance and case it was issued for`() {
        val handle = signer.issue(configurationId, "pi-1", "case-1")

        val verified = signer.verify(handle, configurationId)

        assertThat(verified).isEqualTo(
            ExternalPluginReplyHandleSigner.ReplyHandle(configurationId, "pi-1", "case-1", clock.instant().plus(Duration.ofDays(1)))
        )
    }

    @Test
    fun `a handle without a case carries a null business key`() {
        val handle = signer.issue(configurationId, "pi-1", null)

        assertThat(signer.verify(handle, configurationId)!!.businessKey).isNull()
        assertThat(String(decode(handle.substringBefore('.')))).contains("\"bk\":null")
    }

    @Test
    fun `the handle is base64url json dot base64url hmac, unpadded, keyed from the encryption secret`() {
        val handle = signer.issue(configurationId, "pi-1", "case-1")

        val (json, signature) = handle.split('.')
        assertThat(handle).doesNotContain("=", "+", "/")
        assertThat(String(decode(json))).isEqualTo(
            """{"cfg":"$configurationId","pi":"pi-1","bk":"case-1","exp":${clock.instant().plus(Duration.ofDays(1)).epochSecond}}"""
        )
        assertThat(decode(signature)).isEqualTo(hmac(decode(json)))
    }

    @Test
    fun `a handle is only valid for the configuration it was issued to`() {
        val handle = signer.issue(configurationId, "pi-1", "case-1")

        assertThat(signer.verify(handle, UUID.randomUUID())).isNull()
    }

    @Test
    fun `a tampered payload or signature is refused`() {
        val handle = signer.issue(configurationId, "pi-1", "case-1")
        val (json, signature) = handle.split('.')
        val forged = encode(String(decode(json)).replace("pi-1", "pi-2").toByteArray())

        assertThat(signer.verify("$forged.$signature", configurationId)).isNull()
        assertThat(signer.verify("$json.${encode(ByteArray(32))}", configurationId)).isNull()
    }

    @Test
    fun `a handle signed with another secret is refused`() {
        val other = ExternalPluginReplyHandleSigner("another-secret-value", Duration.ofDays(1), clock)

        assertThat(signer.verify(other.issue(configurationId, "pi-1", null), configurationId)).isNull()
    }

    @Test
    fun `an expired handle is refused`() {
        val handle = signer.issue(configurationId, "pi-1", null)

        clock.advance(Duration.ofDays(1).minusSeconds(1))
        assertThat(signer.verify(handle, configurationId)).isNotNull()
        clock.advance(Duration.ofSeconds(1))
        assertThat(signer.verify(handle, configurationId)).isNull()
    }

    @Test
    fun `malformed and oversized handles are refused`() {
        val handle = signer.issue(configurationId, "pi-1", null)
        val validlySignedGarbage = "not json".toByteArray().let { "${encode(it)}.${encode(hmac(it))}" }
        val validlySignedWrongTypes = """{"cfg":"$configurationId","pi":7,"bk":null,"exp":"soon"}""".toByteArray()
            .let { "${encode(it)}.${encode(hmac(it))}" }

        listOf(
            "",
            ".",
            "no-dot",
            "$handle.extra",
            "!!!.???",
            handle.substringBefore('.') + ".",
            validlySignedGarbage,
            validlySignedWrongTypes,
            handle + "A".repeat(ExternalPluginReplyHandleSigner.MAX_HANDLE_LENGTH),
        ).forEach { candidate ->
            assertThat(signer.verify(candidate, configurationId)).describedAs(candidate.take(40)).isNull()
        }
    }

    @Test
    fun `a handle can never authenticate a request`() {
        assertThat(SecretKeyProvider::class.java.isAssignableFrom(ExternalPluginReplyHandleSigner::class.java)).isFalse()
        assertThat(signer.issue(configurationId, "pi-1", null).split('.')).hasSize(2)
    }

    private fun hmac(bytes: ByteArray): ByteArray {
        val key = MessageDigest.getInstance("SHA-256").digest("$secret|reply-handle".toByteArray(Charsets.UTF_8))
        return Mac.getInstance("HmacSHA256").apply { init(SecretKeySpec(key, "HmacSHA256")) }.doFinal(bytes)
    }

    private fun encode(bytes: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)

    private fun decode(part: String): ByteArray = Base64.getUrlDecoder().decode(part)

    private class MutableClock(private var now: Instant) : Clock() {
        fun advance(duration: Duration) {
            now = now.plus(duration)
        }

        override fun instant(): Instant = now
        override fun getZone(): ZoneId = ZoneOffset.UTC
        override fun withZone(zone: ZoneId?): Clock = this
    }
}
