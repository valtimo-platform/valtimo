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

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.both;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasProperty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.collection.IsCollectionWithSize.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ritense.authorization.AuthorizationContext;
import com.ritense.authorization.AuthorizationService;
import com.ritense.authorization.AuthorizationSupportedHelper;
import com.ritense.valtimo.exception.ProcessDefinitionNotFoundException;
import com.ritense.valtimo.operaton.domain.OperatonHistoricProcessInstance;
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition;
import com.ritense.valtimo.operaton.repository.OperatonDecisionDefinitionRepository;
import com.ritense.valtimo.operaton.repository.OperatonExecutionRepository;
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionRepository;
import com.ritense.valtimo.operaton.service.OperatonHistoryService;
import com.ritense.valtimo.operaton.service.OperatonRepositoryService;
import com.ritense.valtimo.operaton.service.OperatonRuntimeService;
import com.ritense.valtimo.contract.config.ValtimoProperties;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.xml.parsers.DocumentBuilderFactory;
import com.ritense.valtimo.helper.OperatonDeploymentSourceHelper;
import org.operaton.bpm.engine.FormService;
import org.operaton.bpm.engine.RepositoryService;
import org.operaton.bpm.engine.RuntimeService;
import org.operaton.bpm.model.bpmn.Bpmn;
import org.operaton.bpm.model.bpmn.BpmnModelInstance;
import org.operaton.bpm.model.bpmn.instance.Process;
import org.operaton.bpm.model.bpmn.instance.ServiceTask;
import org.operaton.bpm.model.dmn.Dmn;
import org.operaton.bpm.model.dmn.DmnModelInstance;
import org.operaton.bpm.engine.runtime.ProcessInstance;
import org.operaton.bpm.model.dmn.instance.Decision;
import org.hamcrest.Matcher;
import org.hamcrest.core.IsEqual;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.ResolvableType;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

class OperatonProcessServiceTest {

    private static final String userMock = "user";
    private OperatonHistoricProcessInstance latestProcessInstance;
    private OperatonHistoricProcessInstance middleProcessInstance;
    private OperatonHistoricProcessInstance oldestProcessInstance;

    private static final LocalDateTime FIRST_OF_JANUARY_2018 = getDate(2018,1, 1);
    private static final LocalDateTime FIRST_OF_JANUARY_2017 = getDate(2017,1, 1);
    private static final LocalDateTime FIRST_OF_JANUARY_2016 = getDate(2016,1, 1);

    private static final String PROCESS_DEFINITION_ID = "test-process:2:2f8b1e3a";

    private static final String BUSINESSKEY1 = "businessKey1";
    private static final String BUSINESSKEY2 = "businessKey2";
    private static final String BUSINESSKEY3 = "businessKey3";

    private static final String CAMUNDA_NS = "http://camunda.org/schema/1.0/bpmn";
    private static final String OPERATON_NS = "http://operaton.org/schema/1.0/bpmn";

    private static final String MINIMAL_BPMN_TEMPLATE =
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
            "<bpmn:definitions xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\"" +
            " xmlns:camunda=\"http://camunda.org/schema/1.0/bpmn\"" +
            " id=\"test\" targetNamespace=\"http://bpmn.io/schema/bpmn\">" +
            "<bpmn:process id=\"test-process\" isExecutable=\"true\">" +
            "<bpmn:serviceTask id=\"task1\" name=\"Task\"%s/>" +
            "</bpmn:process></bpmn:definitions>";

    private OperatonProcessService operatonProcessService;

    @Mock
    private RuntimeService runtimeService = mock(RuntimeService.class, RETURNS_DEEP_STUBS);

    @Mock
    private OperatonRuntimeService operatonRuntimeService;

    @Mock
    private RepositoryService repositoryService;

    @Mock
    private OperatonRepositoryService operatonRepositoryService;

    @Mock
    private ProcessPropertyService processPropertyService;

    @Mock
    private ValtimoProperties valtimoProperties;

    @Mock
    private FormService formService;

    @Mock
    private AuthorizationService authorizationService;

    @Mock
    private OperatonExecutionRepository operatonExecutionRepository;

    @Mock
    private ProcessDefinitionCaseDefinitionLinker processDefinitionCaseDefinitionLinker;

    @Mock
    private OperatonByteArrayService operatonByteArrayService;

    @Mock
    private ApplicationEventPublisher applicationEventPublisher;

    @Mock
    private OperatonDeploymentSourceHelper operatonDeploymentSourceHelper;

    @Mock
    private OperatonProcessDefinitionRepository operatonProcessDefinitionRepository;

    private OperatonHistoryService historyService = mock(OperatonHistoryService.class, RETURNS_DEEP_STUBS);

    @BeforeEach
    public void beforeEach() {
        MockitoAnnotations.openMocks(this);
        // RelatedEntityAuthorizationRequest validates the resource type against the Spring context on
        // construction, so the start-process tests need AuthorizationSupportedHelper to be initialised.
        var applicationContext = mock(ApplicationContext.class);
        when(applicationContext.getBeanNamesForType(any(ResolvableType.class)))
            .thenReturn(new String[] {"authorizationSpecificationFactory"});
        AuthorizationSupportedHelper.INSTANCE.setApplicationContext(applicationContext);
    }

    @Test
    void getAllActiveContextProcessesStartedByCurrentUserTestExpectAll() {
        operatonProcessService = new OperatonProcessService(
            runtimeService,
            operatonRuntimeService,
            repositoryService,
            operatonRepositoryService,
            formService,
            historyService,
            processPropertyService,
            valtimoProperties,
            authorizationService,
            operatonExecutionRepository,
            processDefinitionCaseDefinitionLinker,
            operatonByteArrayService,
            applicationEventPublisher,
            operatonDeploymentSourceHelper,
            operatonProcessDefinitionRepository
        );

        //when
        when(historyService.findHistoricProcessInstances(any()))
            .thenReturn(getHistoricProcessInstances());

        //method call
        var allActiveContextProcessesStartedByCurrentUser =
            AuthorizationContext.runWithoutAuthorization(
                () -> operatonProcessService
                    .getAllActiveContextProcessesStartedByCurrentUser(contextProcessesTest1(), userMock)
            );
        //assert
        assertThat(allActiveContextProcessesStartedByCurrentUser, hasSize(3));
        assertThat(allActiveContextProcessesStartedByCurrentUser, contains(latestProcessInstance, middleProcessInstance, oldestProcessInstance));
        assertThat(allActiveContextProcessesStartedByCurrentUser, hasItem(hasProperty("businessKey", is("businessKey1"))));
        assertThat(allActiveContextProcessesStartedByCurrentUser, hasItem(
            both(withBusinessKey(BUSINESSKEY1))
                .and(withStartTime(FIRST_OF_JANUARY_2018))
        ));
        assertThat(allActiveContextProcessesStartedByCurrentUser, hasItem(
            both(withBusinessKey(BUSINESSKEY2))
                .and(withStartTime(FIRST_OF_JANUARY_2017))
        ));
        assertThat(allActiveContextProcessesStartedByCurrentUser, hasItem(
            both(withBusinessKey(BUSINESSKEY3))
                .and(withStartTime(FIRST_OF_JANUARY_2016))
        ));
    }

    @Test
    void getAllActiveContextProcessesStartedByCurrentUserTestExpectTwo() {
        operatonProcessService = new OperatonProcessService(
            runtimeService,
            operatonRuntimeService,
            repositoryService,
            operatonRepositoryService,
            formService,
            historyService,
            processPropertyService,
            valtimoProperties,
            authorizationService,
            operatonExecutionRepository,
            processDefinitionCaseDefinitionLinker,
            operatonByteArrayService,
            applicationEventPublisher,
            operatonDeploymentSourceHelper,
            operatonProcessDefinitionRepository
        );

        //when
        when(historyService.findHistoricProcessInstances(any()))
            .thenReturn(getHistoricProcessInstances());

        //method call
        var allActiveContextProcessesStartedByCurrentUser = AuthorizationContext.runWithoutAuthorization(() ->
            operatonProcessService.getAllActiveContextProcessesStartedByCurrentUser(contextProcessesTest2(), userMock));
        //assert
        assertThat(allActiveContextProcessesStartedByCurrentUser, hasSize(2));
        assertThat(allActiveContextProcessesStartedByCurrentUser, contains(latestProcessInstance, middleProcessInstance));
        assertThat(allActiveContextProcessesStartedByCurrentUser, hasItem(
            both(withBusinessKey(BUSINESSKEY1))
                .and(withStartTime(FIRST_OF_JANUARY_2018))
        ));
        assertThat(allActiveContextProcessesStartedByCurrentUser, hasItem(
            both(withBusinessKey(BUSINESSKEY2))
                .and(withStartTime(FIRST_OF_JANUARY_2017))
        ));

    }

    private List<OperatonHistoricProcessInstance> getHistoricProcessInstances() {
        latestProcessInstance = new OperatonHistoricProcessInstance(
            UUID.randomUUID().toString(),
            null,
            BUSINESSKEY1,
            "testprocess1",
            null,
            FIRST_OF_JANUARY_2018,
            null,null,null,null,null,null,null,null,null,null,null,null,null
        );

        middleProcessInstance = new OperatonHistoricProcessInstance(
            UUID.randomUUID().toString(),
            null,
            BUSINESSKEY2,
            "testprocess2",
            null,
            FIRST_OF_JANUARY_2017,
            null,null,null,null,null,null,null,null,null,null,null,null,null
        );

        oldestProcessInstance = new OperatonHistoricProcessInstance(
            UUID.randomUUID().toString(),
            null,
            BUSINESSKEY3,
            "testprocess3",
            null,
            FIRST_OF_JANUARY_2016,
            null,null,null,null,null,null,null,null,null,null,null,null,null
        );

        List<OperatonHistoricProcessInstance> historicProcessInstances = new ArrayList<>();

        historicProcessInstances.add(latestProcessInstance);
        historicProcessInstances.add(middleProcessInstance);
        historicProcessInstances.add(oldestProcessInstance);

        return historicProcessInstances;
    }

    private Set<String> contextProcessesTest1() {
        Set<String> processes = new HashSet<>();
        processes.add("testprocess1");
        processes.add("testprocess2");
        processes.add("testprocess3");

        return processes;
    }

    private Set<String> contextProcessesTest2() {
        Set<String> processes = new HashSet<>();
        processes.add("testprocess1");
        processes.add("testprocess2");
        processes.add("testprocess4");

        return processes;
    }

    private static LocalDateTime getDate(int year, int month, int date) {
        return LocalDate.of(year, month, date).atStartOfDay();
    }

    private Matcher<Object> withBusinessKey(String businessKey) {
        return hasProperty("businessKey", IsEqual.equalTo(businessKey));
    }

    private Matcher<Object> withStartTime(LocalDateTime date) {
        return hasProperty("startTime", IsEqual.equalTo(date));
    }

    @Test
    void normalizeToCamundaNamespace_noOperatonAttributes_camundaValuePreserved() throws Exception {
        BpmnModelInstance model = modelWithCamundaExpression("${null}");

        Document result = parseResult(createService().normalizeToCamundaNamespace(model));
        Element task = findById(result, "task1");

        assertEquals("${null}", task.getAttributeNS(CAMUNDA_NS, "expression"));
        assertEquals("", task.getAttributeNS(OPERATON_NS, "expression"));
    }

    @Test
    void normalizeToCamundaNamespace_onlyOperatonAttribute_convertedToCamunda() throws Exception {
        BpmnModelInstance model = modelWithNoExtensionAttrs();
        serviceTask(model).setOperatonExpression("${value}");

        Document result = parseResult(createService().normalizeToCamundaNamespace(model));
        Element task = findById(result, "task1");

        assertEquals("${value}", task.getAttributeNS(CAMUNDA_NS, "expression"));
        assertEquals("", task.getAttributeNS(OPERATON_NS, "expression"));
    }

    @Test
    void normalizeToCamundaNamespace_sameValueInBothNamespaces_operatonAttributeRemoved() throws Exception {
        BpmnModelInstance model = modelWithCamundaExpression("${null}");
        serviceTask(model).setOperatonExpression("${null}");

        Document result = parseResult(createService().normalizeToCamundaNamespace(model));
        Element task = findById(result, "task1");

        assertEquals("${null}", task.getAttributeNS(CAMUNDA_NS, "expression"));
        assertEquals("", task.getAttributeNS(OPERATON_NS, "expression"));
    }

    @Test
    void normalizeToCamundaNamespace_differentValueInBothNamespaces_operatonValueWins() throws Exception {
        BpmnModelInstance model = modelWithCamundaExpression("${camunda-value}");
        serviceTask(model).setOperatonExpression("${operaton-value}");

        Document result = parseResult(createService().normalizeToCamundaNamespace(model));
        Element task = findById(result, "task1");

        assertEquals("${operaton-value}", task.getAttributeNS(CAMUNDA_NS, "expression"));
        assertEquals("", task.getAttributeNS(OPERATON_NS, "expression"));
    }

    @Test
    void normalizeToCamundaNamespace_nestedElements_allNormalized() throws Exception {
        BpmnModelInstance model = modelWithNoExtensionAttrs();
        process(model).setOperatonVersionTag("v1");
        serviceTask(model).setOperatonExpression("${task-value}");

        Document result = parseResult(createService().normalizeToCamundaNamespace(model));

        Element proc = findById(result, "test-process");
        assertEquals("v1", proc.getAttributeNS(CAMUNDA_NS, "versionTag"));
        assertEquals("", proc.getAttributeNS(OPERATON_NS, "versionTag"));

        Element task = findById(result, "task1");
        assertEquals("${task-value}", task.getAttributeNS(CAMUNDA_NS, "expression"));
        assertEquals("", task.getAttributeNS(OPERATON_NS, "expression"));
    }

    @Test
    void normalizeToCamundaNamespace_dmn_noOperatonAttributes_camundaValuePreserved() throws Exception {
        DmnModelInstance model = modelWithCamundaInputVariable("myVar");

        Document result = parseResult(createService().normalizeToCamundaNamespace(model));
        Element inputEl = findById(result, "input1");

        assertEquals("myVar", inputEl.getAttributeNS(CAMUNDA_DMN_NS, "inputVariable"));
        assertEquals("", inputEl.getAttributeNS(OPERATON_DMN_NS, "inputVariable"));
    }

    @Test
    void normalizeToCamundaNamespace_dmn_onlyOperatonAttribute_convertedToCamunda() throws Exception {
        DmnModelInstance model = modelWithNoExtensionAttrsDmn();
        decision(model).setVersionTag("v1");

        Document result = parseResult(createService().normalizeToCamundaNamespace(model));
        Element decisionEl = findById(result, "decision1");

        assertEquals("v1", decisionEl.getAttributeNS(CAMUNDA_DMN_NS, "versionTag"));
        assertEquals("", decisionEl.getAttributeNS(OPERATON_DMN_NS, "versionTag"));
    }

    @Test
    void normalizeToCamundaNamespace_dmn_differentValueInBothNamespaces_operatonValueWins() throws Exception {
        DmnModelInstance model = modelWithCamundaVersionTag("camunda-v");
        decision(model).setVersionTag("operaton-v");

        Document result = parseResult(createService().normalizeToCamundaNamespace(model));
        Element decisionEl = findById(result, "decision1");

        assertEquals("operaton-v", decisionEl.getAttributeNS(CAMUNDA_DMN_NS, "versionTag"));
        assertEquals("", decisionEl.getAttributeNS(OPERATON_DMN_NS, "versionTag"));
    }

    private BpmnModelInstance modelWithNoExtensionAttrs() {
        return Bpmn.readModelFromStream(new ByteArrayInputStream(
            String.format(MINIMAL_BPMN_TEMPLATE, "").getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void startProcessByIdShouldStartTheExactDefinitionWithoutResolvingByKey() {
        var processDefinition = processDefinition(PROCESS_DEFINITION_ID, null, false);
        when(operatonRepositoryService.findProcessDefinitionById(PROCESS_DEFINITION_ID)).thenReturn(processDefinition);
        when(formService.submitStartForm(eq(PROCESS_DEFINITION_ID), eq(BUSINESSKEY1), any()))
            .thenReturn(mock(ProcessInstance.class, RETURNS_DEEP_STUBS));

        var result = AuthorizationContext.runWithoutAuthorization(() -> createService()
            .startProcessById(PROCESS_DEFINITION_ID, BUSINESSKEY1, Map.of()));

        assertThat(result.getProcessDefinition(), is(processDefinition));
        verify(formService).submitStartForm(eq(PROCESS_DEFINITION_ID), eq(BUSINESSKEY1), any());
        // The whole point of starting by id: the lossy resolution by key must not run.
        verify(operatonRepositoryService, never()).findProcessDefinition(any());
    }

    @Test
    void startProcessByIdShouldThrowWhenDefinitionDoesNotExist() {
        when(operatonRepositoryService.findProcessDefinitionById(PROCESS_DEFINITION_ID)).thenReturn(null);

        var service = createService();
        assertThrows(
            ProcessDefinitionNotFoundException.class,
            () -> AuthorizationContext.runWithoutAuthorization(
                () -> service.startProcessById(PROCESS_DEFINITION_ID, BUSINESSKEY1, Map.of()))
        );
    }

    @Test
    void startProcessByIdShouldThrowWhenDefinitionIsDetached() {
        var detached = processDefinition(
            PROCESS_DEFINITION_ID,
            OperatonProcessService.DETACHED_PROCESS_DEFINITION_PREFIX + "BB:bezwaar:1.0.0",
            false
        );
        when(operatonRepositoryService.findProcessDefinitionById(PROCESS_DEFINITION_ID)).thenReturn(detached);

        var service = createService();
        assertThrows(
            IllegalStateException.class,
            () -> AuthorizationContext.runWithoutAuthorization(
                () -> service.startProcessById(PROCESS_DEFINITION_ID, BUSINESSKEY1, Map.of()))
        );
        verify(formService, never()).submitStartForm(any(), any(), any());
    }

    @Test
    void startProcessByIdShouldActivateAndReSuspendASuspendedDefinition() {
        var suspended = processDefinition(PROCESS_DEFINITION_ID, null, true);
        when(operatonRepositoryService.findProcessDefinitionById(PROCESS_DEFINITION_ID)).thenReturn(suspended);
        when(formService.submitStartForm(eq(PROCESS_DEFINITION_ID), any(), any()))
            .thenReturn(mock(ProcessInstance.class, RETURNS_DEEP_STUBS));

        AuthorizationContext.runWithoutAuthorization(() -> createService()
            .startProcessById(PROCESS_DEFINITION_ID, BUSINESSKEY1, Map.of()));

        var inOrder = inOrder(repositoryService, formService);
        inOrder.verify(repositoryService).activateProcessDefinitionById(PROCESS_DEFINITION_ID);
        inOrder.verify(formService).submitStartForm(eq(PROCESS_DEFINITION_ID), any(), any());
        inOrder.verify(repositoryService).suspendProcessDefinitionById(PROCESS_DEFINITION_ID);
    }

    @Test
    void startProcessByIdShouldReSuspendADefinitionWhenStartingFails() {
        var suspended = processDefinition(PROCESS_DEFINITION_ID, null, true);
        when(operatonRepositoryService.findProcessDefinitionById(PROCESS_DEFINITION_ID)).thenReturn(suspended);
        when(formService.submitStartForm(eq(PROCESS_DEFINITION_ID), any(), any()))
            .thenThrow(new IllegalStateException("boom"));

        var service = createService();
        assertThrows(
            IllegalStateException.class,
            () -> AuthorizationContext.runWithoutAuthorization(
                () -> service.startProcessById(PROCESS_DEFINITION_ID, BUSINESSKEY1, Map.of()))
        );
        verify(repositoryService).suspendProcessDefinitionById(PROCESS_DEFINITION_ID);
    }

    @Test
    void startProcessByIdShouldTranslateTheUndefinedBusinessKeyToNull() {
        var processDefinition = processDefinition(PROCESS_DEFINITION_ID, null, false);
        when(operatonRepositoryService.findProcessDefinitionById(PROCESS_DEFINITION_ID)).thenReturn(processDefinition);
        when(formService.submitStartForm(any(), any(), any()))
            .thenReturn(mock(ProcessInstance.class, RETURNS_DEEP_STUBS));

        AuthorizationContext.runWithoutAuthorization(() -> createService()
            .startProcessById(PROCESS_DEFINITION_ID, "UNDEFINED_BUSINESS_KEY", Map.of()));

        verify(formService).submitStartForm(eq(PROCESS_DEFINITION_ID), isNull(), any());
    }

    private OperatonProcessDefinition processDefinition(String id, String versionTag, boolean suspended) {
        var processDefinition = mock(OperatonProcessDefinition.class);
        when(processDefinition.getId()).thenReturn(id);
        when(processDefinition.getVersionTag()).thenReturn(versionTag);
        when(processDefinition.isSuspended()).thenReturn(suspended);
        return processDefinition;
    }

    private BpmnModelInstance modelWithCamundaExpression(String expression) {
        return Bpmn.readModelFromStream(new ByteArrayInputStream(
            String.format(MINIMAL_BPMN_TEMPLATE, " camunda:expression=\"" + expression + "\"")
                .getBytes(StandardCharsets.UTF_8)));
    }

    private ServiceTask serviceTask(BpmnModelInstance model) {
        return model.getModelElementsByType(ServiceTask.class).iterator().next();
    }

    private Process process(BpmnModelInstance model) {
        return model.getModelElementsByType(Process.class).iterator().next();
    }

    private OperatonProcessService createService() {
        return new OperatonProcessService(
            runtimeService, operatonRuntimeService, repositoryService, operatonRepositoryService,
            formService, historyService, processPropertyService, valtimoProperties,
            authorizationService, operatonExecutionRepository, processDefinitionCaseDefinitionLinker,
            operatonByteArrayService, applicationEventPublisher, operatonDeploymentSourceHelper,
            operatonProcessDefinitionRepository
        );
    }

    private Document parseResult(ByteArrayInputStream stream) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        return factory.newDocumentBuilder().parse(stream);
    }

    private Element findById(Document doc, String id) {
        NodeList all = doc.getElementsByTagName("*");
        for (int i = 0; i < all.getLength(); i++) {
            Element el = (Element) all.item(i);
            if (id.equals(el.getAttribute("id"))) {
                return el;
            }
        }
        throw new AssertionError("No element with id='" + id + "' found in document");
    }

    private static final String CAMUNDA_DMN_NS = "http://camunda.org/schema/1.0/dmn";
    private static final String OPERATON_DMN_NS = "http://operaton.org/schema/1.0/dmn";

    private static final String MINIMAL_DMN_TEMPLATE =
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
        "<definitions xmlns=\"https://www.omg.org/spec/DMN/20191111/MODEL/\"" +
        " xmlns:camunda=\"http://camunda.org/schema/1.0/dmn\"" +
        " id=\"test\" name=\"Test\" namespace=\"http://camunda.org/schema/1.0/dmn\">" +
        "<decision id=\"decision1\" name=\"Decision\"%s>" +
        "<decisionTable id=\"dt1\">" +
        "<input id=\"input1\" label=\"Input\"%s><inputExpression id=\"expr1\" typeRef=\"string\"/></input>" +
        "<output id=\"output1\" label=\"Output\" typeRef=\"string\"/>" +
        "</decisionTable></decision></definitions>";

    private DmnModelInstance modelWithNoExtensionAttrsDmn() {
        return Dmn.readModelFromStream(new ByteArrayInputStream(
            String.format(MINIMAL_DMN_TEMPLATE, "", "").getBytes(StandardCharsets.UTF_8)));
    }

    private DmnModelInstance modelWithCamundaInputVariable(String variable) {
        return Dmn.readModelFromStream(new ByteArrayInputStream(
            String.format(MINIMAL_DMN_TEMPLATE, "", " camunda:inputVariable=\"" + variable + "\"")
                .getBytes(StandardCharsets.UTF_8)));
    }

    private DmnModelInstance modelWithCamundaVersionTag(String versionTag) {
        return Dmn.readModelFromStream(new ByteArrayInputStream(
            String.format(MINIMAL_DMN_TEMPLATE, " camunda:versionTag=\"" + versionTag + "\"", "")
                .getBytes(StandardCharsets.UTF_8)));
    }

    private Decision decision(DmnModelInstance model) {
        return model.getModelElementsByType(Decision.class).iterator().next();
    }
}