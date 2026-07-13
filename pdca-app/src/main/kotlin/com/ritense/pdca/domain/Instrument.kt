package com.ritense.pdca.domain

import jakarta.persistence.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "instrument")
data class Instrument(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "goal_id", nullable = false)
    val goalId: UUID,

    @Column(name = "external_product_id")
    var externalProductId: String? = null,

    @Column(nullable = false)
    var title: String,

    @Column(name = "provider_name")
    var providerName: String? = null,

    @Column
    var category: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: InstrumentStatus = InstrumentStatus.PLANNED,

    @Column(name = "start_date")
    var startDate: LocalDate? = null,

    @Column(name = "end_date")
    var endDate: LocalDate? = null,

    @Column(columnDefinition = "TEXT")
    var result: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
)

enum class InstrumentStatus { PLANNED, ACTIVE, COMPLETED, CANCELLED }
