package com.ritense.pdca.domain

import jakarta.persistence.*
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "involved_party")
data class InvolvedParty(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "plan_id", nullable = false)
    val planId: UUID,

    @Column(nullable = false)
    var name: String,

    @Column(nullable = false)
    var role: String,

    @Column
    var email: String? = null,

    @Column
    var phone: String? = null,

    @Column
    var organization: String? = null,

    @Column(name = "is_primary", nullable = false)
    var isPrimary: Boolean = false,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
)
