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

package com.ritense.plugin.domain

import org.assertj.core.api.Assertions.assertThat
import org.hibernate.boot.MetadataSources
import org.hibernate.boot.registry.StandardServiceRegistryBuilder
import org.hibernate.cfg.AvailableSettings
import org.hibernate.dialect.PostgreSQLDialect
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.hibernate.boot.registry.StandardServiceRegistry

/**
 * Verifies that Hibernate accepts the shared [PluginConfigurationReference] embeddable — mapping
 * columns `reference_type` / `plugin_definition_key` / `plugin_definition_version` — being embedded
 * by *two* single-table-inheritance siblings of `process_link`: [PluginProcessLink] (existing) and a
 * stand-in for the planned `ExternalPluginProcessLink` rework ([StiSpikeExternalPluginProcessLink]
 * below, a minimal local copy so this test does not depend on the not-yet-changed real entity).
 *
 * `buildSessionFactory()` (not just `buildMetadata()`) is exercised — no DataSource/connection is
 * opened, `hibernate.dialect` is set explicitly so boot does not try to auto-detect one from a
 * (non-existent) connection — because building the mapping model / persisters is where Hibernate
 * 6 actually validates column consistency, not metadata collection alone.
 *
 * Result: mapping the same three columns from the same embeddable on both STI siblings builds
 * cleanly — Hibernate does not consider this a conflict, because the two entities never both
 * populate the same row (discriminated by `process_link_type`); the embeddable is simply reused as
 * a value type on each. This was cross-checked with two negative controls during the spike (not
 * committed, since they'd otherwise permanently fail the build):
 *   - Mapping `reference_type` a second time as a plain column *within the same entity* (alongside
 *     the embeddable) → Hibernate does throw: `MappingException: Column 'reference_type' is
 *     duplicated in mapping for entity ...`. This confirms genuine duplicate-column mappings within
 *     one entity are still caught, i.e. the harness is not silently permissive by construction.
 *   - Mapping `reference_type` as a `String` on one sibling while [PluginConfigurationReference]
 *     maps it as an enum on another sibling → still no error. Hibernate does not cross-validate
 *     column types between sibling STI subclasses at boot; that would only surface against a real
 *     schema (`hbm2ddl.auto=validate`) or at query/flush time for whichever subclass mismaps it.
 *     Not a concern here because both `PluginProcessLink` and the reworked `ExternalPluginProcessLink`
 *     will map the *same* embeddable type with *identical* column definitions — there is no
 *     divergence to catch.
 *
 * Conclusion: the shared-column design in D1 is safe to implement as specified. The plan's fallback
 * (distinct external column names, e.g. `external_plugin_reference_type`) is **not needed**.
 */
class PluginConfigurationReferenceStiSpikeTest {

    private var registry: StandardServiceRegistry? = null

    @AfterEach
    fun tearDown() {
        registry?.let { StandardServiceRegistryBuilder.destroy(it) }
    }

    @Test
    fun `two STI siblings can both embed PluginConfigurationReference on the shared columns`() {
        registry = StandardServiceRegistryBuilder()
            .applySetting(AvailableSettings.DIALECT, PostgreSQLDialect::class.java.name)
            // No JDBC connection is opened for buildMetadata(); this only avoids Hibernate
            // trying (and failing) to reach out to a ConnectionProvider for dialect resolution.
            .applySetting(AvailableSettings.CONNECTION_PROVIDER_DISABLES_AUTOCOMMIT, "false")
            .build()

        val metadataSources = MetadataSources(registry)
            .addAnnotatedClass(com.ritense.processlink.domain.ProcessLink::class.java)
            .addAnnotatedClass(PluginProcessLink::class.java)
            .addAnnotatedClass(StiSpikeExternalPluginProcessLink::class.java)

        val metadata = metadataSources.buildMetadata()
        // buildSessionFactory (not just buildMetadata) triggers the persister/mapping-model build,
        // which is where Hibernate 6 actually validates per-table column consistency across STI
        // subclasses (buildMetadata alone does not).
        val sessionFactory = metadata.buildSessionFactory()
        sessionFactory.close()

        val processLinkBinding = metadata.getEntityBinding("com.ritense.processlink.domain.ProcessLink")
        assertThat(processLinkBinding).isNotNull

        // Both siblings' persistent classes exist and Hibernate could resolve the shared columns
        // without throwing — the true assertion is that buildSessionFactory() above did not raise.
        assertThat(metadata.getEntityBinding(PluginProcessLink::class.java.name)).isNotNull
        assertThat(metadata.getEntityBinding(StiSpikeExternalPluginProcessLink::class.java.name)).isNotNull
    }
}
