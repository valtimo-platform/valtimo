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

package com.ritense.processdocument.domain.impl.listener;

import static com.ritense.valtimo.contract.buildingblock.BuildingBlockConstants.BUILDING_BLOCK_INSTANCE_ID_VARIABLE;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.ritense.document.domain.Document;
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId;
import com.ritense.processdocument.service.ProcessDocumentAssociationService;
import com.ritense.processdocument.service.ProcessDocumentService;
import java.lang.reflect.Proxy;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.operaton.bpm.engine.delegate.DelegateExecution;
import org.operaton.bpm.model.bpmn.Bpmn;
import org.operaton.bpm.model.bpmn.BpmnModelInstance;

class StartEventFromCallActivityListenerImplTest {

    private static final String PROCESS_NAME = "call-activity-start";

    private ProcessDocumentAssociationService processDocumentAssociationService;
    private ProcessDocumentService processDocumentService;
    private StartEventFromCallActivityListenerImpl listener;

    @BeforeEach
    void setUp() {
        processDocumentAssociationService = mock(ProcessDocumentAssociationService.class);
        processDocumentService = mock(ProcessDocumentService.class);
        listener = new StartEventFromCallActivityListenerImpl(
            processDocumentAssociationService,
            processDocumentService
        );
    }

    @Test
    void notifyShouldAssociateDocumentWhenSuperExecutionIsMissing() {
        String processInstanceId = UUID.randomUUID().toString();
        DelegateExecution execution = execution(processInstanceId, null);

        UUID documentUuid = UUID.randomUUID();
        Document.Id documentId = documentId(documentUuid);
        OperatonProcessInstanceId expectedProcessId = new OperatonProcessInstanceId(processInstanceId);

        when(processDocumentService.getDocumentId(expectedProcessId, execution)).thenReturn(documentId);

        listener.notify(execution);

        verify(processDocumentService).getDocumentId(expectedProcessId, execution);
        verify(processDocumentAssociationService).createProcessDocumentInstance(
            processInstanceId,
            documentUuid,
            PROCESS_NAME
        );
        verifyNoMoreInteractions(processDocumentService);
    }

    @Test
    void notifyShouldResolveDocumentFromSuperExecutionWhenPresent() {
        String processInstanceId = UUID.randomUUID().toString();
        String superProcessInstanceId = UUID.randomUUID().toString();
        DelegateExecution superExecution = superExecution(superProcessInstanceId, false);
        DelegateExecution execution = execution(processInstanceId, superExecution);

        UUID documentUuid = UUID.randomUUID();
        Document.Id documentId = documentId(documentUuid);
        OperatonProcessInstanceId expectedProcessId = new OperatonProcessInstanceId(superProcessInstanceId);

        when(processDocumentService.getDocumentId(expectedProcessId, execution)).thenReturn(documentId);

        listener.notify(execution);

        ArgumentCaptor<OperatonProcessInstanceId> processIdCaptor = ArgumentCaptor.forClass(OperatonProcessInstanceId.class);
        verify(processDocumentService).getDocumentId(processIdCaptor.capture(), eq(execution));
        assertEquals(expectedProcessId, processIdCaptor.getValue());
        verify(processDocumentAssociationService).createProcessDocumentInstance(
            processInstanceId,
            documentUuid,
            PROCESS_NAME
        );
        verifyNoMoreInteractions(processDocumentService);
    }

    @Test
    void notifyShouldFallbackToCurrentProcessWhenSuperExecutionHasBuildingBlockId() {
        String processInstanceId = UUID.randomUUID().toString();
        String superProcessInstanceId = UUID.randomUUID().toString();
        String buildingBlockDocumentId = UUID.randomUUID().toString();
        DelegateExecution superExecution = superExecution(superProcessInstanceId, true, buildingBlockDocumentId);
        DelegateExecution execution = executionWithVariableCapture(processInstanceId, superExecution);

        UUID documentUuid = UUID.randomUUID();
        Document.Id documentId = documentId(documentUuid);
        OperatonProcessInstanceId expectedProcessId = new OperatonProcessInstanceId(processInstanceId);

        when(processDocumentService.getDocumentId(expectedProcessId, execution)).thenReturn(documentId);

        listener.notify(execution);

        ArgumentCaptor<OperatonProcessInstanceId> processIdCaptor = ArgumentCaptor.forClass(OperatonProcessInstanceId.class);
        verify(processDocumentService).getDocumentId(processIdCaptor.capture(), eq(execution));
        assertEquals(expectedProcessId, processIdCaptor.getValue());
        verify(processDocumentAssociationService, times(1)).createProcessDocumentInstance(
            processInstanceId,
            documentUuid,
            PROCESS_NAME
        );
        verifyNoMoreInteractions(processDocumentService);
    }

    @Test
    void notifyShouldPropagateBuildingBlockInstanceIdFromParentToChild() {
        String processInstanceId = UUID.randomUUID().toString();
        String superProcessInstanceId = UUID.randomUUID().toString();
        String buildingBlockDocumentId = UUID.randomUUID().toString();
        DelegateExecution superExecution = superExecution(superProcessInstanceId, true, buildingBlockDocumentId);

        // Track what variable gets set on the child execution
        final String[] capturedVariableName = new String[1];
        final Object[] capturedVariableValue = new Object[1];

        DelegateExecution execution = (DelegateExecution) Proxy.newProxyInstance(
            getClass().getClassLoader(),
            new Class[] {DelegateExecution.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "getProcessInstanceId" -> processInstanceId;
                case "getSuperExecution" -> superExecution;
                case "getBpmnModelInstance" -> bpmnModelInstance();
                case "hasVariableLocal" -> false;
                case "setVariable" -> {
                    capturedVariableName[0] = (String) args[0];
                    capturedVariableValue[0] = args[1];
                    yield null;
                }
                case "getVariable" -> {
                    if (BUILDING_BLOCK_INSTANCE_ID_VARIABLE.equals(args[0])) {
                        yield capturedVariableValue[0];
                    }
                    yield null;
                }
                default -> null;
            }
        );

        UUID documentUuid = UUID.randomUUID();
        Document.Id documentId = documentId(documentUuid);
        OperatonProcessInstanceId expectedProcessId = new OperatonProcessInstanceId(processInstanceId);

        when(processDocumentService.getDocumentId(expectedProcessId, execution)).thenReturn(documentId);

        listener.notify(execution);

        // Verify the buildingBlockInstanceId was propagated to the child execution
        assertEquals(BUILDING_BLOCK_INSTANCE_ID_VARIABLE, capturedVariableName[0]);
        assertEquals(buildingBlockDocumentId, capturedVariableValue[0]);
    }

    private DelegateExecution execution(String processInstanceId, DelegateExecution superExecution) {
        return delegateExecution(processInstanceId, superExecution, bpmnModelInstance(), false, null);
    }

    private DelegateExecution executionWithVariableCapture(String processInstanceId, DelegateExecution superExecution) {
        return delegateExecution(processInstanceId, superExecution, bpmnModelInstance(), false, null);
    }

    private DelegateExecution superExecution(String processInstanceId, boolean hasBuildingBlockVariable) {
        return delegateExecution(processInstanceId, null, null, hasBuildingBlockVariable, null);
    }

    private DelegateExecution superExecution(String processInstanceId, boolean hasBuildingBlockVariable, String buildingBlockDocumentId) {
        return delegateExecution(processInstanceId, null, null, hasBuildingBlockVariable, buildingBlockDocumentId);
    }

    private DelegateExecution delegateExecution(
        String processInstanceId,
        DelegateExecution superExecution,
        BpmnModelInstance modelInstance,
        boolean hasBuildingBlockVariable,
        String buildingBlockDocumentId
    ) {
        return (DelegateExecution) Proxy.newProxyInstance(
            getClass().getClassLoader(),
            new Class[] {DelegateExecution.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "getProcessInstanceId" -> processInstanceId;
                case "getSuperExecution" -> superExecution;
                case "getBpmnModelInstance" -> modelInstance;
                case "hasVariableLocal" -> hasBuildingBlockVariable;
                case "getVariableLocal" -> {
                    if (hasBuildingBlockVariable && BUILDING_BLOCK_INSTANCE_ID_VARIABLE.equals(args[0])) {
                        yield buildingBlockDocumentId;
                    }
                    yield null;
                }
                case "setVariable" -> null;
                default -> null;
            }
        );
    }

    private BpmnModelInstance bpmnModelInstance() {
        return Bpmn.createExecutableProcess("process")
            .name(PROCESS_NAME)
            .startEvent("start")
            .done();
    }

    private Document.Id documentId(UUID id) {
        Document.Id documentId = mock(Document.Id.class);
        when(documentId.getId()).thenReturn(id);
        return documentId;
    }
}
