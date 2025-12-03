package com.ritense.buildingblock.domain.instance

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.JoinColumns
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.util.UUID

// When a process instance is created, and it's within the context of a building block instance, set the key to that
// Alternatively: Set to document instance ID, so it works the same way it works for cases.
@Entity
@Table(name = "building_block_instance")
open class BuildingBlockInstance(
    @Id
    @Column(name = "id")
    val id: UUID = UUID.randomUUID(),

    @Column(name = "building_block_document_id", nullable = false)
    val documentId: UUID,

    // TODO: if we only link to document IDs then this could be document id.
    //  This is easier for supporting nested building blocks in the future, but ideally we have
    //  case instance as well so we can use solution module instance id instead.
    @Column(name = "case_document_id", nullable = false)
    val caseDocumentId: UUID,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumns(
        JoinColumn(
            name = "building_block_definition_key",
            referencedColumnName = "building_block_definition_key",
            nullable = false
        ),
        JoinColumn(
            name = "building_block_definition_version_tag",
            referencedColumnName = "building_block_definition_version_tag",
            nullable = false
        )
    )
    open var definition: BuildingBlockDefinition
) {

}
