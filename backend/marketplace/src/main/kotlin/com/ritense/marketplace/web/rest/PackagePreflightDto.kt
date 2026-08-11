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

package com.ritense.marketplace.web.rest

import com.ritense.marketplace.PackageTrust
import com.ritense.marketplace.domain.PackageOperation

/**
 * What a user is told before an install or update actually happens.
 *
 * The point is that nothing irreversible is started from a bare button press: the caller
 * gets the version that will be applied, whether it can run here, whether it can be
 * undone, and what will change — and the UI refuses to proceed while [blockers] is
 * non-empty.
 */
data class PackagePreflightDto(
    val packageId: String,
    val packageName: String?,
    val type: String?,
    val trust: PackageTrust,
    /** The version that would be applied. */
    val targetVersion: String,
    val installedVersion: String?,
    /** Whether this is a re-install/upgrade over an existing installation. */
    val operation: PackageOperation,
    /** Valtimo version range the target release declares. */
    val requires: String?,
    val compatible: Boolean,
    /**
     * Whether the package can be removed again afterwards. False for config packages
     * (case / building block): the importer has no inverse, so the install is permanent.
     */
    val reversible: Boolean,
    /**
     * Whether the package becomes active without restarting Valtimo. Plugin packages are
     * loaded into the running application; config packages are imported immediately.
     */
    val hotLoadable: Boolean,
    /** Download size in bytes, when the store could tell us. Best effort. */
    val downloadSizeBytes: Long?,
    /** Reasons the operation cannot proceed. Non-empty means the UI must not offer it. */
    val blockers: List<String>,
    /** Things the user should know but which do not prevent the operation. */
    val warnings: List<String>,
)
