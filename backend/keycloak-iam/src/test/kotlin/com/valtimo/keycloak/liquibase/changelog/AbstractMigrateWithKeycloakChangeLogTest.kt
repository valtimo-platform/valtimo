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

package com.valtimo.keycloak.liquibase.changelog

import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.springframework.mock.env.MockEnvironment

internal class AbstractMigrateWithKeycloakChangeLogTest {

    private lateinit var server: MockWebServer
    private lateinit var changeLog: TestChangeLog

    @BeforeEach
    fun setUp() {
        server = MockWebServer()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.requestLine) {
                    "POST /realms/example-realm/protocol/openid-connect/token HTTP/1.1" -> tokenResponse()
                    "GET /admin/serverinfo HTTP/1.1" -> serverInfoResponseWithUnknownFields()
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }
        server.start()

        val environment = MockEnvironment().apply {
            setProperty("keycloak.auth-server-url", server.url("/").toString())
            setProperty("keycloak.realm", "example-realm")
            setProperty("keycloak.resource", "example-resource")
            setProperty("keycloak.credentials.secret", "example-secret")
        }
        TestChangeLog().postProcessEnvironment(environment, mock())
        changeLog = TestChangeLog()
    }

    @AfterEach
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `pingKeycloak tolerates unknown fields from newer Keycloak servers`() {
        assertDoesNotThrow { changeLog.invokePing() }
    }

    private fun tokenResponse(): MockResponse = MockResponse()
        .addHeader("Content-Type", "application/json")
        .setBody(
            """
            {
                "access_token": "eyJ",
                "expires_in": 300,
                "refresh_expires_in": 0,
                "token_type": "Bearer",
                "not-before-policy": 0,
                "scope": "profile email"
            }
            """.trimIndent()
        )

    private fun serverInfoResponseWithUnknownFields(): MockResponse = MockResponse()
        .addHeader("Content-Type", "application/json")
        .setBody(
            """
            {
                "unknownTopLevelField": "value",
                "features": [
                    {
                        "name": "EXAMPLE_FEATURE",
                        "label": "Example",
                        "type": "DEFAULT",
                        "enabled": true,
                        "dependencies": [],
                        "deprecated": false
                    }
                ]
            }
            """.trimIndent()
        )

    private class TestChangeLog : AbstractMigrateWithKeycloakChangeLog() {
        fun invokePing() = pingKeycloak()
    }
}