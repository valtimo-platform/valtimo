package com.ritense.pdca.domain

import jakarta.persistence.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "plan")
data class Plan(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Enumerated(EnumType.STRING)
    @Column(name = "subject_type", nullable = false)
    val subjectType: SubjectType,

    @Column(name = "subject_id", nullable = false)
    val subjectId: String,

    @Column(nullable = false)
    var title: String,

    @Column(name = "main_goal", columnDefinition = "TEXT")
    var mainGoal: String? = null,

    @Column(name = "start_situation", columnDefinition = "TEXT")
    var startSituation: String? = null,

    @Column(name = "desired_situation", columnDefinition = "TEXT")
    var desiredSituation: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: PlanStatus = PlanStatus.DRAFT,

    @Column(name = "start_date")
    var startDate: LocalDate? = null,

    @Column(name = "target_end_date")
    var targetEndDate: LocalDate? = null,

    @Column(name = "actual_end_date")
    var actualEndDate: LocalDate? = null,

    @Column(name = "case_id")
    var caseId: UUID? = null,

    @Column(name = "case_definition_key")
    var caseDefinitionKey: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "created_by")
    val createdBy: String? = null
)

enum class SubjectType { PERSON, OBJECT, FAMILY }

enum class PlanStatus { DRAFT, ACTIVE, PAUSED, COMPLETED, CANCELLED }
