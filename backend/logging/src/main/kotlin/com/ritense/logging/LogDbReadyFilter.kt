/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.logging

import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.filter.Filter
import ch.qos.logback.core.spi.FilterReply
import java.sql.DriverManager
import java.sql.SQLException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

class LogDbReadyFilter : Filter<ILoggingEvent>() {
    private val lastCheck = AtomicLong(0)

    var jdbcUrl: String? = null
    var username: String? = null
    var password: String? = null
    var driverClassName: String? = null

    override fun decide(event: ILoggingEvent?): FilterReply {
        if (ready.get()) {
            return FilterReply.NEUTRAL
        }

        val now = System.currentTimeMillis()
        val previous = lastCheck.get()
        if (now - previous < CHECK_INTERVAL_MS) {
            return FilterReply.DENY
        }
        if (!lastCheck.compareAndSet(previous, now)) {
            return FilterReply.DENY
        }

        if (tableExists()) {
            ready.set(true)
            return FilterReply.NEUTRAL
        }

        return FilterReply.DENY
    }

    private fun tableExists(): Boolean {
        val url = jdbcUrl ?: return false
        val user = username ?: ""
        val pass = password ?: ""
        val driver = driverClassName

        if (!driver.isNullOrBlank()) {
            try {
                Class.forName(driver)
            } catch (_: ClassNotFoundException) {
                return false
            }
        }

        return try {
            DriverManager.getConnection(url, user, pass).use { conn ->
                conn.prepareStatement("select 1 from logging_event where 1=0").use { stmt ->
                    stmt.execute()
                }
            }
            true
        } catch (_: SQLException) {
            false
        }
    }

    companion object {
        private const val CHECK_INTERVAL_MS = 5000L
        val ready = AtomicBoolean(false)
    }
}
