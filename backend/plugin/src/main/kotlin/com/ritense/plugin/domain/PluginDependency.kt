/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import jakarta.persistence.Column
import jakarta.persistence.Embeddable

@Embeddable
data class PluginDependency(
    @Column(name = "dependency")
    val key: String = ""
) {
    companion object {
        const val ZAAK_TYPE_LINK = "ZAAK_TYPE_LINK"
        const val ZAAK_INSTANCE_LINK = "ZAAK_INSTANCE_LINK"

        fun of(key: String) = PluginDependency(key)
    }
}