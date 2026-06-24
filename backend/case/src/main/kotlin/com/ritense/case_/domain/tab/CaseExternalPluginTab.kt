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

package com.ritense.case_.domain.tab

import com.ritense.case.domain.CaseTabId
import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Table
import java.util.UUID

/**
 * Side row for a case tab of type `EXTERNAL_PLUGIN`. Holds which external-plugin configuration backs
 * the tab and (optionally) which `case-tab` bundle to render when the plugin ships more than one.
 * Shares the `case_tab` composite key and is removed `ON DELETE CASCADE` when the parent tab is
 * deleted (mirrors [CaseWidgetTab]).
 */
@Entity
@Table(name = "case_external_plugin_tab")
data class CaseExternalPluginTab(
    @EmbeddedId
    val id: CaseTabId,

    @Column(name = "external_plugin_configuration_id", nullable = false)
    val externalPluginConfigurationId: UUID,

    @Column(name = "bundle_key")
    val bundleKey: String? = null,
)
