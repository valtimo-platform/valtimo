package com.ritense.pdca.domain

import jakarta.persistence.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "evaluation")
data class Evaluation(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "plan_id", nullable = false)
    val planId: UUID,

    @Column(name = "eval_type", nullable = false)
    var evalType: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: EvaluationStatus = EvaluationStatus.PLANNED,

    @Column(name = "scheduled_date")
    var scheduledDate: LocalDate? = null,

    @Column(name = "actual_date")
    var actualDate: LocalDate? = null,

    @Column(columnDefinition = "TEXT")
    var summary: String? = null,

    @Column(columnDefinition = "TEXT")
    var participants: String? = null,

    @Column(name = "goal_progress", columnDefinition = "TEXT")
    var goalProgress: String? = null,

    @Column(name = "action_points", columnDefinition = "TEXT")
    var actionPoints: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
)

enum class EvaluationStatus { PLANNED, COMPLETED, CANCELLED }
