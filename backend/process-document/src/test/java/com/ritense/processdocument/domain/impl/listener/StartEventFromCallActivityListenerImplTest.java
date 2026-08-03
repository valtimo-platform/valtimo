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

import com.ritense.processdocument.service.ProcessDocumentAssociationService;
import com.ritense.valtimo.event.OperatonExecutionEvent;
import java.lang.reflect.Proxy;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.operaton.bpm.engine.delegate.DelegateExecution;
import org.operaton.bpm.model.bpmn.Bpmn;
import org.operaton.bpm.model.bpmn.BpmnModelInstance;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class StartEventFromCallActivityListenerImplTest {

    private static final String PROCESS_NAME = "call-activity-start";

    private ProcessDocumentAssociationService processDocumentAssociationService;
    private StartEventFromCallActivityListenerImpl listener;

    @BeforeEach
    void setUp() {
        processDocumentAssociationService = mock(ProcessDocumentAssociationService.class);
        listener = new StartEventFromCallActivityListenerImpl(
            processDocumentAssociationService
        );
    }

    @Test
    void notifyShouldAssociateDocumentWhenDocumentIsFound() {
        String processInstanceId = UUID.randomUUID().toString();
        UUID documentUuid = UUID.randomUUID();
        // The document id is resolved from the process business key.
        DelegateExecution execution = execution(processInstanceId, documentUuid.toString());

        listener.notify(new OperatonExecutionEvent(execution, "start"));

        verify(processDocumentAssociationService).createProcessDocumentInstance(
            processInstanceId,
            documentUuid,
            PROCESS_NAME
        );
    }

    @Test
    void notifyShouldNotAssociateDocumentWhenDocumentIsNotFound() {
        String processInstanceId = UUID.randomUUID().toString();
        // No business key -> no document id can be resolved.
        DelegateExecution execution = execution(processInstanceId, null);

        listener.notify(new OperatonExecutionEvent(execution, "start"));

        verify(processDocumentAssociationService, never()).createProcessDocumentInstance(
            eq(processInstanceId),
            eq(null),
            eq(PROCESS_NAME)
        );
    }

    private DelegateExecution execution(String processInstanceId, String businessKey) {
        return (DelegateExecution) Proxy.newProxyInstance(
            getClass().getClassLoader(),
            new Class[] {DelegateExecution.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "getProcessInstanceId" -> processInstanceId;
                case "getBusinessKey", "getProcessBusinessKey" -> businessKey;
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
}
