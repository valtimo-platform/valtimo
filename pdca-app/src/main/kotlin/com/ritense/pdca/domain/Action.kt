package com.ritense.pdca.domain

import jakarta.persistence.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "action")
data class Action(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(name = "goal_id", nullable = false)
    val goalId: UUID,

    @Column(nullable = false)
    var title: String,

    @Column(columnDefinition = "TEXT")
    var description: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: ActionStatus = ActionStatus.PLANNED,

    @Enumerated(EnumType.STRING)
    @Column(name = "assignee_type")
    var assigneeType: AssigneeType? = null,

    @Column(name = "assignee_name")
    var assigneeName: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var priority: Priority = Priority.NORMAL,

    @Column(name = "start_date")
    var startDate: LocalDate? = null,

    @Column(name = "due_date")
    var dueDate: LocalDate? = null,

    @Column(name = "completed_date")
    var completedDate: LocalDate? = null,

    @Column(columnDefinition = "TEXT")
    var result: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
)

enum class ActionStatus { PLANNED, IN_PROGRESS, PENDING_REVIEW, COMPLETED, REJECTED }
enum class AssigneeType { PROFESSIONAL, SUBJECT, PROVIDER }
enum class Priority { HIGH, NORMAL, LOW }
