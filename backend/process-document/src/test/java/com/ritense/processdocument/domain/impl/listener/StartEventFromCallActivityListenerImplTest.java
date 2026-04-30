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

package com.ritense.processdocument.domain.impl.listener;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ritense.document.domain.Document;
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId;
import com.ritense.processdocument.service.ProcessDocumentAssociationService;
import com.ritense.processdocument.service.ProcessDocumentService;
import com.ritense.valtimo.event.OperatonExecutionEvent;
import java.lang.reflect.Proxy;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
    void notifyShouldAssociateDocumentWhenDocumentIsFound() {
        String processInstanceId = UUID.randomUUID().toString();
        DelegateExecution execution = execution(processInstanceId);

        UUID documentUuid = UUID.randomUUID();
        Document.Id documentId = documentId(documentUuid);
        OperatonProcessInstanceId expectedProcessId = new OperatonProcessInstanceId(processInstanceId);

        when(processDocumentService.getDocumentId(expectedProcessId, execution)).thenReturn(documentId);

        listener.notify(new OperatonExecutionEvent(execution, "start"));

        verify(processDocumentService).getDocumentId(expectedProcessId, execution);
        verify(processDocumentAssociationService).createProcessDocumentInstance(
            processInstanceId,
            documentUuid,
            PROCESS_NAME
        );
    }

    @Test
    void notifyShouldNotAssociateDocumentWhenDocumentIsNotFound() {
        String processInstanceId = UUID.randomUUID().toString();
        DelegateExecution execution = execution(processInstanceId);

        OperatonProcessInstanceId expectedProcessId = new OperatonProcessInstanceId(processInstanceId);

        when(processDocumentService.getDocumentId(expectedProcessId, execution)).thenReturn(null);

        listener.notify(new OperatonExecutionEvent(execution, "start"));

        verify(processDocumentService).getDocumentId(expectedProcessId, execution);
        verify(processDocumentAssociationService, never()).createProcessDocumentInstance(
            eq(processInstanceId),
            eq(null),
            eq(PROCESS_NAME)
        );
    }

    private DelegateExecution execution(String processInstanceId) {
        return (DelegateExecution) Proxy.newProxyInstance(
            getClass().getClassLoader(),
            new Class[] {DelegateExecution.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "getProcessInstanceId" -> processInstanceId;
                case "getBpmnModelInstance" -> bpmnModelInstance();
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
