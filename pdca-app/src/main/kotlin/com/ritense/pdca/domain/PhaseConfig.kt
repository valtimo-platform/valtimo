package com.ritense.pdca.domain

import jakarta.persistence.*
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "phase_config")
data class PhaseConfig(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "case_definition_key", nullable = false, unique = true)
    val caseDefinitionKey: String,

    @Column(nullable = false, columnDefinition = "TEXT")
    var phases: String,

    @Column(name = "evaluation_types", nullable = false, columnDefinition = "TEXT")
    var evaluationTypes: String,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
)
