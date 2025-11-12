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

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.databind.annotation.JsonSerialize
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.repository.SemverConverter
import com.ritense.valtimo.contract.serializer.SemverSerializer
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.OneToOne
import jakarta.persistence.Table
import org.semver4j.Semver
import org.springframework.data.annotation.CreatedBy
import org.springframework.data.annotation.CreatedDate
import java.time.LocalDateTime

@Entity
@Table(name = "building_block_definition")
open class BuildingBlockDefinition(
    @EmbeddedId
    open var id: BuildingBlockDefinitionId,

    @Column(name = "name")
    open var name: String,

    @Column(name = "description")
    open var description: String? = null,

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    @JsonIgnore
    open var createdBy: String? = null,

    @CreatedDate
    @Column(name = "created_date", updatable = false)
    @JsonIgnore
    open var createdDate: LocalDateTime? = null,

    @Convert(converter = SemverConverter::class)
    @Column(name = "based_on_version_tag", updatable = false)
    @JsonSerialize(using = SemverSerializer::class)
    open var basedOnVersionTag: Semver? = null,

    @Column(name = "is_final")
    open var final: Boolean = false
) {

    @OneToOne(
        mappedBy = "definition",
        optional = true
    )
    open var artwork: BuildingBlockDefinitionArtwork? = null

    fun toDto(): BuildingBlockDefinitionDto {
        return BuildingBlockDefinitionDto(
            key = this.id.key,
            versionTag = this.id.versionTag.toString(),
            name = this.name,
            description = this.description,
            createdBy = this.createdBy,
            createdDate = this.createdDate,
            basedOnVersionTag = this.basedOnVersionTag?.toString(),
            final = this.final
        )
    }

    fun copy(
        id: BuildingBlockDefinitionId = this.id,
        name: String = this.name,
        description: String? = this.description,
        createdBy: String? = this.createdBy,
        createdDate: LocalDateTime? = this.createdDate,
        basedOnVersionTag: Semver? = this.basedOnVersionTag,
        final: Boolean = this.final,
        artwork: BuildingBlockDefinitionArtwork? = this.artwork,
    ): BuildingBlockDefinition {
        val clone = BuildingBlockDefinition(
            id = id,
            name = name,
            description = description,
            createdBy = createdBy,
            createdDate = createdDate,
            basedOnVersionTag = basedOnVersionTag,
            final = final
        )

        if (artwork != null) {
            clone.artwork = BuildingBlockDefinitionArtwork(
                definition = clone,
                imageBase64 = artwork.imageBase64,
                id = artwork.id
            )
        }

        return clone
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false
        other as BuildingBlockDefinition
        return id == other.id
    }

    override fun hashCode(): Int = id.hashCode()

    override fun toString(): String {
        return "BuildingBlockDefinition(id=$id, name='$name', final=$final)"
    }
}