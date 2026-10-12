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


package com.ritense.buildingblock.web.rest

import com.ritense.buildingblock.exception.BuildingBlockReferenceUpdateException
import com.ritense.buildingblock.exception.UnknownBuildingBlockDefinitionException
import com.ritense.buildingblock.service.referenceupdate.BuildingBlockReferenceUpdateService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.contract.web.rest.error.ExceptionTranslator
import jakarta.persistence.PersistenceException
import jakarta.persistence.RollbackException
import org.hamcrest.Matchers.containsString
import org.hamcrest.Matchers.not
import org.hibernate.exception.GenericJDBCException
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.ProcessEngineException
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.orm.jpa.JpaSystemException
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.ResultActions
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.TransactionSystemException
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean
import java.sql.SQLException
import java.util.Optional

class BuildingBlockReferenceUpdateResourceTest {

    private lateinit var service: BuildingBlockReferenceUpdateService
    private lateinit var mockMvc: MockMvc

    @BeforeEach
    fun init() {
        service = mock()
        val validator = LocalValidatorFactoryBean().apply { afterPropertiesSet() }
        mockMvc = MockMvcBuilders.standaloneSetup(BuildingBlockReferenceUpdateResource(service))
            .setMessageConverters(MappingJackson2HttpMessageConverter(MapperSingleton.get()))
            .setValidator(validator)
            .setControllerAdvice(ExceptionTranslator(Optional.empty()))
            .build()
    }

    @Test
    fun `a refused update is a bad request with its message`() {
        whenever(service.execute(any())).thenThrow(BuildingBlockReferenceUpdateException("Unknown chains selected: x."))

        execute()
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.title").value("Unknown chains selected: x."))
    }

    @Test
    fun `an unknown building block definition is not found`() {
        whenever(service.execute(any()))
            .thenThrow(UnknownBuildingBlockDefinitionException(BuildingBlockDefinitionId.of("send-email", "9.0.0")))

        execute()
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.title").value("Building block definition with id send-email:9.0.0 could not be found"))
    }

    @Test
    fun `malformed json is a bad request`() {
        execute("{ not json")
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `a request without selected chains is a bad request`() {
        execute(REQUEST.replace("[\"chain\"]", "[]"))
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `a write that violates a constraint is a conflict without database details`() {
        assertConflict(DataIntegrityViolationException("duplicate key value violates unique constraint \"pk\""))
    }

    @Test
    fun `an aborted transaction surfaced by JPA is a conflict without database details`() {
        assertConflict(JpaSystemException(PersistenceException("could not execute statement", abortedTransaction())))
    }

    @Test
    fun `a failed commit is a conflict without database details`() {
        assertConflict(TransactionSystemException("Could not commit", RollbackException("rollback", deadlock())))
    }

    @Test
    fun `a generic JDBC failure on an aborted transaction is a conflict without database details`() {
        assertConflict(GenericJDBCException("could not execute statement", abortedTransaction()))
    }

    @Test
    fun `a deployment failing on the database is a conflict without database details`() {
        assertConflict(ProcessEngineException("ENGINE-03083 Exception while executing Batch Database Operations", deadlock()))
    }

    @Test
    fun `an engine failure without a database cause is not a conflict`() {
        whenever(service.execute(any())).thenThrow(ProcessEngineException("ENGINE-01009 Error while parsing process"))

        execute().andExpect(status().isInternalServerError)
    }

    @Test
    fun `a commit failing on validation is not a conflict`() {
        whenever(service.execute(any()))
            .thenThrow(TransactionSystemException("Could not commit", RollbackException("Validation failed")))

        execute().andExpect(status().isInternalServerError)
    }

    @Test
    fun `a database programming error is not a conflict`() {
        whenever(service.execute(any()))
            .thenThrow(JpaSystemException(PersistenceException(SQLException("ERROR: syntax error at or near \"x\"", "42601"))))

        execute().andExpect(status().isInternalServerError)
    }

    @Test
    fun `other failures are not reported as a conflict`() {
        whenever(service.execute(any())).thenThrow(IllegalStateException("bug"))

        execute().andExpect(status().isInternalServerError)
    }

    private fun assertConflict(failure: RuntimeException) {
        whenever(service.execute(any())).thenThrow(failure)

        execute()
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.title").value(containsString("changed at the same time")))
            .andExpect(content().string(not(containsString("ERROR"))))
            .andExpect(content().string(not(containsString("duplicate key"))))
            .andExpect(content().string(not(containsString("ENGINE-"))))
            .andExpect(content().string(not(containsString("could not execute"))))
    }

    private fun abortedTransaction() =
        SQLException("ERROR: current transaction is aborted, commands ignored until end of transaction block", "25P02")

    private fun deadlock() = SQLException("ERROR: deadlock detected", "40P01")

    private fun execute(body: String = REQUEST): ResultActions = mockMvc.perform(
        post("/api/management/v1/building-block/reference-update/execute")
            .contentType(APPLICATION_JSON_UTF8_VALUE)
            .content(body)
    )

    private companion object {
        val REQUEST = """
            {
              "key": "send-email",
              "sourceVersionTag": "1.0.0",
              "targetVersionTag": "1.0.1",
              "selectedChainIds": ["chain"],
              "expectedFingerprint": "fingerprint"
            }
        """.trimIndent()
    }
}
