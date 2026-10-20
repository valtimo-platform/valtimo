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

package com.ritense.valtimo.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.ritense.valtimo.operaton.domain.OperatonHistoricProcessInstance;
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition;
import com.ritense.valtimo.operaton.service.OperatonHistoryService;
import com.ritense.valtimo.operaton.service.OperatonRepositoryService;
import com.ritense.valtimo.web.rest.dto.ProcessInstanceDiagramDto;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.operaton.bpm.engine.HistoryService;
import org.operaton.bpm.engine.RepositoryService;
import org.operaton.bpm.engine.history.HistoricActivityInstanceQuery;

class ProcessInstanceDiagramServiceTest {

    private OperatonHistoryService operatonHistoryService;
    private RepositoryService repositoryService;
    private OperatonRepositoryService operatonRepositoryService;
    private HistoryService historyService;

    private ProcessInstanceDiagramService service;

    private static final String PROCESS_INSTANCE_ID = "process-instance-1";
    private static final String PROCESS_DEFINITION_ID = "my-process:1:abc";

    @BeforeEach
    void setUp() {
        operatonHistoryService = mock(OperatonHistoryService.class);
        repositoryService = mock(RepositoryService.class);
        operatonRepositoryService = mock(OperatonRepositoryService.class);
        historyService = mock(HistoryService.class, RETURNS_DEEP_STUBS);

        service = new ProcessInstanceDiagramService(
            operatonHistoryService,
            repositoryService,
            operatonRepositoryService,
            historyService
        );
    }

    @Test
    void shouldReturnNullWhenHistoricProcessInstanceDoesNotExist() throws Exception {
        when(operatonHistoryService.findHistoricProcessInstance(any())).thenReturn(null);

        assertNull(service.getProcessInstanceDiagram(PROCESS_INSTANCE_ID));
    }

    @Test
    void shouldReturnNullWhenProcessModelIsMissing() throws Exception {
        OperatonHistoricProcessInstance instance = historicInstance();
        when(operatonHistoryService.findHistoricProcessInstance(any())).thenReturn(instance);
        when(repositoryService.getProcessModel(PROCESS_DEFINITION_ID)).thenReturn(null);

        assertNull(service.getProcessInstanceDiagram(PROCESS_INSTANCE_ID));
    }

    @Test
    void shouldBuildDiagramFromHistoricData() throws Exception {
        String xml = "<bpmn>definition</bpmn>";
        OperatonHistoricProcessInstance instance = historicInstance();
        when(operatonHistoryService.findHistoricProcessInstance(any())).thenReturn(instance);
        when(repositoryService.getProcessModel(PROCESS_DEFINITION_ID))
            .thenReturn(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        when(operatonRepositoryService.findProcessDefinition(any())).thenReturn(null);
        HistoricActivityInstanceQuery query = mock(HistoricActivityInstanceQuery.class);
        when(historyService.createHistoricActivityInstanceQuery()).thenReturn(query);
        when(query.processInstanceId(any())).thenReturn(query);
        when(query.orderPartiallyByOccurrence()).thenReturn(query);
        when(query.asc()).thenReturn(query);
        when(query.list()).thenReturn(Collections.emptyList());

        ProcessInstanceDiagramDto diagram = service.getProcessInstanceDiagram(PROCESS_INSTANCE_ID);

        assertEquals(PROCESS_DEFINITION_ID, diagram.getId());
        assertEquals(xml, diagram.getBpmn20Xml());
    }

    @Test
    void shouldMarkDiagramNotExecutableWhenProcessDefinitionIsSuspended() throws Exception {
        String xml = "<bpmn isExecutable=\"true\">definition</bpmn>";
        OperatonHistoricProcessInstance instance = historicInstance();
        when(operatonHistoryService.findHistoricProcessInstance(any())).thenReturn(instance);
        when(repositoryService.getProcessModel(PROCESS_DEFINITION_ID))
            .thenReturn(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        OperatonProcessDefinition suspendedDefinition = mock(OperatonProcessDefinition.class);
        when(suspendedDefinition.isSuspended()).thenReturn(true);
        when(operatonRepositoryService.findProcessDefinition(any())).thenReturn(suspendedDefinition);
        HistoricActivityInstanceQuery query = mock(HistoricActivityInstanceQuery.class);
        when(historyService.createHistoricActivityInstanceQuery()).thenReturn(query);
        when(query.processInstanceId(any())).thenReturn(query);
        when(query.orderPartiallyByOccurrence()).thenReturn(query);
        when(query.asc()).thenReturn(query);
        when(query.list()).thenReturn(Collections.emptyList());

        ProcessInstanceDiagramDto diagram = service.getProcessInstanceDiagram(PROCESS_INSTANCE_ID);

        assertEquals("<bpmn isExecutable=\"false\">definition</bpmn>", diagram.getBpmn20Xml());
    }

    private OperatonHistoricProcessInstance historicInstance() {
        OperatonHistoricProcessInstance instance = mock(OperatonHistoricProcessInstance.class);
        when(instance.getProcessDefinitionId()).thenReturn(PROCESS_DEFINITION_ID);
        return instance;
    }
}
