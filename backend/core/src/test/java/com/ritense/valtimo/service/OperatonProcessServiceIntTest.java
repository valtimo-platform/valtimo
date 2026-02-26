/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.valtimo.service;

import static com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import com.ritense.authorization.AuthorizationContext;
import com.ritense.valtimo.BaseIntegrationTest;
import com.ritense.valtimo.contract.case_.CaseDefinitionId;
import com.ritense.valtimo.exception.FileExtensionNotSupportedException;
import com.ritense.valtimo.exception.NoFileExtensionFoundException;
import com.ritense.valtimo.exception.ProcessNotDeployableException;
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jetbrains.annotations.NotNull;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.operaton.bpm.engine.RepositoryService;
import org.operaton.bpm.engine.repository.DecisionDefinition;
import org.operaton.bpm.engine.repository.ProcessDefinition;
import org.operaton.bpm.model.bpmn.Bpmn;
import org.operaton.bpm.model.bpmn.BpmnModelInstance;
import org.operaton.bpm.model.bpmn.instance.BusinessRuleTask;
import org.operaton.bpm.model.bpmn.instance.CallActivity;
import org.operaton.bpm.model.bpmn.instance.Definitions;
import org.operaton.bpm.model.bpmn.instance.Process;
import org.operaton.bpm.model.bpmn.instance.ServiceTask;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class OperatonProcessServiceIntTest extends BaseIntegrationTest {

    @Value("classpath:examples/bpmn/*.xml")
    Resource[] bpmn;
    @Value("classpath:examples/dmn/*.xml")
    Resource[] dmn;
    @Value("classpath:examples/test/*")
    Resource[] test;

    @Autowired
    private RepositoryService repositoryService;

    @Autowired
    private OperatonProcessService operatonProcessService;

    @Test
    void shouldDeployNewProcess() throws IOException {
        var latestDeploymentId = findLatestProcessDefinitionDeployedProcess("deployedProcess")
            .map(OperatonProcessDefinition::getDeploymentId);
        List<Resource> processes = List.of(bpmn);
        AuthorizationContext.runWithoutAuthorization(() -> {
            operatonProcessService.deploy(
                CaseDefinitionId.of("deployedProcess", "1.0.0"),
                "aProcessName.bpmn",
                getFileStream("shouldDeploy.xml", processes)
            );
            return null;
        });
        var definition = findLatestProcessDefinitionDeployedProcess("deployedProcess").orElseThrow();
        //Make sure we have deployed a new version if one already existed (autodeployment)
        latestDeploymentId.ifPresent(
            deploymentId -> assertThat(deploymentId).isNotEqualTo(definition.getDeploymentId())
        );

        try (InputStream inputStream = repositoryService.getProcessModel(definition.getId())) {
            BpmnModelInstance model = Bpmn.readModelFromStream(inputStream);
            Process processModel = model.getDefinitions().getChildElementsByType(Process.class).stream()
                .filter(process -> process.getId().equals(definition.getKey()))
                .findFirst()
                .orElseThrow();
            assertThat(processModel.isExecutable()).isTrue();
            ServiceTask serviceTask = model.getModelElementsByType(ServiceTask.class).stream()
                .findFirst()
                .orElseThrow();
            assertThat(serviceTask.getOperatonExpression()).isEqualTo("${null}");
        }
    }

    @NotNull
    private Optional<OperatonProcessDefinition> findLatestProcessDefinitionDeployedProcess(String processName) {
        return AuthorizationContext
            .runWithoutAuthorization(() -> operatonProcessService.getDeployedDefinitions())
            .stream()
            .filter(processDefinition -> processDefinition.getKey().equals(processName))
            .findFirst();
    }

    @Test
    void shouldDeployNewDmn() {
        List<Resource> tables = List.of(dmn);
        AuthorizationContext.runWithoutAuthorization(() -> {
            operatonProcessService.deploy(
                CaseDefinitionId.of("deployedProcess", "1.0.0"),
                "aDmnName.dmn",
                getFileStream("sampleDecisionTable.xml", tables)
            );
            return null;
        });
        List<DecisionDefinition> definitions = repositoryService.createDecisionDefinitionQuery().list();
        Assertions.assertTrue(definitions.stream().anyMatch(decisionDefinition -> decisionDefinition.getKey().equals("Evenementenvergunning-risico")));
    }

    @Test
    void shouldNotDeployFileWithInvalidExtension() {
        List<Resource> testFiles = List.of(test);
        String textFileName = "aTextFile.txt";
        Assertions.assertThrows(FileExtensionNotSupportedException.class,
            () -> AuthorizationContext.runWithoutAuthorization(() -> {
                operatonProcessService.deploy(
                    CaseDefinitionId.of("deployedProcess", "1.0.0"),
                    textFileName,
                    getFileStream("sampleTextFile.txt", testFiles)
                );
                return null;
            }
        ));
        List<DecisionDefinition> dmnDefinitions = repositoryService.createDecisionDefinitionQuery().list();
        List<OperatonProcessDefinition> bpmnDefinitions = AuthorizationContext
                .runWithoutAuthorization(() -> operatonProcessService.getDeployedDefinitions());
        Assertions.assertFalse(dmnDefinitions.stream().anyMatch(dmnDefinition -> dmnDefinition.getResourceName().equals(textFileName)));
        Assertions.assertFalse(bpmnDefinitions.stream().anyMatch(bpmnDefinition -> bpmnDefinition.getResourceName().equals(textFileName)));
    }

    @Test
    void shouldNotDeployFileWithoutExtension() {
        List<Resource> testFiles = List.of(test);
        String sampleFileName = "aFileName";
        Assertions.assertThrows(NoFileExtensionFoundException.class,
            () -> AuthorizationContext.runWithoutAuthorization(() -> {
                operatonProcessService.deploy(
                    CaseDefinitionId.of("deployedProcess", "1.0.0"),
                    sampleFileName,
                    getFileStream("sampleTextFile", testFiles)
                );
                return null;
                }
            ));
        List<DecisionDefinition> dmnDefinitions = repositoryService.createDecisionDefinitionQuery().list();
        List<OperatonProcessDefinition> bpmnDefinitions = AuthorizationContext
                .runWithoutAuthorization(() -> operatonProcessService.getDeployedDefinitions());
        Assertions.assertFalse(dmnDefinitions.stream().anyMatch(dmnDefinition -> dmnDefinition.getResourceName().equals(sampleFileName)));
        Assertions.assertFalse(bpmnDefinitions.stream().anyMatch(bpmnDefinition -> bpmnDefinition.getResourceName().equals(sampleFileName)));
    }

    @Test
    void shouldNotUpdateExistingSystemProcess() throws IOException {
        List<Resource> processes = List.of(bpmn);
        var stream = getFileStream("systemProcess.xml", processes);
        var systemProcessModel = Bpmn.readModelFromStream(stream);
        repositoryService.createDeployment().addModelInstance("systemProcess.bpmn", systemProcessModel).deploy();
        List<OperatonProcessDefinition> definitions = AuthorizationContext
            .runWithoutAuthorization(() -> operatonProcessService.getDeployedDefinitions());
        Assertions.assertTrue(definitions.stream().anyMatch(processDefinition -> processDefinition.getKey().equals("secondProcess")));

        Assertions.assertThrows(ProcessNotDeployableException.class,
            () -> AuthorizationContext.runWithoutAuthorization(() -> {
                operatonProcessService.deploy(
                    CaseDefinitionId.of("deployedProcess", "1.0.0"),
                    "aProcessName.bpmn",
                    new ByteArrayInputStream(processes.stream().filter(process -> Objects.equals(process.getFilename(), "shouldNotDeploy.xml"))
                        .findFirst().orElseGet(() -> new ByteArrayResource(new byte[]{})).getInputStream().readAllBytes()));
                return null;
            }
        ));
        Assertions.assertFalse(definitions.stream().anyMatch(processDefinition -> processDefinition.getKey().equals("firstProcess")));
        Assertions.assertTrue(definitions.stream().anyMatch(processDefinition -> processDefinition.getKey().equals("secondProcess")));
    }

    @Test
    void shouldDeploySameFileForDifferentCasedefinitions() throws IOException {
        assertDoesNotThrow(() -> {
            List<Resource> processes = List.of(bpmn);
            AuthorizationContext.runWithoutAuthorization(() -> {
                operatonProcessService.deploy(
                    CaseDefinitionId.of("some-case-definition-1", "1.0.0"),
                    "aProcessName.bpmn",
                    getFileStream("shouldDeploy.xml", processes)
                );
                return null;
            });
            AuthorizationContext.runWithoutAuthorization(() -> {
                operatonProcessService.deploy(
                    CaseDefinitionId.of("some-case-definition-2", "1.0.0"),
                    "aProcessName.bpmn",
                    getFileStream("shouldDeploy.xml", processes)
                );
                return null;
            });
        });
    }

    @Test
    void whenDeployingSameFileShouldNotDeployAgain() throws IOException {
        List<Resource> processes = List.of(bpmn);
        AuthorizationContext.runWithoutAuthorization(() -> {
            operatonProcessService.deploy(
                CaseDefinitionId.of("some-case-definition-1", "1.0.0"),
                "aProcessName.bpmn",
                getFileStream("uniqueProcess.xml", processes)
            );
            return null;
        });
        AuthorizationContext.runWithoutAuthorization(() -> {
            operatonProcessService.deploy(
                CaseDefinitionId.of("some-case-definition-1", "1.0.0"),
                "aProcessName.bpmn",
                getFileStream("uniqueProcess.xml", processes)
            );
            return null;
        });

        List<ProcessDefinition> processDefinitions = repositoryService
            .createProcessDefinitionQuery()
            .processDefinitionKey("uniqueProcess")
            .list();

        Assertions.assertEquals(1, processDefinitions.size());
    }

    @Test
    void shouldDeploySameFileForCasedefinitionAndUnlinked() throws IOException {
        assertDoesNotThrow(() ->{
            List<Resource> processes = List.of(bpmn);
            AuthorizationContext.runWithoutAuthorization(() -> {
                operatonProcessService.deploy(
                    CaseDefinitionId.of("some-case-definition-1", "1.0.0"),
                    "aProcessName.bpmn",
                    getFileStream("shouldDeploy.xml", processes)
                );
                return null;
            });
            AuthorizationContext.runWithoutAuthorization(() -> {
                operatonProcessService.deploy(
                    null,
                    "aProcessName.bpmn",
                    getFileStream("shouldDeploy.xml", processes)
                );
                return null;
            });
        });
    }

    @Test
    void shouldDeployFileWithMultipleProcessDefinitions() throws IOException {
        assertDoesNotThrow(() ->{
            List<Resource> processes = List.of(bpmn);
            AuthorizationContext.runWithoutAuthorization(() -> {
                operatonProcessService.deploy(
                    CaseDefinitionId.of("some-case-definition-1", "1.0.0"),
                    "aProcessName.bpmn",
                    getFileStream("double.xml", processes)
                );
                return null;
            });
        });
    }

    @Test
    void shouldDeployDifferentProcessesWithSameFilenameForSameCasedefinitions() throws IOException {
        assertDoesNotThrow(() ->{
            List<Resource> processes = List.of(bpmn);
            AuthorizationContext.runWithoutAuthorization(() -> {
                operatonProcessService.deploy(
                    CaseDefinitionId.of("some-case-definition-1", "1.0.0"),
                    "aProcessName.bpmn",
                    getFileStream("shouldDeploy.xml", processes)
                );
                return null;
            });
            AuthorizationContext.runWithoutAuthorization(() -> {
                operatonProcessService.deploy(
                    CaseDefinitionId.of("some-case-definition-1", "1.0.0"),
                    "aProcessName.bpmn",
                    getFileStream("uniqueProcess.xml", processes)
                );
                return null;
            });
        });
    }

    @Test
    void shouldDeployGlobalDecisionsWithoutDeletingOldVersions() throws IOException {
        List<Resource> processes = List.of(dmn);
        AuthorizationContext.runWithoutAuthorization(() -> {
            operatonProcessService.deploy(
                null,
                "decision.dmn",
                getFileStream("sampleDecisionTable-part1.xml", processes)
            );
            operatonProcessService.deploy(
                null,
                "decision.dmn",
                getFileStream("sampleDecisionTable-part2.xml", processes)
            );
            operatonProcessService.deploy(
                null,
                "decision.dmn",
                getFileStream("sampleDecisionTable-part3.xml", processes)
            );
            return null;
        });

        List<DecisionDefinition> decisionDefinitions = repositoryService.createDecisionDefinitionQuery()
            .decisionDefinitionKey("decisionTable_in_parts")
            .list();

        Assertions.assertEquals(3, decisionDefinitions.size());
    }

    @Test
    void shouldUpdateCaseDefinitionVersionTagsWhenDifferentCaseDefinitionIsProvided() {
        BpmnModelInstance model = createBpmnModelWithTwoCallActivities();

        Process process = model.getModelElementsByType(Process.class)
            .stream()
            .findFirst()
            .orElseThrow();

        CallActivity caseLinkedCallActivity = model.getModelElementsByType(CallActivity.class)
            .stream()
            .filter(ca -> "caseLinkedCallActivity".equals(ca.getId()))
            .findFirst()
            .orElseThrow();

        CallActivity customCallActivity = model.getModelElementsByType(CallActivity.class)
            .stream()
            .filter(ca -> "customCallActivity".equals(ca.getId()))
            .findFirst()
            .orElseThrow();

        CaseDefinitionId originalCaseDefinitionId = CaseDefinitionId.of("original-case", "1.0.0");
        CaseDefinitionId newCaseDefinitionId = CaseDefinitionId.of("new-case", "2.0.0");

        String originalTag =
            OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX + originalCaseDefinitionId;
        String customNonCaseTag = "SOME_OTHER_TAG";

        process.setOperatonVersionTag(originalTag);

        caseLinkedCallActivity.setOperatonCalledElementBinding("versionTag");
        caseLinkedCallActivity.setOperatonCalledElementVersionTag(originalTag);

        customCallActivity.setOperatonCalledElementBinding("versionTag");
        customCallActivity.setOperatonCalledElementVersionTag(customNonCaseTag);

        assertThat(CaseDefinitionId.fromProcessVersionTag(originalTag)).isNotNull();
        assertThat(CaseDefinitionId.fromProcessVersionTag(customNonCaseTag)).isNull();

        operatonProcessService.updateCaseDefinitionProcessesVersionTags(model, newCaseDefinitionId);

        String expectedNewTag =
            OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX + newCaseDefinitionId;

        assertThat(process.getOperatonVersionTag()).isEqualTo(expectedNewTag);

        assertThat(caseLinkedCallActivity.getOperatonCalledElementBinding()).isEqualTo("versionTag");
        assertThat(caseLinkedCallActivity.getOperatonCalledElementVersionTag()).isEqualTo(expectedNewTag);

        assertThat(customCallActivity.getOperatonCalledElementBinding()).isEqualTo("versionTag");
        assertThat(customCallActivity.getOperatonCalledElementVersionTag()).isEqualTo(customNonCaseTag);
    }

    @Test
    void shouldClearCaseDefinitionVersionTagsWhenNoCaseDefinitionIsProvided() {
        BpmnModelInstance model = createBpmnModelWithTwoCallActivities();

        Process process = model.getModelElementsByType(Process.class)
            .stream()
            .findFirst()
            .orElseThrow();

        CallActivity caseLinkedCallActivity = model.getModelElementsByType(CallActivity.class)
            .stream()
            .filter(ca -> "caseLinkedCallActivity".equals(ca.getId()))
            .findFirst()
            .orElseThrow();

        CallActivity customCallActivity = model.getModelElementsByType(CallActivity.class)
            .stream()
            .filter(ca -> "customCallActivity".equals(ca.getId()))
            .findFirst()
            .orElseThrow();

        CaseDefinitionId caseDefinitionId = CaseDefinitionId.of("some-case", "1.0.0");
        String caseTag =
            OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX + caseDefinitionId;
        String customNonCaseTag = "SOME_OTHER_TAG";

        process.setOperatonVersionTag(caseTag);

        caseLinkedCallActivity.setOperatonCalledElementBinding("versionTag");
        caseLinkedCallActivity.setOperatonCalledElementVersionTag(caseTag);

        customCallActivity.setOperatonCalledElementBinding("versionTag");
        customCallActivity.setOperatonCalledElementVersionTag(customNonCaseTag);

        assertThat(CaseDefinitionId.fromProcessVersionTag(caseTag)).isNotNull();
        assertThat(CaseDefinitionId.fromProcessVersionTag(customNonCaseTag)).isNull();

        operatonProcessService.updateCaseDefinitionProcessesVersionTags(model, null);

        assertThat(process.getOperatonVersionTag()).isNull();

        assertThat(caseLinkedCallActivity.getOperatonCalledElementBinding()).isNull();
        assertThat(caseLinkedCallActivity.getOperatonCalledElementVersionTag()).isNull();

        assertThat(customCallActivity.getOperatonCalledElementBinding()).isEqualTo("versionTag");
        assertThat(customCallActivity.getOperatonCalledElementVersionTag()).isEqualTo(customNonCaseTag);
    }

    private ByteArrayInputStream getFileStream(String filename, List<Resource> source) throws IOException {
        return new ByteArrayInputStream(source.stream()
            .filter(resource -> Objects.equals(resource.getFilename(), filename))
            .findFirst()
            .orElseGet(() -> new ByteArrayResource(new byte[]{}))
            .getInputStream()
            .readAllBytes());
    }

    private BpmnModelInstance createBpmnModelWithTwoCallActivities() {
        BpmnModelInstance model = Bpmn.createEmptyModel();

        Definitions definitions = model.newInstance(Definitions.class);
        definitions.setTargetNamespace("http://operaton.org/schema/bpmn");
        model.setDefinitions(definitions);

        Process process = model.newInstance(Process.class);
        process.setId("testProcess");
        process.setExecutable(true);
        definitions.addChildElement(process);

        CallActivity caseLinkedCallActivity = model.newInstance(CallActivity.class);
        caseLinkedCallActivity.setId("caseLinkedCallActivity");
        process.addChildElement(caseLinkedCallActivity);

        CallActivity customCallActivity = model.newInstance(CallActivity.class);
        customCallActivity.setId("customCallActivity");
        process.addChildElement(customCallActivity);

        return model;
    }

    @Test
    void shouldUpdateBusinessRuleTaskVersionTagsWhenCaseDefinitionIsProvided() {
        BpmnModelInstance model = createBpmnModelWithBusinessRuleTasks();

        Process process = model.getModelElementsByType(Process.class)
            .stream()
            .findFirst()
            .orElseThrow();

        BusinessRuleTask caseLinkedBusinessRuleTask = model.getModelElementsByType(BusinessRuleTask.class)
            .stream()
            .filter(brt -> "caseLinkedBusinessRuleTask".equals(brt.getId()))
            .findFirst()
            .orElseThrow();

        BusinessRuleTask customBusinessRuleTask = model.getModelElementsByType(BusinessRuleTask.class)
            .stream()
            .filter(brt -> "customBusinessRuleTask".equals(brt.getId()))
            .findFirst()
            .orElseThrow();

        CaseDefinitionId originalCaseDefinitionId = CaseDefinitionId.of("original-case", "1.0.0");
        CaseDefinitionId newCaseDefinitionId = CaseDefinitionId.of("new-case", "2.0.0");

        String originalTag =
            OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX + originalCaseDefinitionId;
        String customNonCaseTag = "SOME_OTHER_TAG";

        process.setOperatonVersionTag(originalTag);

        caseLinkedBusinessRuleTask.setOperatonDecisionRefBinding("versionTag");
        caseLinkedBusinessRuleTask.setOperatonDecisionRefVersionTag(originalTag);

        customBusinessRuleTask.setOperatonDecisionRefBinding("versionTag");
        customBusinessRuleTask.setOperatonDecisionRefVersionTag(customNonCaseTag);

        assertThat(CaseDefinitionId.fromProcessVersionTag(originalTag)).isNotNull();
        assertThat(CaseDefinitionId.fromProcessVersionTag(customNonCaseTag)).isNull();

        operatonProcessService.updateCaseDefinitionProcessesVersionTags(model, newCaseDefinitionId);

        String expectedNewTag =
            OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX + newCaseDefinitionId;

        assertThat(process.getOperatonVersionTag()).isEqualTo(expectedNewTag);

        assertThat(caseLinkedBusinessRuleTask.getOperatonDecisionRefBinding()).isEqualTo("versionTag");
        assertThat(caseLinkedBusinessRuleTask.getOperatonDecisionRefVersionTag()).isEqualTo(expectedNewTag);

        assertThat(customBusinessRuleTask.getOperatonDecisionRefBinding()).isEqualTo("versionTag");
        assertThat(customBusinessRuleTask.getOperatonDecisionRefVersionTag()).isEqualTo(customNonCaseTag);
    }

    @Test
    void shouldClearBusinessRuleTaskVersionTagsWhenNoCaseDefinitionIsProvided() {
        BpmnModelInstance model = createBpmnModelWithBusinessRuleTasks();

        Process process = model.getModelElementsByType(Process.class)
            .stream()
            .findFirst()
            .orElseThrow();

        BusinessRuleTask caseLinkedBusinessRuleTask = model.getModelElementsByType(BusinessRuleTask.class)
            .stream()
            .filter(brt -> "caseLinkedBusinessRuleTask".equals(brt.getId()))
            .findFirst()
            .orElseThrow();

        BusinessRuleTask customBusinessRuleTask = model.getModelElementsByType(BusinessRuleTask.class)
            .stream()
            .filter(brt -> "customBusinessRuleTask".equals(brt.getId()))
            .findFirst()
            .orElseThrow();

        CaseDefinitionId caseDefinitionId = CaseDefinitionId.of("some-case", "1.0.0");
        String caseTag =
            OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX + caseDefinitionId;
        String customNonCaseTag = "SOME_OTHER_TAG";

        process.setOperatonVersionTag(caseTag);

        caseLinkedBusinessRuleTask.setOperatonDecisionRefBinding("versionTag");
        caseLinkedBusinessRuleTask.setOperatonDecisionRefVersionTag(caseTag);

        customBusinessRuleTask.setOperatonDecisionRefBinding("versionTag");
        customBusinessRuleTask.setOperatonDecisionRefVersionTag(customNonCaseTag);

        assertThat(CaseDefinitionId.fromProcessVersionTag(caseTag)).isNotNull();
        assertThat(CaseDefinitionId.fromProcessVersionTag(customNonCaseTag)).isNull();

        operatonProcessService.updateCaseDefinitionProcessesVersionTags(model, null);

        assertThat(process.getOperatonVersionTag()).isNull();

        assertThat(caseLinkedBusinessRuleTask.getOperatonDecisionRefBinding()).isNull();
        assertThat(caseLinkedBusinessRuleTask.getOperatonDecisionRefVersionTag()).isNull();

        assertThat(customBusinessRuleTask.getOperatonDecisionRefBinding()).isEqualTo("versionTag");
        assertThat(customBusinessRuleTask.getOperatonDecisionRefVersionTag()).isEqualTo(customNonCaseTag);
    }

    private BpmnModelInstance createBpmnModelWithBusinessRuleTasks() {
        BpmnModelInstance model = Bpmn.createEmptyModel();

        Definitions definitions = model.newInstance(Definitions.class);
        definitions.setTargetNamespace("http://operaton.org/schema/bpmn");
        model.setDefinitions(definitions);

        Process process = model.newInstance(Process.class);
        process.setId("testProcess");
        process.setExecutable(true);
        definitions.addChildElement(process);

        BusinessRuleTask caseLinkedBusinessRuleTask = model.newInstance(BusinessRuleTask.class);
        caseLinkedBusinessRuleTask.setId("caseLinkedBusinessRuleTask");
        caseLinkedBusinessRuleTask.setOperatonDecisionRef("some-dmn");
        process.addChildElement(caseLinkedBusinessRuleTask);

        BusinessRuleTask customBusinessRuleTask = model.newInstance(BusinessRuleTask.class);
        customBusinessRuleTask.setId("customBusinessRuleTask");
        customBusinessRuleTask.setOperatonDecisionRef("another-dmn");
        process.addChildElement(customBusinessRuleTask);

        return model;
    }
}
