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


package com.ritense.valtimo.contract.hibernate

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.testutilscommon.junit.extension.LiquibaseRunnerExtension
import com.ritense.valtimo.contract.BaseIntegrationTest
import com.ritense.valtimo.contract.config.LiquibaseMasterChangeLogLocation
import jakarta.persistence.EntityManager
import jakarta.persistence.EntityManagerFactory
import jakarta.persistence.PersistenceContext
import org.assertj.core.api.Assertions.assertThat
import org.hibernate.SessionFactory
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID
import javax.sql.DataSource

@SpringBootTest(properties = ["spring.jpa.properties.hibernate.generate_statistics=true"])
@ExtendWith(LiquibaseRunnerExtension::class)
class JsonColumnIntTest : BaseIntegrationTest() {

    @TestConfiguration
    class JsonColumnTestLiquibaseConfiguration {
        @Bean
        fun jsonColumnTestChangeLogLocation() =
            LiquibaseMasterChangeLogLocation("config/liquibase/json-column-test-master.xml")
    }

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var transactionTemplate: TransactionTemplate

    @Autowired
    lateinit var entityManagerFactory: EntityManagerFactory

    @Autowired
    lateinit var dataSource: DataSource

    @PersistenceContext
    lateinit var entityManager: EntityManager

    private val jdbcTemplate by lazy { JdbcTemplate(dataSource) }

    private val statistics get() = entityManagerFactory.unwrap(SessionFactory::class.java).statistics

    private fun isPostgresql() = dataSource.connection.use { it.metaData.databaseProductName == "PostgreSQL" }

    @Test
    fun `every JSON field kind survives write, read and update`() {
        val id = UUID.randomUUID()
        val objectNode = objectMapper.createObjectNode().put("a", 1).put("b", "two")
        transactionTemplate.executeWithoutResult {
            entityManager.persist(
                JsonColumnTestEntity(
                    id = id,
                    objectNode = objectNode,
                    jsonMap = mutableMapOf("key" to "value", "nested" to mapOf("n" to 1)),
                    pojoList = mutableListOf(JsonPojo("first", 1, listOf("x")), JsonPojo("second", 2)),
                    pojo = JsonPojo("single", 3, listOf("y", "z")),
                    rawJson = """{"raw":true}""",
                    flag = true,
                )
            )
        }

        transactionTemplate.executeWithoutResult {
            val loaded = requireNotNull(entityManager.find(JsonColumnTestEntity::class.java, id))
            assertThat(loaded.objectNode).isEqualTo(objectNode)
            assertThat(loaded.jsonMap).containsEntry("key", "value")
            assertThat(loaded.jsonMap?.get("nested")).isEqualTo(mapOf("n" to 1))
            assertThat(loaded.pojoList).hasSize(2)
            assertThat(loaded.pojoList?.map { it.name }).containsExactly("first", "second")
            assertThat(loaded.pojoList?.first()?.tags).containsExactly("x")
            assertThat(loaded.pojo?.name).isEqualTo("single")
            assertThat(loaded.pojo?.tags).containsExactly("y", "z")
            assertThat(objectMapper.readTree(loaded.rawJson)).isEqualTo(objectMapper.readTree("""{"raw":true}"""))
            assertThat(loaded.flag).isTrue()
        }

        transactionTemplate.executeWithoutResult {
            val loaded = requireNotNull(entityManager.find(JsonColumnTestEntity::class.java, id))
            (loaded.objectNode as ObjectNode).put("c", true)
            loaded.jsonMap?.put("added", 1)
            loaded.pojoList?.add(JsonPojo("third", 3))
            loaded.pojo?.count = 99
            loaded.rawJson = """{"raw":false}"""
            loaded.flag = false
        }

        transactionTemplate.executeWithoutResult {
            val loaded = requireNotNull(entityManager.find(JsonColumnTestEntity::class.java, id))
            assertThat(loaded.objectNode?.get("c")?.asBoolean()).isTrue()
            assertThat(loaded.jsonMap).containsEntry("added", 1)
            assertThat(loaded.pojoList).hasSize(3)
            assertThat(loaded.pojo?.count).isEqualTo(99)
            assertThat(objectMapper.readTree(loaded.rawJson)).isEqualTo(objectMapper.readTree("""{"raw":false}"""))
            assertThat(loaded.flag).isFalse()
        }
    }

    @TestFactory
    fun `unchanged JSON fields do not trigger an update on flush`(): List<DynamicTest> = listOf(
        "ObjectNode" to JsonColumnTestEntity(objectNode = objectMapper.createObjectNode().put("a", 1)),
        "Map" to JsonColumnTestEntity(jsonMap = mutableMapOf("key" to "value", "nested" to mapOf("n" to 1))),
        "List of POJO" to JsonColumnTestEntity(pojoList = mutableListOf(JsonPojo("first", 1, listOf("x")))),
        "POJO" to JsonColumnTestEntity(pojo = JsonPojo("single", 3, listOf("y"))),
        "String" to JsonColumnTestEntity(rawJson = """{"raw":true}"""),
        "Boolean" to JsonColumnTestEntity(flag = true),
    ).map { (kind, entity) ->
        DynamicTest.dynamicTest(kind) {
            transactionTemplate.executeWithoutResult { entityManager.persist(entity) }

            statistics.clear()
            transactionTemplate.executeWithoutResult {
                requireNotNull(entityManager.find(JsonColumnTestEntity::class.java, entity.id))
                entityManager.flush()
            }

            assertThat(statistics.entityUpdateCount).`as`("updates for unchanged $kind").isZero()
        }
    }

    @Test
    fun `a String field mapped as JSON is stored as raw JSON and not as a quoted string`() {
        val id = UUID.randomUUID()
        transactionTemplate.executeWithoutResult {
            entityManager.persist(JsonColumnTestEntity(id = id, rawJson = """{"schema":"value"}"""))
        }

        val jsonType = if (isPostgresql()) {
            jdbcTemplate.queryForObject(
                "select jsonb_typeof(raw_json) from json_column_test where id = ?",
                String::class.java,
                id
            )
        } else {
            jdbcTemplate.queryForObject(
                "select json_type(raw_json) from json_column_test where id = ?",
                String::class.java,
                id.toBinary()
            )
        }
        assertThat(jsonType?.lowercase()).isEqualTo("object")
    }

    @Test
    fun `a json column accepts and returns JSON values`() {
        val id = UUID.randomUUID()
        val objectNode = objectMapper.createObjectNode().put("b", 1).put("a", 2)
        transactionTemplate.executeWithoutResult {
            entityManager.persist(
                JsonPlainColumnTestEntity(id = id, objectNode = objectNode, rawJson = """{"raw":true}""")
            )
        }

        transactionTemplate.executeWithoutResult {
            val loaded = requireNotNull(entityManager.find(JsonPlainColumnTestEntity::class.java, id))
            assertThat(loaded.objectNode).isEqualTo(objectNode)
            assertThat(objectMapper.readTree(loaded.rawJson)).isEqualTo(objectMapper.readTree("""{"raw":true}"""))
        }
    }

    @Test
    fun `a LONGVARCHAR field is stored in a text column`() {
        val id = UUID.randomUUID()
        val longText = "x".repeat(30_000)
        transactionTemplate.executeWithoutResult {
            entityManager.persist(JsonPlainColumnTestEntity(id = id, longText = longText))
        }

        transactionTemplate.executeWithoutResult {
            assertThat(entityManager.find(JsonPlainColumnTestEntity::class.java, id)?.longText).isEqualTo(longText)
        }
        val columnType = jdbcTemplate.queryForObject(
            "select data_type from information_schema.columns " +
                "where table_name = 'json_plain_column_test' and column_name = 'long_text'",
            String::class.java
        )
        assertThat(columnType?.lowercase()).isIn("text", "longtext")
    }

    private fun UUID.toBinary(): ByteArray {
        val buffer = java.nio.ByteBuffer.allocate(16)
        buffer.putLong(mostSignificantBits)
        buffer.putLong(leastSignificantBits)
        return buffer.array()
    }
}
