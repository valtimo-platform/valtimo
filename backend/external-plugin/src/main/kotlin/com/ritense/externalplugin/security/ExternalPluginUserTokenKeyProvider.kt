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

/**
 * JWT signing key for external-plugin **user** tokens. Derived from
 * `valtimo.plugin.encryption-secret` with the `user` domain suffix (see
 * [ExternalPluginTokenKeyProvider]), giving user tokens a key of their own — distinct from the
 * service-token key — so the two token kinds are cryptographically separated, not merely
 * separated by the `type` claim.
 *
 * Unlike the service token, a user token is **not** a system credential: it carries the logged-in
 * user's login and roles so GZAC runs normal PBAC against them. Endpoint reach is further intersected
 * with the plugin configuration's granted-endpoint allowlist (see [ExternalPluginEndpointAllowlistFilter]).
 */
class ExternalPluginUserTokenKeyProvider(secret: String) :
    ExternalPluginTokenKeyProvider(secret, DOMAIN) {

    override val tokenType: String = TOKEN_TYPE

    companion object {
        const val TYPE_CLAIM = ExternalPluginTokenKeyProvider.TYPE_CLAIM
        const val TOKEN_TYPE = "external_plugin_user"
        private const val DOMAIN = "user"
    }
}
