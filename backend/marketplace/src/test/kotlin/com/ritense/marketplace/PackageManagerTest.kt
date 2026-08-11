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

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class PackageManagerTest {

    @Test
    fun `should strip the qualifier from a Valtimo release version`() {
        // The version a package's `requires` is compared against must be bare semver;
        // the fourth qualifier segment Valtimo releases carry is not valid semver and
        // would make every constraint comparison fail.
        assertEquals("13.41.0", PackageManager.toSemver("13.41.0.RELEASE"))
        assertEquals("13.41.2", PackageManager.toSemver("13.41.2-SNAPSHOT"))
    }

    @Test
    fun `should keep a version that is already bare semver`() {
        assertEquals("13.41.0", PackageManager.toSemver("13.41.0"))
    }

    @Test
    fun `should complete a version that omits the patch segment`() {
        assertEquals("13.41.0", PackageManager.toSemver("13.41"))
    }

    @Test
    fun `should fall back to the unknown sentinel for an unrecognisable version`() {
        // Not a hard failure: an unexpected version string disables compatibility
        // checking rather than making every comparison throw.
        assertEquals(PackageManager.UNKNOWN_SYSTEM_VERSION, PackageManager.toSemver("RELEASE"))
        assertEquals(PackageManager.UNKNOWN_SYSTEM_VERSION, PackageManager.toSemver(""))
    }
}
