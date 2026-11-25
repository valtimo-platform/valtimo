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

package com.ritense.zgw

import java.net.URI

object ZgwUrlValidator {

    fun isUrlUnderBaseUrl(baseUrl: URI, url: URI): Boolean {
        if (baseUrl.isOpaque || url.isOpaque) return false
        if (baseUrl.scheme == null || baseUrl.host == null || url.scheme == null || url.host == null) {
            return false
        }
        if (!baseUrl.scheme.equals(url.scheme, ignoreCase = true)) return false
        if (!baseUrl.host.equals(url.host, ignoreCase = true)) return false
        if (effectivePort(baseUrl) != effectivePort(url)) return false
        if (url.rawUserInfo != null && url.rawUserInfo != baseUrl.rawUserInfo) return false

        val path = url.path.orEmpty()
        if (path.split('/').any { it == ".." }) return false
        val normalizedPath = url.normalize().path.orEmpty()
        val basePath = baseUrl.normalize().path.orEmpty().trimEnd('/')
        return normalizedPath == basePath || normalizedPath.startsWith("$basePath/")
    }

    private fun effectivePort(uri: URI): Int = when {
        uri.port != -1 -> uri.port
        uri.scheme.equals("https", ignoreCase = true) -> 443
        uri.scheme.equals("http", ignoreCase = true) -> 80
        else -> -1
    }
}
