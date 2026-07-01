/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.processlink.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.domain.ProcessDocumentDefinitionRequest
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.BaseIntegrationTest
import com.ritense.processlink.domain.ActivityTypeWithEventName.SERVICE_TASK_START
import com.ritense.processlink.domain.TestProcessLink
import com.ritense.processlink.domain.TestProcessLinkCreateRequestDto
import com.ritense.processlink.domain.TestProcessLinkUpdateRequestDto
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers.hasSize
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.semver4j.Semver
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext
import java.io.ByteArrayInputStream
import java.nio.charset.StandardCharsets
import java.util.UUID
import kotlin.test.assertEquals


@Transactional
internal class ProcessLinkResourceIT @Autowired constructor(
    private val webApplicationContext: WebApplicationContext,
    private val processLinkRepository: ProcessLinkRepository,
    private val operatonProcessService: OperatonProcessService,
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    private val repositoryService: RepositoryService,
) : BaseIntegrationTest() {

    lateinit var mockMvc: MockMvc

    @BeforeEach
    fun init() {
        mockMvc = MockMvcBuilders
            .webAppContextSetup(this.webApplicationContext)
            .build()
    }

    @Test
    fun `should create a process-link`() {
        val createDto = TestProcessLinkCreateRequestDto(
            processDefinitionId = PROCESS_DEF_ID,
            activityId = ACTIVITY_ID,
            activityType = SERVICE_TASK_START
        )

        mockMvc.perform(
            post("/api/v1/process-link")
                .content(ObjectMapper().writeValueAsString(createDto))
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isNoContent)
    }

    @Test
    fun `should create a process-link without processLinkType`() {
        val createDto = TestProcessLinkCreateRequestDto(
            processDefinitionId = PROCESS_DEF_ID,
            activityId = ACTIVITY_ID,
            activityType = SERVICE_TASK_START
        )
        val objectMapper = ObjectMapper()
        val jsonNode = objectMapper.valueToTree<ObjectNode>(createDto)
        jsonNode.remove("processLinkType")
        val body = objectMapper.writeValueAsString(jsonNode)

        mockMvc.perform(
            post("/api/v1/process-link")
                .content(body)
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isNoContent)
    }

    @Test
    fun `should list process-links`() {
        createProcessLink()

        mockMvc.perform(
            get("/api/v1/process-link")
                .param("processDefinitionId", PROCESS_DEF_ID)
                .param("activityId", ACTIVITY_ID)
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$").isNotEmpty)
            .andExpect(jsonPath("$").isArray)
            .andExpect(jsonPath("$.*", hasSize<Int>(1)))
    }

    @Test
    fun `should update a process-link`() {
        val processLinkId = createProcessLink()

        val updateDto = TestProcessLinkUpdateRequestDto(
            id = processLinkId
        )

        mockMvc.perform(
            put("/api/v1/process-link")
                .content(ObjectMapper().writeValueAsString(updateDto))
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isNoContent)
    }

    @Test
    fun `should export process-links`() {
        mockMvc.perform(
            get("/api/v1/process-link/export")
                .param("processDefinitionKey", "auto-deploy-process-link-with-long-key")
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$").isNotEmpty)
            .andExpect(jsonPath("$").isArray)
            .andExpect(jsonPath("$[0].activityId").value("my-service-task"))
            .andExpect(jsonPath("$[0].activityType").value("bpmn:ServiceTask:start"))
            .andExpect(jsonPath("$[0].processLinkType").value("test"))
            .andExpect(jsonPath("$[0].someValue").value("changed"))
    }

    @Test
    fun `should get the processes for a case definition`() {
        val caseDefinitionId = CaseDefinitionId("autodeploy", "1.0.0")
        val bpmnFile =
            """
        <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                     xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL BPMN20.xsd"
                     targetNamespace="http://camunda.org/examples">
            <process id="test-process-2" name="Test Process 2">
                <startEvent id="start" />
                <endEvent id="end" />
            </process>
        </definitions>
        """.trimIndent().toByteArray()

        runWithoutAuthorization {
            // deplot process
            operatonProcessService.deploy(caseDefinitionId, "test-process.bpmn", ByteArrayInputStream(bpmnFile))

            val procdef = operatonProcessService.getProcessDefinition("test-process-2")

            // add process links
            processLinkRepository.save(TestProcessLink(UUID.randomUUID(), procdef.id, "start", SERVICE_TASK_START))

            processDefinitionCaseDefinitionService.createProcessDocumentDefinition(
                ProcessDocumentDefinitionRequest(
                    processDefinitionId = ProcessDefinitionId(procdef.id),
                    caseDefinitionId = caseDefinitionId,
                    canInitializeDocument = true,
                    startableByUser = true
                )
            )
        }

        mockMvc.perform(
            get("/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/process-definition", "autodeploy", "1.0.0")
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
        .andDo(print())
        .andExpect(status().isOk)
        .andExpect(content().contentType(ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE))
        .andExpect(jsonPath("$").isArray)
        .andExpect(jsonPath("$[5].processDefinition.id").isNotEmpty())
        .andExpect(jsonPath("$[5].processDefinition.key").value("test-process-2"))
        .andExpect(jsonPath("$[5].processDefinition.name").value("Test Process 2"))
        .andExpect(jsonPath("$[5].processDefinition.versionTag").value("CD:autodeploy:1.0.0"))
        .andExpect(jsonPath("$[5].processCaseLink.id.caseDefinitionId.key").value("autodeploy"))
        .andExpect(jsonPath("$[5].processCaseLink.id.caseDefinitionId.versionTag").value("1.0.0"))
        .andExpect(jsonPath("$[5].processCaseLink.canInitializeDocument").value(true))
        .andExpect(jsonPath("$[5].processCaseLink.startableByUser").value(true))
        .andExpect(jsonPath("$[5].processLinks").isArray)
        .andExpect(jsonPath("$[5].processLinks[0].activityId").value("start"))
        .andExpect(jsonPath("$[5].processLinks[0].activityType").value("bpmn:ServiceTask:start"))
        .andExpect(jsonPath("$[5].processLinks[0].processLinkType").value("test"))
        .andExpect(jsonPath("$[5].bpmn20Xml").isNotEmpty)
    }

    @Test
    fun `should deploy process definition and process links`() {
        val bpmnFile = MockMultipartFile(
            "file",
            "test-process.bpmn",
            MediaType.APPLICATION_XML_VALUE,
            """
        <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                     xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL BPMN20.xsd"
                     targetNamespace="http://camunda.org/examples">
            <process id="test-process" name="Test Process">
                <startEvent id="start" />
                <endEvent id="end" />
            </process>
        </definitions>
        """.trimIndent().toByteArray()
        )

        val processLinks = listOf(
            TestProcessLinkCreateRequestDto(
                processDefinitionId = "test-process",
                activityId = "start",
                activityType = SERVICE_TASK_START
            )
        )

        val processLinksJson = ObjectMapper().writeValueAsString(processLinks)

        mockMvc.perform(
            MockMvcRequestBuilders.multipart("/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/process-definition", "autodeploy", "1.0.0")
                .file(bpmnFile)
                .file(
                    MockMultipartFile(
                        "processLinks",
                        "processLinks.json",
                        MediaType.APPLICATION_JSON_VALUE,
                        processLinksJson.toByteArray()
                    )
                )
                .param("processDefinitionId", PROCESS_DEF_ID)
                .param("canInitializeDocument", "true")
                .param("startableByUser", "true")
                .contentType(MediaType.MULTIPART_FORM_DATA_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isNoContent)

        runWithoutAuthorization {
            val deployedProcess = operatonProcessService.getProcessDefinition("test-process")
            assertEquals("CD:autodeploy:1.0.0", deployedProcess?.versionTag)

            val procdef = operatonProcessService.getProcessDefinition("test-process")
            val processCaseLink = processDefinitionCaseDefinitionService.findByProcessDefinitionId(ProcessDefinitionId(procdef.id))

            assertEquals("autodeploy", processCaseLink.id.caseDefinitionId.key)
            assertEquals(Semver("1.0.0"), processCaseLink.id.caseDefinitionId.versionTag)
        }
    }

    @Test
    fun `should deploy non-executable process definition as suspended`() {
        val bpmnXml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                          xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                          xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                          xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                          xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                          id="Definitions_1"
                          targetNamespace="http://bpmn.io/schema/bpmn">
            <bpmn:process id="non-exec-process" name="Non Executable Process" isExecutable="false">
                <bpmn:startEvent id="StartEvent_1">
                    <bpmn:outgoing>Flow_1</bpmn:outgoing>
                </bpmn:startEvent>
                <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Activity_1" />
                <bpmn:endEvent id="EndEvent_1">
                    <bpmn:incoming>Flow_2</bpmn:incoming>
                </bpmn:endEvent>
                <bpmn:sequenceFlow id="Flow_2" sourceRef="Activity_1" targetRef="EndEvent_1" />
                <bpmn:userTask id="Activity_1" name="Unconfigured User Task">
                    <bpmn:incoming>Flow_1</bpmn:incoming>
                    <bpmn:outgoing>Flow_2</bpmn:outgoing>
                </bpmn:userTask>
            </bpmn:process>
        </bpmn:definitions>
        """.trimIndent()

        val bpmnFile = MockMultipartFile(
            "file",
            "non-exec-process.bpmn",
            MediaType.APPLICATION_XML_VALUE,
            bpmnXml.toByteArray()
        )

        val processLinksJson = ObjectMapper().writeValueAsString(emptyList<Any>())

        mockMvc.perform(
            MockMvcRequestBuilders.multipart(
                "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/process-definition",
                "autodeploy", "1.0.0"
            )
                .file(bpmnFile)
                .file(
                    MockMultipartFile(
                        "processLinks",
                        "processLinks.json",
                        MediaType.APPLICATION_JSON_VALUE,
                        processLinksJson.toByteArray()
                    )
                )
                .param("canInitializeDocument", "true")
                .param("startableByUser", "true")
                .contentType(MediaType.MULTIPART_FORM_DATA_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isNoContent)

        runWithoutAuthorization {
            val deployedProcess = operatonProcessService.getProcessDefinition("non-exec-process")
            assertEquals(true, deployedProcess.isSuspended())
        }
    }

    @Test
    fun `should return isExecutable false in BPMN XML for suspended definition`() {
        val bpmnXml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                          xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                          id="Definitions_1"
                          targetNamespace="http://bpmn.io/schema/bpmn">
            <bpmn:process id="suspended-process" name="Suspended Process" isExecutable="false">
                <bpmn:startEvent id="StartEvent_1">
                    <bpmn:outgoing>Flow_1</bpmn:outgoing>
                </bpmn:startEvent>
                <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Activity_1" />
                <bpmn:endEvent id="EndEvent_1">
                    <bpmn:incoming>Flow_2</bpmn:incoming>
                </bpmn:endEvent>
                <bpmn:sequenceFlow id="Flow_2" sourceRef="Activity_1" targetRef="EndEvent_1" />
                <bpmn:userTask id="Activity_1" name="Unconfigured User Task">
                    <bpmn:incoming>Flow_1</bpmn:incoming>
                    <bpmn:outgoing>Flow_2</bpmn:outgoing>
                </bpmn:userTask>
            </bpmn:process>
        </bpmn:definitions>
        """.trimIndent()

        val bpmnFile = MockMultipartFile(
            "file",
            "suspended-process.bpmn",
            MediaType.APPLICATION_XML_VALUE,
            bpmnXml.toByteArray()
        )

        val processLinksJson = ObjectMapper().writeValueAsString(emptyList<Any>())

        mockMvc.perform(
            MockMvcRequestBuilders.multipart(
                "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/process-definition",
                "autodeploy", "1.0.0"
            )
                .file(bpmnFile)
                .file(
                    MockMultipartFile(
                        "processLinks",
                        "processLinks.json",
                        MediaType.APPLICATION_JSON_VALUE,
                        processLinksJson.toByteArray()
                    )
                )
                .param("canInitializeDocument", "true")
                .param("startableByUser", "true")
                .contentType(MediaType.MULTIPART_FORM_DATA_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andExpect(status().isNoContent)

        val result = mockMvc.perform(
            get(
                "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/process-definition",
                "autodeploy", "1.0.0"
            )
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andReturn()

        val responseBody = result.response.contentAsString
        val objectMapper = ObjectMapper()
        val definitions = objectMapper.readTree(responseBody)
        val suspendedDef = definitions.find { it.get("processDefinition").get("key").asText() == "suspended-process" }

        assertThat(suspendedDef).isNotNull
        val bpmnXmlContent = suspendedDef!!.get("bpmn20Xml").asText()
        assertThat(bpmnXmlContent).contains("isExecutable=\"false\"")
        assertThat(bpmnXmlContent).doesNotContain("isExecutable=\"true\"")
    }

    @Test
    fun `should reject executable process definition with missing start event`() {
        val bpmnXml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                          xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                          id="Definitions_1"
                          targetNamespace="http://bpmn.io/schema/bpmn">
            <bpmn:process id="exec-invalid-process" name="Executable Invalid Process" isExecutable="true">
                <bpmn:endEvent id="EndEvent_1">
                    <bpmn:incoming>Flow_1</bpmn:incoming>
                </bpmn:endEvent>
                <bpmn:sequenceFlow id="Flow_1" sourceRef="Activity_1" targetRef="EndEvent_1" />
                <bpmn:userTask id="Activity_1" name="Orphan Task">
                    <bpmn:outgoing>Flow_1</bpmn:outgoing>
                </bpmn:userTask>
            </bpmn:process>
        </bpmn:definitions>
        """.trimIndent()

        val bpmnFile = MockMultipartFile(
            "file",
            "exec-invalid-process.bpmn",
            MediaType.APPLICATION_XML_VALUE,
            bpmnXml.toByteArray()
        )

        val processLinksJson = ObjectMapper().writeValueAsString(emptyList<Any>())

        mockMvc.perform(
            MockMvcRequestBuilders.multipart(
                "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/process-definition",
                "autodeploy", "1.0.0"
            )
                .file(bpmnFile)
                .file(
                    MockMultipartFile(
                        "processLinks",
                        "processLinks.json",
                        MediaType.APPLICATION_JSON_VALUE,
                        processLinksJson.toByteArray()
                    )
                )
                .param("canInitializeDocument", "true")
                .param("startableByUser", "true")
                .contentType(MediaType.MULTIPART_FORM_DATA_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isUnprocessableEntity)
            .andExpect(jsonPath("$.errors").isArray)
            .andExpect(jsonPath("$.errors[0].elementType").value("Process"))
            .andExpect(jsonPath("$.errors[0].reason").value("Process has no start event"))
    }

    @Test
    fun `should replace suspended process definition when redeploying non-executable process`() {
        val processLinksJson = ObjectMapper().writeValueAsString(emptyList<Any>())

        val firstBpmnXml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                          xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                          id="Definitions_1"
                          targetNamespace="http://bpmn.io/schema/bpmn">
            <bpmn:process id="redeploy-process" name="Redeploy Process" isExecutable="false">
                <bpmn:startEvent id="StartEvent_1">
                    <bpmn:outgoing>Flow_1</bpmn:outgoing>
                </bpmn:startEvent>
                <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="EndEvent_1" />
                <bpmn:endEvent id="EndEvent_1">
                    <bpmn:incoming>Flow_1</bpmn:incoming>
                </bpmn:endEvent>
            </bpmn:process>
        </bpmn:definitions>
        """.trimIndent()

        mockMvc.perform(
            MockMvcRequestBuilders.multipart(
                "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/process-definition",
                "autodeploy", "1.0.0"
            )
                .file(MockMultipartFile("file", "redeploy-process.bpmn", MediaType.APPLICATION_XML_VALUE, firstBpmnXml.toByteArray()))
                .file(MockMultipartFile("processLinks", "processLinks.json", MediaType.APPLICATION_JSON_VALUE, processLinksJson.toByteArray()))
                .param("canInitializeDocument", "true")
                .param("startableByUser", "true")
                .contentType(MediaType.MULTIPART_FORM_DATA_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andExpect(status().isNoContent)

        val secondBpmnXml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                          xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                          id="Definitions_1"
                          targetNamespace="http://bpmn.io/schema/bpmn">
            <bpmn:process id="redeploy-process" name="Redeploy Process Modified" isExecutable="false">
                <bpmn:startEvent id="StartEvent_1">
                    <bpmn:outgoing>Flow_1</bpmn:outgoing>
                </bpmn:startEvent>
                <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Activity_1" />
                <bpmn:endEvent id="EndEvent_1">
                    <bpmn:incoming>Flow_2</bpmn:incoming>
                </bpmn:endEvent>
                <bpmn:sequenceFlow id="Flow_2" sourceRef="Activity_1" targetRef="EndEvent_1" />
                <bpmn:userTask id="Activity_1" name="New Task">
                    <bpmn:incoming>Flow_1</bpmn:incoming>
                    <bpmn:outgoing>Flow_2</bpmn:outgoing>
                </bpmn:userTask>
            </bpmn:process>
        </bpmn:definitions>
        """.trimIndent()

        mockMvc.perform(
            MockMvcRequestBuilders.multipart(
                HttpMethod.PUT,
                "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/process-definition",
                "autodeploy", "1.0.0"
            )
                .file(MockMultipartFile("file", "redeploy-process.bpmn", MediaType.APPLICATION_XML_VALUE, secondBpmnXml.toByteArray()))
                .file(MockMultipartFile("processLinks", "processLinks.json", MediaType.APPLICATION_JSON_VALUE, processLinksJson.toByteArray()))
                .param("canInitializeDocument", "true")
                .param("startableByUser", "true")
                .contentType(MediaType.MULTIPART_FORM_DATA_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andExpect(status().isNoContent)

        runWithoutAuthorization {
            val allVersions = repositoryService.createProcessDefinitionQuery()
                .processDefinitionKey("redeploy-process")
                .list()

            val activeVersions = allVersions.filter { !it.isSuspended }
            val versionTaggedVersions = allVersions.filter { it.versionTag == "CD:autodeploy:1.0.0" }

            assertEquals(1, versionTaggedVersions.size,
                "Expected exactly one definition with the case version tag, but found ${versionTaggedVersions.size}")
            assertEquals(true, versionTaggedVersions.first().isSuspended,
                "Redeployed non-executable definition should be suspended")
            assertEquals(0, activeVersions.size,
                "No active versions should exist for a non-executable process")
        }
    }

    private fun createProcessLink(): UUID {
        return processLinkRepository.save(
            TestProcessLink(
                UUID.randomUUID(),
                processDefinitionId = PROCESS_DEF_ID,
                activityId = ACTIVITY_ID,
                activityType = SERVICE_TASK_START
            )
        ).id
    }

    companion object {
        const val PROCESS_DEF_ID = "test-process"
        const val ACTIVITY_ID = "test-activity"
    }
}
