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

package com.ritense.processdocument.liquibase.changelog

import com.ritense.processdocument.BaseIntegrationTest
import java.sql.Connection
import java.sql.DriverManager
import java.sql.Timestamp
import java.time.Instant
import liquibase.database.DatabaseFactory
import liquibase.database.jvm.JdbcConnection
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.core.env.Environment

/**
 * Runs against a throwaway schema holding the tables as they stand when this changeset runs, which is before a
 * later changeset renames process_link.form_flow_definition_id and while nothing has been migrated yet.
 */
@Tag("integration")
internal class ChangeLog20250514MigrateProcessDefinitionsIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var environment: Environment

    private lateinit var connection: Connection
    private var schemaCreated = false

    // a connection of its own, not one from the shared pool, so the schema switch below cannot leak to other tests
    @BeforeEach
    fun beforeEach() {
        connection = DriverManager.getConnection(
            environment.getRequiredProperty("spring.datasource.url"),
            environment.getRequiredProperty("spring.datasource.username"),
            environment.getRequiredProperty("spring.datasource.password"),
        )
        // creating a throwaway schema needs rights the MySQL test user does not have
        assumeTrue(connection.metaData.databaseProductName.contains("postgresql", ignoreCase = true))

        connection.autoCommit = true
        connection.createStatement().use {
            it.execute("drop schema if exists $SCHEMA cascade")
            it.execute("create schema $SCHEMA")
        }
        connection.schema = SCHEMA
        createMigrationEraTables()
        schemaCreated = true
    }

    @AfterEach
    fun cleanUp() {
        if (!::connection.isInitialized || connection.isClosed) {
            return
        }
        if (schemaCreated) {
            connection.createStatement().use { it.execute("drop schema if exists $SCHEMA cascade") }
        }
        connection.close()
    }

    @Test
    fun `should link the nested process to every case its shared parent is migrated for`() {
        givenSharedParentReachedByTwoCases()

        migrate()

        assertThat(casesLinkedTo(NESTED)).containsExactlyInAnyOrder(CASE_A, CASE_B)
    }

    @Test
    fun `should clone the referenced decision for every case its shared parent is migrated for`() {
        givenSharedParentReachedByTwoCases()

        migrate()

        assertThat(decisionVersionTagsFor(DECISION))
            .contains("CD:$CASE_A:$VERSION_TAG", "CD:$CASE_B:$VERSION_TAG")
    }

    @Test
    fun `should bind both cases' parent clones to their own nested clone`() {
        givenSharedParentReachedByTwoCases()

        migrate()

        assertThat(bpmnOf(PARENT, "CD:$CASE_A:$VERSION_TAG"))
            .contains("""calledElementVersionTag="CD:$CASE_A:$VERSION_TAG"""")
        assertThat(bpmnOf(PARENT, "CD:$CASE_B:$VERSION_TAG"))
            .contains("""calledElementVersionTag="CD:$CASE_B:$VERSION_TAG"""")
    }

    @Test
    fun `should keep process definition versions unique per key`() {
        givenSharedParentReachedByTwoCases()

        migrate()

        assertThat(duplicateKeyVersionPairs("act_re_procdef")).isEmpty()
        assertThat(duplicateKeyVersionPairs("act_re_decision_def")).isEmpty()
    }

    // case-a registers the shared parent directly; case-b reaches the same parent through its own entry process
    private fun givenSharedParentReachedByTwoCases() {
        deployProcess(PARENT, callActivityTarget = NESTED, decisionRef = DECISION)
        deployProcess(ENTRY, callActivityTarget = PARENT)
        deployProcess(NESTED)
        deployDecision(DECISION)
        linkCase(CASE_A, PARENT)
        linkCase(CASE_B, ENTRY)
    }

    private fun migrate() {
        val database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(JdbcConnection(connection))
        ChangeLog20250514MigrateProcessDefinitions().execute(database)
    }

    private fun casesLinkedTo(processDefinitionKey: String): List<String> {
        val statement = connection.prepareStatement(
            """
            select pdcd.case_definition_key
            from process_definition_case_definition pdcd
            join act_re_procdef pd on pd.id_ = pdcd.process_definition_id
            where pd.key_ = ?
            """.trimIndent()
        )
        statement.setString(1, processDefinitionKey)
        return statement.executeQuery().collect { it.getString("case_definition_key") }
    }

    private fun decisionVersionTagsFor(decisionDefinitionKey: String): List<String> {
        val statement = connection.prepareStatement(
            "select version_tag_ from act_re_decision_def where key_ = ? and version_tag_ is not null"
        )
        statement.setString(1, decisionDefinitionKey)
        return statement.executeQuery().collect { it.getString("version_tag_") }
    }

    private fun bpmnOf(processDefinitionKey: String, versionTag: String): String {
        val statement = connection.prepareStatement(
            """
            select agb.bytes_
            from act_re_procdef pd
            join act_ge_bytearray agb
                on agb.deployment_id_ = pd.deployment_id_
                and agb.name_ = pd.resource_name_
            where pd.key_ = ?
            and pd.version_tag_ = ?
            """.trimIndent()
        )
        statement.setString(1, processDefinitionKey)
        statement.setString(2, versionTag)
        val results = statement.executeQuery()
        assertThat(results.next()).`as`("no $processDefinitionKey definition tagged $versionTag").isTrue()
        return String(results.getBytes("bytes_"))
    }

    private fun duplicateKeyVersionPairs(table: String): List<String> {
        val results = connection.createStatement().executeQuery(
            "select key_, version_ from $table group by key_, version_ having count(*) > 1"
        )
        return results.collect { "${it.getString("key_")}:${it.getInt("version_")}" }
    }

    private fun deployProcess(
        processDefinitionKey: String,
        callActivityTarget: String? = null,
        decisionRef: String? = null,
    ) {
        val deploymentId = "deployment-$processDefinitionKey"
        val resourceName = "$processDefinitionKey.bpmn"
        insertDeployment(deploymentId)
        insertByteArray(
            "bytearray-$processDefinitionKey",
            resourceName,
            deploymentId,
            bpmn(processDefinitionKey, callActivityTarget, decisionRef).toByteArray()
        )

        connection.prepareStatement(
            """
            insert into act_re_procdef
                (id_, rev_, category_, name_, key_, version_, deployment_id_, resource_name_, dgrm_resource_name_,
                 has_start_form_key_, suspension_state_, tenant_id_, version_tag_, history_ttl_, startable_)
            values (?, 1, 'http://bpmn.io/schema/bpmn', ?, ?, 1, ?, ?, null, false, 1, null, null, null, true)
            """.trimIndent()
        ).apply {
            setString(1, "procdef-$processDefinitionKey")
            setString(2, processDefinitionKey)
            setString(3, processDefinitionKey)
            setString(4, deploymentId)
            setString(5, resourceName)
            executeUpdate()
        }
    }

    // the changeset copies the DMN bytes without parsing them, so their content does not matter here
    private fun deployDecision(decisionDefinitionKey: String) {
        val deploymentId = "deployment-$decisionDefinitionKey"
        val resourceName = "$decisionDefinitionKey.dmn"
        insertDeployment(deploymentId)
        insertByteArray("bytearray-$decisionDefinitionKey", resourceName, deploymentId, "<dmn/>".toByteArray())

        connection.prepareStatement(
            """
            insert into act_re_decision_req_def
                (id_, rev_, category_, name_, key_, version_, deployment_id_, resource_name_, dgrm_resource_name_, tenant_id_)
            values (?, 1, null, ?, ?, 1, ?, ?, null, null)
            """.trimIndent()
        ).apply {
            setString(1, "reqdef-$decisionDefinitionKey")
            setString(2, decisionDefinitionKey)
            setString(3, "$decisionDefinitionKey-requirements")
            setString(4, deploymentId)
            setString(5, resourceName)
            executeUpdate()
        }

        connection.prepareStatement(
            """
            insert into act_re_decision_def
                (id_, rev_, category_, name_, key_, version_, deployment_id_, resource_name_, dgrm_resource_name_,
                 dec_req_id_, dec_req_key_, tenant_id_, history_ttl_, version_tag_)
            values (?, 1, null, ?, ?, 1, ?, ?, null, ?, ?, null, null, null)
            """.trimIndent()
        ).apply {
            setString(1, "decisiondef-$decisionDefinitionKey")
            setString(2, decisionDefinitionKey)
            setString(3, decisionDefinitionKey)
            setString(4, deploymentId)
            setString(5, resourceName)
            setString(6, "reqdef-$decisionDefinitionKey")
            setString(7, "$decisionDefinitionKey-requirements")
            executeUpdate()
        }
    }

    private fun insertDeployment(deploymentId: String) {
        connection.prepareStatement(
            "insert into act_re_deployment (id_, name_, deploy_time_, source_, tenant_id_) values (?, ?, ?, ?, null)"
        ).apply {
            setString(1, deploymentId)
            setString(2, "gzacApplication")
            setTimestamp(3, Timestamp.from(Instant.now()))
            setString(4, "test")
            executeUpdate()
        }
    }

    private fun insertByteArray(id: String, resourceName: String, deploymentId: String, bytes: ByteArray) {
        connection.prepareStatement(
            """
            insert into act_ge_bytearray
                (id_, rev_, name_, deployment_id_, bytes_, generated_, tenant_id_, type_, create_time_,
                 root_proc_inst_id_, removal_time_)
            values (?, 1, ?, ?, ?, false, null, 0, ?, null, null)
            """.trimIndent()
        ).apply {
            setString(1, id)
            setString(2, resourceName)
            setString(3, deploymentId)
            setBytes(4, bytes)
            setTimestamp(5, Timestamp.from(Instant.now()))
            executeUpdate()
        }
    }

    private fun linkCase(caseDefinitionKey: String, processDefinitionKey: String) {
        connection.prepareStatement(
            """
            insert into camunda_process_json_schema_document_definition
                (document_definition_name, camunda_process_definition_key, document_definition_version,
                 can_initialize_document, startable_by_user)
            values (?, ?, 1, true, true)
            """.trimIndent()
        ).apply {
            setString(1, caseDefinitionKey)
            setString(2, processDefinitionKey)
            executeUpdate()
        }
    }

    private fun createMigrationEraTables() {
        connection.createStatement().use {
            it.execute(
                """
                create table act_re_deployment (
                    id_ varchar(64) primary key, name_ varchar(255), deploy_time_ timestamp,
                    source_ varchar(255), tenant_id_ varchar(64)
                )
                """.trimIndent()
            )
            it.execute(
                """
                create table act_ge_bytearray (
                    id_ varchar(64) primary key, rev_ integer, name_ varchar(255), deployment_id_ varchar(64),
                    bytes_ bytea, generated_ boolean, tenant_id_ varchar(64), type_ integer,
                    create_time_ timestamp, root_proc_inst_id_ varchar(64), removal_time_ timestamp
                )
                """.trimIndent()
            )
            it.execute(
                """
                create table act_re_procdef (
                    id_ varchar(64) primary key, rev_ integer, category_ varchar(255), name_ varchar(255),
                    key_ varchar(255) not null, version_ integer not null, deployment_id_ varchar(64),
                    resource_name_ varchar(4000), dgrm_resource_name_ varchar(4000), has_start_form_key_ boolean,
                    suspension_state_ integer, tenant_id_ varchar(64), version_tag_ varchar(64),
                    history_ttl_ integer, startable_ boolean not null default true
                )
                """.trimIndent()
            )
            it.execute(
                """
                create table act_re_decision_def (
                    id_ varchar(64) primary key, rev_ integer, category_ varchar(255), name_ varchar(255),
                    key_ varchar(255) not null, version_ integer not null, deployment_id_ varchar(64),
                    resource_name_ varchar(4000), dgrm_resource_name_ varchar(4000), dec_req_id_ varchar(64),
                    dec_req_key_ varchar(255), tenant_id_ varchar(64), history_ttl_ integer,
                    version_tag_ varchar(64)
                )
                """.trimIndent()
            )
            it.execute(
                """
                create table act_re_decision_req_def (
                    id_ varchar(64) primary key, rev_ integer, category_ varchar(255), name_ varchar(255),
                    key_ varchar(255) not null, version_ integer not null, deployment_id_ varchar(64),
                    resource_name_ varchar(4000), dgrm_resource_name_ varchar(4000), tenant_id_ varchar(64)
                )
                """.trimIndent()
            )
            it.execute(
                """
                create table process_link (
                    id uuid primary key, process_definition_id varchar(64), activity_id varchar(255),
                    activity_type varchar(255), process_link_type varchar(255), component_key varchar(255),
                    form_definition_id uuid, view_model_enabled boolean, form_display_type varchar(255),
                    form_size varchar(255), subtitles json, action_properties json,
                    plugin_configuration_id uuid, plugin_action_definition_key varchar(255),
                    form_flow_definition_id varchar(512), migration_form_name varchar(255)
                )
                """.trimIndent()
            )
            it.execute("create table form_io_form_definition (id uuid primary key, name varchar(255))")
            it.execute(
                """
                create table process_definition_case_definition (
                    process_definition_id varchar(64), case_definition_key varchar(255),
                    case_definition_version_tag varchar(255), can_initialize_document boolean,
                    startable_by_user boolean
                )
                """.trimIndent()
            )
            it.execute(
                """
                create table camunda_process_json_schema_document_definition (
                    document_definition_name varchar(50), camunda_process_definition_key varchar(64),
                    document_definition_version bigint, can_initialize_document boolean, startable_by_user boolean
                )
                """.trimIndent()
            )
        }
    }

    private fun bpmn(processDefinitionKey: String, callActivityTarget: String?, decisionRef: String?): String {
        val callActivity = callActivityTarget?.let {
            """<bpmn:callActivity id="call-$it" calledElement="$it" />"""
        } ?: ""
        val businessRuleTask = decisionRef?.let {
            """<bpmn:businessRuleTask id="rule-$it" operaton:decisionRef="$it" />"""
        } ?: ""
        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                              xmlns:operaton="http://operaton.org/schema/1.0/bpmn"
                              id="Definitions_$processDefinitionKey"
                              targetNamespace="http://bpmn.io/schema/bpmn">
              <bpmn:process id="$processDefinitionKey" name="$processDefinitionKey" isExecutable="true">
                <bpmn:startEvent id="start" />
                $callActivity
                $businessRuleTask
                <bpmn:endEvent id="end" />
              </bpmn:process>
            </bpmn:definitions>
        """.trimIndent()
    }

    private fun <T> java.sql.ResultSet.collect(read: (java.sql.ResultSet) -> T): List<T> {
        val values = mutableListOf<T>()
        while (next()) {
            values.add(read(this))
        }
        return values
    }

    companion object {
        private const val SCHEMA = "migrate_process_definitions_test"
        private const val PARENT = "parent-process"
        private const val ENTRY = "entry-process"
        private const val NESTED = "nested-process"
        private const val DECISION = "shared-decision"
        private const val CASE_A = "case-a"
        private const val CASE_B = "case-b"
        private const val VERSION_TAG = "0.1.0-migrated"
    }
}
