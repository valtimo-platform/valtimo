/*
 * Copyright 2020 Dimpact.
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

package com.ritense.documentenapiwopi.domain

import com.fasterxml.jackson.annotation.JsonProperty

/**
 * Represents the WOPI access token and expiration time that can be used to access the WOPI endpoints.
 */
data class WopiAccessToken (
    /**
     * The Short-lived access token that can be used to access the WOPI endpoints.
     */
    @JsonProperty("access_token")
    val accessToken: String,

    /**
     * The expiration time of the access token in seconds since the Unix epoch.
     */
    @JsonProperty("access_token_expires_at")
    val expiresAt: Long
)