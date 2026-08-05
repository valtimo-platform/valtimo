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

package com.ritense.buildingblock.processlink

import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink.Companion.SECONDARY_TABLE_NAME
import com.ritense.processlink.domain.ProcessLink
import org.hibernate.boot.MetadataSources
import org.hibernate.boot.registry.StandardServiceRegistryBuilder
import org.junit.jupiter.api.Test
import kotlin.test.assertFalse

/**
 * Version-independent guard for the JSONB/integer bug.
 *
 * [BuildingBlockProcessLink] stores its JSONB columns on an `@SecondaryTable`. If that secondary row
 * is mapped as *optional* (Hibernate's default), Hibernate writes it with a native PostgreSQL `MERGE`
 * (upsert) on PostgreSQL 15+, which renders the JSONB columns as `cast(? as integer)` and fails with
 * "column ... is of type jsonb but expression is of type integer".
 *
 * The end-to-end reproduction only fails on PostgreSQL 15+ (native MERGE), so this test asserts the
 * underlying mapping invariant directly and deterministically on any database: the secondary row must
 * be non-optional so Hibernate uses a plain INSERT/UPDATE instead of the MERGE upsert.
 */
class BuildingBlockProcessLinkMappingTest {

    @Test
    fun `building block process link secondary row must be non-optional to avoid the MERGE upsert`() {
        val registry = StandardServiceRegistryBuilder()
            .applySetting("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect")
            .build()

        try {
            val metadata = MetadataSources(registry)
                .addAnnotatedClass(ProcessLink::class.java)
                .addAnnotatedClass(BuildingBlockProcessLink::class.java)
                .buildMetadata()

            val persistentClass = metadata.getEntityBinding(BuildingBlockProcessLink::class.java.name)
            val secondaryRow = persistentClass.joins.single {
                it.table.name.equals(SECONDARY_TABLE_NAME, ignoreCase = true)
            }

            assertFalse(
                secondaryRow.isOptional,
                "The '$SECONDARY_TABLE_NAME' secondary row must be non-optional (@SecondaryRow(optional = false)); " +
                    "otherwise Hibernate writes its JSONB columns via a MERGE upsert that fails on PostgreSQL 15+."
            )
        } finally {
            StandardServiceRegistryBuilder.destroy(registry)
        }
    }
}
