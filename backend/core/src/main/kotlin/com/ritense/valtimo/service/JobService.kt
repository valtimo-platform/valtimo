package com.ritense.valtimo.service

import org.operaton.bpm.engine.delegate.DelegateExecution

interface JobService {
    fun addOffsetInMillisToTimerDueDateByActivityId(
        millisecondsToAdd: Long, activityId: String,
        execution: DelegateExecution
    )

    fun updateTimerDueDateByActivityId(
        dueDateString: String, activityId: String,
        execution: DelegateExecution
    )
}