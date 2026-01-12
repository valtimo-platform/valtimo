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

import ch.qos.logback.classic.LoggerContext
import ch.qos.logback.core.spi.FilterReply
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.lang.reflect.Proxy
import java.sql.Connection
import java.sql.Driver
import java.sql.DriverManager
import java.sql.DriverPropertyInfo
import java.sql.PreparedStatement
import java.sql.SQLException
import java.util.Properties
import java.util.logging.Logger

class LogDbReadyFilterTest {
    @BeforeEach
    fun setUp() {
        LogDbReadyFilter.ready.set(false)
    }

    @Test
    fun `decide returns neutral when ready is already true`() {
        LogDbReadyFilter.ready.set(true)

        val filter = LogDbReadyFilter()

        val reply = filter.decide(null)

        assertEquals(FilterReply.NEUTRAL, reply)
    }

    @Test
    fun `decide returns neutral and marks ready when table exists`() {
        val driver = FakeDriver { fakeConnection() }
        DriverManager.registerDriver(driver)
        try {
            val filter = LogDbReadyFilter().apply {
                this.context = LoggerContext()
                this.jdbcUrl = FAKE_URL
            }

            val reply = filter.decide(null)

            assertEquals(FilterReply.NEUTRAL, reply)
            assertTrue(LogDbReadyFilter.ready.get())
        } finally {
            DriverManager.deregisterDriver(driver)
        }
    }

    @Test
    fun `decide returns deny when driver class is missing`() {
        val context = LoggerContext().apply {
            putProperty("unused", "unused")
        }
        val filter = LogDbReadyFilter().apply {
            this.context = context
            this.jdbcUrl = "jdbc:missing:db"
            this.driverClassName = "com.ritense.logging.MissingDriver"
        }

        val reply = filter.decide(null)

        assertEquals(FilterReply.DENY, reply)
        assertFalse(LogDbReadyFilter.ready.get())
    }

    private class FakeDriver(private val connectionSupplier: () -> Connection) : Driver {
        override fun acceptsURL(url: String?): Boolean {
            return url == FAKE_URL
        }

        @Throws(SQLException::class)
        override fun connect(url: String?, info: Properties?): Connection? {
            if (!acceptsURL(url)) {
                return null
            }
            return connectionSupplier()
        }

        override fun getPropertyInfo(url: String?, info: Properties?): Array<DriverPropertyInfo> {
            return emptyArray()
        }

        override fun getMajorVersion(): Int {
            return 1
        }

        override fun getMinorVersion(): Int {
            return 0
        }

        override fun jdbcCompliant(): Boolean {
            return false
        }

        @Throws(SQLException::class)
        override fun getParentLogger(): Logger {
            return Logger.getLogger("fake")
        }
    }

    private fun fakeConnection(): Connection {
        val handler = java.lang.reflect.InvocationHandler { _, method, _ ->
            when (method.name) {
                "prepareStatement" -> fakePreparedStatement()
                "close" -> null
                "isClosed" -> false
                "unwrap" -> null
                "isWrapperFor" -> false
                else -> defaultReturn(method.returnType)
            }
        }
        return Proxy.newProxyInstance(
            Connection::class.java.classLoader,
            arrayOf(Connection::class.java),
            handler
        ) as Connection
    }

    private fun fakePreparedStatement(): PreparedStatement {
        val handler = java.lang.reflect.InvocationHandler { _, method, _ ->
            when (method.name) {
                "execute" -> true
                "close" -> null
                "unwrap" -> null
                "isWrapperFor" -> false
                else -> defaultReturn(method.returnType)
            }
        }
        return Proxy.newProxyInstance(
            PreparedStatement::class.java.classLoader,
            arrayOf(PreparedStatement::class.java),
            handler
        ) as PreparedStatement
    }

    private fun defaultReturn(returnType: Class<*>): Any? {
        return when (returnType) {
            Boolean::class.javaPrimitiveType -> false
            Int::class.javaPrimitiveType -> 0
            Long::class.javaPrimitiveType -> 0L
            Void.TYPE -> null
            else -> null
        }
    }

    companion object {
        private const val FAKE_URL = "jdbc:fake:logging"
    }
}
