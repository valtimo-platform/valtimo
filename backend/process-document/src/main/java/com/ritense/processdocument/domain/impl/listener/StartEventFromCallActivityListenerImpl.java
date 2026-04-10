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

import com.ritense.authorization.annotation.RunWithoutAuthorization;
import com.ritense.document.domain.Document;
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId;
import com.ritense.processdocument.domain.listener.StartEventFromCallActivityListener;
import com.ritense.processdocument.service.ProcessDocumentAssociationService;
import com.ritense.processdocument.service.ProcessDocumentService;
import com.ritense.valtimo.event.OperatonExecutionEvent;
import org.operaton.bpm.engine.delegate.DelegateExecution;
import org.operaton.bpm.model.bpmn.impl.instance.ProcessImpl;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;

public class StartEventFromCallActivityListenerImpl implements StartEventFromCallActivityListener {

    private final ProcessDocumentAssociationService processDocumentAssociationService;
    private final ProcessDocumentService processDocumentService;

    public StartEventFromCallActivityListenerImpl(
        ProcessDocumentAssociationService processDocumentAssociationService,
        ProcessDocumentService processDocumentService
    ) {
        this.processDocumentAssociationService = processDocumentAssociationService;
        this.processDocumentService = processDocumentService;
    }

    @Order(200)
    @RunWithoutAuthorization
    @EventListener(condition = "#event.delegateExecution.bpmnModelElementInstance != null " +
        "&& #event.delegateExecution.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).START_EVENT " +
        "&& #event.eventName == T(org.operaton.bpm.engine.delegate.ExecutionListener).EVENTNAME_START")
    public void notify(OperatonExecutionEvent event) {
        DelegateExecution execution = event.getDelegateExecution();
        Document.Id documentId = getDocumentId(execution);
        if (documentId != null && !associationExists(execution.getProcessInstanceId())) {
            processDocumentAssociationService.createProcessDocumentInstance(
                execution.getProcessInstanceId(),
                documentId.getId(),
                getProcessNameFrom(execution)
            );
        }
    }

    private boolean associationExists(String processInstanceId) {
        return processDocumentAssociationService.findProcessDocumentInstance(new OperatonProcessInstanceId(processInstanceId)).isPresent();
    }

    /**
     * Gets the document ID for this process instance.
     * The document is determined by the process's business key, which is set to:
     * - Case document ID for case processes and their sub-processes
     * - Building block document ID for building block processes and their sub-processes
     */
    private Document.Id getDocumentId(DelegateExecution execution) {
        var processId = new OperatonProcessInstanceId(execution.getProcessInstanceId());
        return processDocumentService.getDocumentId(processId, execution);
    }

    private String getProcessNameFrom(DelegateExecution execution) {
        return execution
            .getBpmnModelInstance()
            .getDefinitions()
            .getRootElements()
            .stream()
            .filter(rootElement -> rootElement instanceof ProcessImpl)
            .filter(rootElement -> ((ProcessImpl) rootElement).isExecutable())
            .findFirst()
            .orElseThrow()
            .getAttributeValue("name");
    }

}