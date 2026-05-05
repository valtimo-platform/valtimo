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

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import java.util.HexFormat
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Signs outbound requests to the external plugin host with HMAC-SHA256 over a stable string
 * representation of the request: `{method}\n{path}\n{timestamp}\n{bodyHash}`.
 *
 * The plugin host is expected to validate the same construction. Compromise scope is limited to
 * an attacker who can also obtain the shared secret.
 */
@Component
@SkipComponentScan
class ExternalPluginHmacSigner(
    private val secret: String,
) {

    fun sign(method: String, path: String, timestamp: String, bodyHash: String): String {
        val mac = Mac.getInstance(ALGORITHM)
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), ALGORITHM))
        val payload = "${method.uppercase()}\n$path\n$timestamp\n$bodyHash"
        return HexFormat.of().formatHex(mac.doFinal(payload.toByteArray(Charsets.UTF_8)))
    }

    fun bodyHash(body: ByteArray): String {
        val digest = java.security.MessageDigest.getInstance("SHA-256").digest(body)
        return HexFormat.of().formatHex(digest)
    }

    companion object {
        private const val ALGORITHM = "HmacSHA256"
        const val SIGNATURE_HEADER = "X-Valtimo-Signature"
        const val TIMESTAMP_HEADER = "X-Valtimo-Timestamp"
    }
}
