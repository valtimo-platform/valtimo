/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.marketplace

/**
 * How much a package's origin is trusted.
 *
 * Deliberately derived by the host from the source repository owner rather than read
 * from the store's manifest: a manifest field would let a store vouch for itself.
 */
enum class PackageTrust {
    /** Built from a repository owned by a configured trusted organisation. */
    VERIFIED,

    /** Has a known source repository, but outside the trusted organisations. */
    COMMUNITY,

    /** No source repository known, so the origin cannot be established at all. */
    UNKNOWN,
}

/**
 * Resolves [PackageTrust] from a package's `projectUrl`.
 */
class PackageTrustResolver(
    trustedOrganizations: List<String>,
) {
    // Compared case-insensitively: GitHub owners are case-insensitive, and a manifest
    // written by hand may not match the configured casing.
    private val trustedOwners: Set<String> = trustedOrganizations.map { it.lowercase() }.toSet()

    fun resolve(projectUrl: String?): PackageTrust {
        val owner = ownerOf(projectUrl) ?: return PackageTrust.UNKNOWN
        return if (owner in trustedOwners) PackageTrust.VERIFIED else PackageTrust.COMMUNITY
    }

    /**
     * The owner segment of a source repository URL, e.g. `valtimo-platform` for
     * `https://github.com/valtimo-platform/freemarker-plugin`. Returns null when the URL
     * is absent or carries no owner segment, which is reported as [PackageTrust.UNKNOWN]
     * rather than silently treated as untrusted-but-known.
     */
    fun ownerOf(projectUrl: String?): String? {
        val url = projectUrl?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return OWNER_PATTERN.find(url)?.groupValues?.get(1)?.lowercase()?.takeIf { it.isNotEmpty() }
    }

    companion object {
        // Matches the owner in a github URL, tolerating the `orgs/` form and an ssh-style
        // `git@github.com:owner/name` remote.
        private val OWNER_PATTERN = Regex("""github\.com[:/]+(?:orgs/)?([^/\s]+)""", RegexOption.IGNORE_CASE)
    }
}
