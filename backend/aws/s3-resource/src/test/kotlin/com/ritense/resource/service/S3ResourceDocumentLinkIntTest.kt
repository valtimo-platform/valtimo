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

package com.ritense.resource.service

import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.PermissionRepository
import com.ritense.authorization.role.Role
import com.ritense.authorization.role.RoleRepository
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.resource.BaseIntegrationTest
import com.ritense.resource.domain.ResourceId
import com.ritense.resource.domain.S3Resource
import com.ritense.resource.repository.S3ResourceRepository
import com.ritense.resource.web.rest.S3Resource as S3ResourceController
import com.ritense.valtimo.contract.config.LiquibaseRunner
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.TestingAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest
import java.net.URL
import java.time.LocalDateTime
import java.util.UUID

class S3ResourceDocumentLinkIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @Autowired
    lateinit var s3ResourceRepository: S3ResourceRepository

    @Autowired
    lateinit var controller: S3ResourceController

    @Autowired
    lateinit var liquibaseRunner: LiquibaseRunner

    @Autowired
    lateinit var transactionManager: PlatformTransactionManager

    @Autowired
    lateinit var roleRepository: RoleRepository

    @Autowired
    lateinit var permissionRepository: PermissionRepository

    private val documentIds = mutableListOf<UUID>()
    private var roleCreated = false

    @AfterEach
    fun cleanup() {
        SecurityContextHolder.clearContext()
        s3ResourceRepository.deleteAll()
        inTransaction {
            documentIds.forEach {
                jdbcTemplate.update("DELETE FROM json_schema_document WHERE json_schema_document_id = ${uuidSql()}", it.toString())
            }
        }
        documentIds.clear()
        if (roleCreated) {
            inTransaction {
                permissionRepository.findAll().filter { it.role.key == ROLE_KEY }.forEach(permissionRepository::delete)
                roleRepository.deleteByKeyIn(listOf(ROLE_KEY))
            }
            roleCreated = false
        }
    }

    @Test
    fun `backfill links resources to the document that references them`() {
        val documentA = insertDocument(relatedFiles = emptyList())
        val linkedFile = UUID.randomUUID()
        val otherLinkedFile = UUID.randomUUID()
        val unreferencedFile = UUID.randomUUID()
        val document = insertDocument(relatedFiles = listOf(linkedFile, otherLinkedFile))
        listOf(linkedFile, otherLinkedFile, unreferencedFile).forEach { save(it, createdBy = null) }
        val preLinked = save(UUID.randomUUID(), createdBy = "userA", documentId = documentA)
        insertDocument(relatedFiles = listOf(preLinked.id()))

        inTransaction {
            jdbcTemplate.update("DELETE FROM DATABASECHANGELOG WHERE ID LIKE 's3-resource-ownership-backfill%'")
        }
        liquibaseRunner.run()

        assertThat(documentIdOf(linkedFile)).isEqualTo(document)
        assertThat(documentIdOf(otherLinkedFile)).isEqualTo(document)
        assertThat(documentIdOf(unreferencedFile)).isNull()
        assertThat(documentIdOf(preLinked.id())).isEqualTo(documentA)
    }

    @Test
    fun `linked resource is denied for a user without view permission on an existing document`() {
        val document = insertDocument(relatedFiles = emptyList())
        val resource = save(UUID.randomUUID(), createdBy = "userA", documentId = document)
        loginAs("userB", "ROLE_NO_ACCESS")

        assertThrows<AccessDeniedException> { controller.get(resource.id().toString()) }
        assertThrows<AccessDeniedException> { controller.delete(resource.id().toString()) }
        assertThrows<AccessDeniedException> { s3Service.getResourceUrl(resource.key) }
        assertThrows<AccessDeniedException> { s3Service.removeResource(resource.key) }
    }

    @Test
    fun `linked resource is readable for a user with view permission on the document`() {
        val document = insertDocument(relatedFiles = emptyList())
        val resource = save(UUID.randomUUID(), createdBy = "userA", documentId = document)
        val role = roleRepository.save(Role(UUID.randomUUID(), ROLE_KEY))
        roleCreated = true
        permissionRepository.saveAndFlush(
            Permission(
                UUID.randomUUID(),
                JsonSchemaDocument::class.java,
                mutableListOf(JsonSchemaDocumentActionProvider.VIEW),
                ConditionContainer(),
                role
            )
        )
        val presigned = mock(PresignedGetObjectRequest::class.java)
        `when`(presigned.url()).thenReturn(URL("http://example.com"))
        `when`(s3Presigner.presignGetObject(any(GetObjectPresignRequest::class.java))).thenReturn(presigned)
        loginAs("userB", ROLE_KEY)

        assertThat(controller.get(resource.id().toString()).statusCode.is2xxSuccessful).isTrue()
        assertThat(s3Service.getResourceUrl(resource.key)).isNotNull()
        assertThrows<AccessDeniedException> { controller.delete(resource.id().toString()) }
        assertThrows<AccessDeniedException> { s3Service.removeResource(resource.key) }
    }

    private fun loginAs(username: String, vararg roles: String) {
        SecurityContextHolder.getContext().authentication = TestingAuthenticationToken(username, "pw", *roles)
    }

    private fun inTransaction(block: () -> Unit) {
        TransactionTemplate(transactionManager).execute { block() }
    }

    private fun isMysql() = jdbcTemplate.dataSource!!.connection.use {
        it.metaData.databaseProductName.contains("mysql", ignoreCase = true)
    }

    private fun uuidSql() = if (isMysql()) "UUID_TO_BIN(?)" else "CAST(? AS uuid)"

    private fun insertDocument(relatedFiles: List<UUID>): UUID {
        val id = UUID.randomUUID()
        val json = relatedFiles.joinToString(",", "[", "]") { """{"fileId":"$it"}""" }
        val jsonSql = if (isMysql()) "CAST(? AS JSON)" else "CAST(? AS json)"
        inTransaction { jdbcTemplate.update(
            """
            INSERT INTO json_schema_document
            (json_schema_document_id, json_document_content, document_definition_name, blueprint_type, blueprint_key,
             blueprint_version_tag, created_on, changed_on, related_files)
            VALUES (${uuidSql()}, $jsonSql, 'test-document', 'CASE', 'test-case', '1.0.0', ?, ?, $jsonSql)
            """.trimIndent(),
            id.toString(), "{}", LocalDateTime.now(), LocalDateTime.now(), json
        ) }
        documentIds.add(id)
        return id
    }

    private fun documentIdOf(resourceId: UUID): UUID? =
        s3ResourceRepository.findById(ResourceId.existingId(resourceId)).get().documentId

    private fun save(id: UUID, createdBy: String?, documentId: UUID? = null): S3Resource =
        s3ResourceRepository.saveAndFlush(
            S3Resource(
                ResourceId.newId(id),
                "bucket",
                "key-$id.txt",
                "name.txt",
                "txt",
                10L,
                LocalDateTime.now(),
                createdBy,
                documentId
            )
        )

    private companion object {
        const val ROLE_KEY = "ROLE_CASE_VIEWER"
    }
}
