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

package com.ritense.buildingblock.domain.definition

import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.JoinColumns
import jakarta.persistence.Lob
import jakarta.persistence.MapsId
import jakarta.persistence.OneToOne
import jakarta.persistence.Table

@Entity
@Table(name = "building_block_definition_artwork")
open class BuildingBlockDefinitionArtwork(

    @EmbeddedId
    open var id: BuildingBlockDefinitionId? = null,

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumns(
        JoinColumn(
            name = "building_block_definition_key",
            referencedColumnName = "building_block_definition_key"
        ),
        JoinColumn(
            name = "building_block_definition_version_tag",
            referencedColumnName = "building_block_definition_version_tag"
        )
    )
    open var definition: BuildingBlockDefinition? = null,

    @Lob
    @Column(name = "image_base64", nullable = false)
    open var imageBase64: String = ""
)