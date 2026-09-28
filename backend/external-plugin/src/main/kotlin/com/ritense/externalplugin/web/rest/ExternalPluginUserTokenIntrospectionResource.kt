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

package com.ritense.externalplugin.web.rest

import com.ritense.externalplugin.security.ExternalPluginUserPrincipal
import com.ritense.externalplugin.security.ExternalPluginUserTokenKeyProvider
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import io.jsonwebtoken.Jwts
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.util.UUID

/**
 * Introspection endpoint for external-plugin **user** tokens. The plugin host calls it before
 * executing Wasm for its public `/data` route: the host cannot validate the HS256 token locally
 * (the signing key never leaves GZAC), so it presents the token here (`Authorization: Bearer
 * <userToken>`) and learns whether GZAC accepts it — and for **which** configuration.
 *
 * The caller authenticates *with the token under introspection*: [ExternalPluginUserTokenFilter]
 * has already verified the signature, type claim and expiry before this resource runs. The
 * resource therefore only echoes the token's own claims back (subject, configuration id, expiry)
 * — it reads nothing else, so a caller learns nothing it did not already hold. Any other
 * authenticated principal (an interactive Keycloak user, a plugin service token) is rejected:
 * introspection is only meaningful for user tokens.
 */
@Controller
@SkipComponentScan
@RequestMapping("/api/v1/external-plugin", produces = [APPLICATION_JSON_UTF8_VALUE])
class ExternalPluginUserTokenIntrospectionResource(
    keyProvider: ExternalPluginUserTokenKeyProvider,
) {

    private val parser = Jwts.parser().verifyWith(keyProvider.signingKey).build()

    @EndpointDescription(
        en = "Introspect the presented external plugin user token",
        nl = "Het aangeboden externe-plugin gebruikerstoken introspecteren",
    )
    @GetMapping("/user-token/introspect")
    fun introspect(): ResponseEntity<IntrospectionResponse> {
        val authentication = SecurityContextHolder.getContext().authentication
        val principal = authentication?.principal as? ExternalPluginUserPrincipal
            ?: throw ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Introspection is only available for external plugin user tokens",
            )

        // The recognising filter stores the raw JWT as the authentication's credentials; the expiry
        // is not part of the principal, so it is read from the (already-verified) token itself.
        val token = authentication.credentials as? String
            ?: throw ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Introspection is only available for external plugin user tokens",
            )
        val expiresAt = parser.parseSignedClaims(token).payload.expiration.toInstant()

        return ResponseEntity.ok(
            IntrospectionResponse(
                subject = principal.userLogin,
                configurationId = principal.pluginConfigId,
                expiresAt = expiresAt,
            )
        )
    }

    data class IntrospectionResponse(
        val subject: String,
        val configurationId: UUID,
        val expiresAt: Instant,
    )
}
