package com.ritense.valtimo.service

interface TimerService {
    fun updateActiveTimers(
        businessKey: String,
        newDate: String,
    ): Int

    fun updateActiveTimers(
        businessKey: String,
        newDate: String,
        vararg activityIds: String,
    ): Int
}