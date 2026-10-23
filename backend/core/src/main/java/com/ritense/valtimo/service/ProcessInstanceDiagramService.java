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

import static com.ritense.authorization.AuthorizationContext.runWithoutAuthorization;
import static com.ritense.valtimo.camunda.repository.CamundaHistoricProcessInstanceSpecificationHelper.byProcessInstanceId;

import com.ritense.valtimo.camunda.domain.CamundaHistoricProcessInstance;
import com.ritense.valtimo.camunda.service.CamundaHistoryService;
import com.ritense.valtimo.web.rest.dto.ProcessInstanceDiagramDto;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.camunda.bpm.engine.HistoryService;
import org.camunda.bpm.engine.RepositoryService;
import org.camunda.bpm.engine.history.HistoricActivityInstance;
import org.camunda.bpm.engine.impl.util.IoUtil;
import org.camunda.bpm.engine.rest.dto.repository.ProcessDefinitionDiagramDto;

/**
 * Builds the {@link ProcessInstanceDiagramDto} (BPMN XML + historic activity instances) for a
 * process instance. Reads historic data, so it works for completed instances. Does not perform
 * authorization itself; callers are responsible for authorizing access to the related case/document.
 */
public class ProcessInstanceDiagramService {

    private final CamundaHistoryService camundaHistoryService;
    private final RepositoryService repositoryService;
    private final HistoryService historyService;

    public ProcessInstanceDiagramService(
        final CamundaHistoryService camundaHistoryService,
        final RepositoryService repositoryService,
        final HistoryService historyService
    ) {
        this.camundaHistoryService = camundaHistoryService;
        this.repositoryService = repositoryService;
        this.historyService = historyService;
    }

    public ProcessInstanceDiagramDto getProcessInstanceDiagram(String processInstanceId) throws UnsupportedEncodingException {
        CamundaHistoricProcessInstance processInstance = runWithoutAuthorization(
            () -> camundaHistoryService.findHistoricProcessInstance(byProcessInstanceId(processInstanceId))
        );
        if (processInstance == null) {
            return null;
        }

        ProcessDefinitionDiagramDto definitionDiagramDto =
            createProcessDefinitionDiagramDto(processInstance.getProcessDefinitionId());
        if (definitionDiagramDto == null) {
            return null;
        }

        List<HistoricActivityInstance> historicActivityInstances = historyService.createHistoricActivityInstanceQuery()
            .processInstanceId(processInstanceId)
            .orderPartiallyByOccurrence()
            .asc()
            .list();

        return ProcessInstanceDiagramDto.create(definitionDiagramDto, historicActivityInstances);
    }

    private ProcessDefinitionDiagramDto createProcessDefinitionDiagramDto(String processDefinitionId) throws UnsupportedEncodingException {
        InputStream processModelIn = repositoryService.getProcessModel(processDefinitionId);
        if (processModelIn == null) {
            return null;
        }
        byte[] processModel = IoUtil.readInputStream(processModelIn, "processModelBpmn20Xml");
        return ProcessDefinitionDiagramDto.create(processDefinitionId, new String(processModel, StandardCharsets.UTF_8));
    }
}
