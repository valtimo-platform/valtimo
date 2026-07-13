package com.ritense.pdca.domain

import jakarta.persistence.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "goal")
data class Goal(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "plan_id", nullable = false)
    val planId: UUID,

    @Column(nullable = false)
    var title: String,

    @Column(columnDefinition = "TEXT")
    var description: String? = null,

    @Column(name = "goal_type")
    var goalType: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: GoalStatus = GoalStatus.PLANNED,

    @Column(nullable = false)
    var phase: String,

    @Column(name = "start_date")
    var startDate: LocalDate? = null,

    @Column(name = "target_end_date")
    var targetEndDate: LocalDate? = null,

    @Column(name = "progress_score")
    var progressScore: Int? = null,

    @Column(name = "progress_explanation", columnDefinition = "TEXT")
    var progressExplanation: String? = null,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
)

enum class GoalStatus { PLANNED, ACTIVE, ACHIEVED, NOT_ACHIEVED, CANCELLED }
