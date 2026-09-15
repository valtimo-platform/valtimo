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

package com.ritense.valtimo.apps

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.yaml.snakeyaml.Yaml
import java.nio.file.Files
import java.nio.file.Path

// Reads the shipped configs rather than a Spring context: the four are copies of each other, which is how db went missing from all of them.
class HealthProbeGroupsTest {

    @ParameterizedTest
    @ValueSource(strings = ["gzac", "valtimo", "evenementenvergunning", "dev"])
    fun `readiness and startup groups include the database`(app: String) {
        val groups = healthGroupsOf(app)

        assertThat(groups.keys).contains("readiness", "startup")
        listOf("readiness", "startup").forEach { group ->
            assertThat(groups.child(group)["include"].toString().split(","))
                .describedAs("%s group of the %s app", group, app)
                .contains("readinessState", "bootstrap", "db")
        }
    }

    private fun healthGroupsOf(app: String): Map<String, Any> {
        val config = Path.of(app, "src/main/resources/config/application.yml")
        assertThat(config).exists()
        val yaml: Map<String, Any> = Files.newInputStream(config).use { Yaml().load(it) }
        return yaml.child("management").child("endpoint").child("health").child("group")
    }

    @Suppress("UNCHECKED_CAST")
    private fun Map<String, Any>.child(key: String) = this[key] as Map<String, Any>
}
