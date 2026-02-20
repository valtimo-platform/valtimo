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

import static com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX;
import static com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX;
import static com.ritense.valtimo.operaton.repository.OperatonHistoricProcessInstanceSpecificationHelper.byStartUserId;
import static com.ritense.valtimo.operaton.repository.OperatonHistoricProcessInstanceSpecificationHelper.byUnfinished;
import static com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.NAME;
import static com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.VERSION;
import static com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.byActive;
import static com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.byBlueprintId;
import static com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.byKey;
import static com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.byLatestVersion;
import static com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.byNotLinkedToBuildingBlock;
import static com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.byNotLinkedToCaseDefinition;
import static com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.byVersionTag;

import com.fasterxml.jackson.core.JsonPointer;
import com.ritense.authorization.Action;
import com.ritense.authorization.AuthorizationContext;
import com.ritense.authorization.AuthorizationService;
import com.ritense.authorization.request.EntityAuthorizationRequest;
import com.ritense.valtimo.contract.BlueprintId;
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId;
import com.ritense.valtimo.contract.case_.CaseDefinitionId;
import com.ritense.valtimo.contract.config.ValtimoProperties;
import com.ritense.valtimo.event.ProcessDefinitionDetached;
import com.ritense.valtimo.exception.FileExtensionNotSupportedException;
import com.ritense.valtimo.exception.NoFileExtensionFoundException;
import com.ritense.valtimo.exception.ProcessDefinitionNotFoundException;
import com.ritense.valtimo.exception.ProcessNotDeployableException;
import com.ritense.valtimo.helper.OperatonDeploymentSourceHelper;
import com.ritense.valtimo.operaton.authorization.OperatonExecutionActionProvider;
import com.ritense.valtimo.operaton.domain.OperatonDeploymentSource;
import com.ritense.valtimo.operaton.domain.OperatonExecution;
import com.ritense.valtimo.operaton.domain.OperatonHistoricProcessInstance;
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition;
import com.ritense.valtimo.operaton.domain.ProcessInstanceWithDefinition;
import com.ritense.valtimo.operaton.repository.OperatonExecutionRepository;
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionRepository;
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper;
import com.ritense.valtimo.operaton.service.OperatonHistoryService;
import com.ritense.valtimo.operaton.service.OperatonRepositoryService;
import com.ritense.valtimo.operaton.service.OperatonRuntimeService;
import com.ritense.valtimo.service.util.FormUtils;
import jakarta.annotation.Nullable;
import jakarta.validation.constraints.NotNull;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.operaton.bpm.engine.FormService;
import org.operaton.bpm.engine.RepositoryService;
import org.operaton.bpm.engine.RuntimeService;
import org.operaton.bpm.engine.impl.persistence.entity.SuspensionState;
import org.operaton.bpm.engine.repository.DecisionDefinition;
import org.operaton.bpm.engine.repository.DecisionDefinitionQuery;
import org.operaton.bpm.engine.repository.DeploymentWithDefinitions;
import org.operaton.bpm.engine.repository.ProcessDefinition;
import org.operaton.bpm.engine.runtime.ProcessInstance;
import org.operaton.bpm.model.bpmn.Bpmn;
import org.operaton.bpm.model.bpmn.BpmnModelInstance;
import org.operaton.bpm.model.bpmn.instance.BusinessRuleTask;
import org.operaton.bpm.model.bpmn.instance.CallActivity;
import org.operaton.bpm.model.bpmn.instance.EndEvent;
import org.operaton.bpm.model.bpmn.instance.ExtensionElements;
import org.operaton.bpm.model.bpmn.instance.IntermediateThrowEvent;
import org.operaton.bpm.model.bpmn.instance.MessageEventDefinition;
import org.operaton.bpm.model.bpmn.instance.Process;
import org.operaton.bpm.model.bpmn.instance.SendTask;
import org.operaton.bpm.model.bpmn.instance.ServiceTask;
import org.operaton.bpm.model.bpmn.instance.TimeDuration;
import org.operaton.bpm.model.bpmn.instance.TimerEventDefinition;
import org.operaton.bpm.model.bpmn.instance.operaton.OperatonIn;
import org.operaton.bpm.model.dmn.Dmn;
import org.operaton.bpm.model.dmn.DmnModelInstance;
import org.operaton.bpm.model.dmn.instance.Decision;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

public class OperatonProcessService {
    public static final String DETACHED_PROCESS_DEFINITION_PREFIX = "DETACHED:";

    private static final String UNDEFINED_BUSINESS_KEY = "UNDEFINED_BUSINESS_KEY";
    private static final Logger logger = LoggerFactory.getLogger(OperatonProcessService.class);

    private final RuntimeService runtimeService;
    private final OperatonRuntimeService operatonRuntimeService;
    private final RepositoryService repositoryService;
    private final OperatonRepositoryService operatonRepositoryService;
    private final FormService formService;
    private final OperatonHistoryService historyService;
    private final ProcessPropertyService processPropertyService;
    private final ValtimoProperties valtimoProperties;
    private final AuthorizationService authorizationService;
    private final ProcessDefinitionCaseDefinitionLinker processDefinitionCaseDefinitionLinker;
    private final OperatonByteArrayService operatonByteArrayService;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final OperatonExecutionRepository operatonExecutionRepository;
    private final OperatonDeploymentSourceHelper operatonDeploymentSourceHelper;
    private final OperatonProcessDefinitionRepository operatonProcessDefinitionRepository;

    public OperatonProcessService(
        RuntimeService runtimeService,
        OperatonRuntimeService operatonRuntimeService,
        RepositoryService repositoryService,
        OperatonRepositoryService operatonRepositoryService,
        FormService formService,
        OperatonHistoryService historyService,
        ProcessPropertyService processPropertyService,
        ValtimoProperties valtimoProperties,
        AuthorizationService authorizationService,
        OperatonExecutionRepository operatonExecutionRepository,
        ProcessDefinitionCaseDefinitionLinker processDefinitionCaseDefinitionLinker,
        OperatonByteArrayService operatonByteArrayService,
        ApplicationEventPublisher applicationEventPublisher,
        OperatonDeploymentSourceHelper operatonDeploymentSourceHelper,
        OperatonProcessDefinitionRepository operatonProcessDefinitionRepository
    ) {
        this.runtimeService = runtimeService;
        this.operatonRuntimeService = operatonRuntimeService;
        this.repositoryService = repositoryService;
        this.operatonRepositoryService = operatonRepositoryService;
        this.formService = formService;
        this.historyService = historyService;
        this.processPropertyService = processPropertyService;
        this.valtimoProperties = valtimoProperties;
        this.authorizationService = authorizationService;
        this.operatonExecutionRepository = operatonExecutionRepository;
        this.processDefinitionCaseDefinitionLinker = processDefinitionCaseDefinitionLinker;
        this.operatonByteArrayService = operatonByteArrayService;
        this.applicationEventPublisher = applicationEventPublisher;
        this.operatonDeploymentSourceHelper = operatonDeploymentSourceHelper;
        this.operatonProcessDefinitionRepository = operatonProcessDefinitionRepository;
    }

    public OperatonProcessDefinition findProcessDefinitionById(String processDefinitionId) {
        denyAuthorization();
        return AuthorizationContext
            .runWithoutAuthorization(() -> operatonRepositoryService.findProcessDefinitionById(processDefinitionId));
    }

    public OperatonProcessDefinition getProcessDefinitionById(String processDefinitionId) {
        denyAuthorization();
        var processDefinition = AuthorizationContext
            .runWithoutAuthorization(() -> findProcessDefinitionById(processDefinitionId));
        if (processDefinition == null) {
            throw new ProcessDefinitionNotFoundException("with id '" + processDefinitionId + "'.");
        } else {
            return processDefinition;
        }
    }

    public boolean processDefinitionExistsByKey(String processDefinitionKey) {
        denyAuthorization();
        return AuthorizationContext
            .runWithoutAuthorization(
                () -> operatonRepositoryService.countProcessDefinitions(byKey(processDefinitionKey)) >= 1
            );
    }

    public Optional<ProcessInstance> findProcessInstanceById(String processInstanceId) {
        denyAuthorization();
        return Optional.ofNullable(runtimeService
            .createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult());
    }

    public List<ProcessInstance> findProcessInstancesByIds(Set<String> processInstanceIds) {
        denyAuthorization();
        return runtimeService
            .createProcessInstanceQuery()
            .processInstanceIds(processInstanceIds)
            .list();
    }

    public ProcessDefinition getProcessDefinitionByDeploymentId(String deploymentId) {
        denyAuthorization();

        return AuthorizationContext.runWithoutAuthorization(() -> {
            var processDefinition = repositoryService.createProcessDefinitionQuery()
                .deploymentId(deploymentId)
                .singleResult();

            if (processDefinition == null) {
                throw new ProcessDefinitionNotFoundException("No process definition found for deployment ID: " + deploymentId);
            }

            return processDefinition;
        });
    }

    @Nullable
    public OperatonExecution findExecutionByProcessInstanceId(String processInstanceId) {
        denyAuthorization();
        return operatonExecutionRepository.findById(processInstanceId).orElse(null);
    }

    @Nullable
    public OperatonExecution findExecutionByBusinessKey(String businessKey) {
        denyAuthorization();
        return operatonExecutionRepository.findByBusinessKey(businessKey).orElse(null);
    }

    public void deleteProcessInstanceById(String processInstanceId, String reason) {
        denyAuthorization();
        runtimeService.deleteProcessInstance(processInstanceId, reason, true, true, true, false);
    }

    public void removeProcessVariables(String processInstanceId, Collection<String> variableNames) {
        denyAuthorization();
        runtimeService.removeVariables(processInstanceId, variableNames);
    }

    public ProcessInstanceWithDefinition startProcess(
        String processDefinitionKey,
        String businessKey,
        Map<String, Object> variables
    ) {
        return startProcess(processDefinitionKey, businessKey, null, variables);
    }

    public ProcessInstanceWithDefinition startProcess(
        String processDefinitionKey,
        String businessKey,
        final BlueprintId blueprintId,
        Map<String, Object> variables
    ) {
        final OperatonProcessDefinition processDefinition = AuthorizationContext
            .runWithoutAuthorization(() -> {
                var pd = operatonRepositoryService.findProcessDefinition(
                    // TODO: FIX THIS NOW
                    byKey(processDefinitionKey).and(byBlueprintId(blueprintId))
                );
                if (pd != null) {
                    return pd;
                } else {
                    // Needed by the VerzoekPlugin:
                    return operatonRepositoryService.findProcessDefinition(
                        byKey(processDefinitionKey).and(OperatonProcessDefinitionSpecificationHelper.maxVersionOf(byNotLinkedToCaseDefinition()))
                    );
                }
            });
        if (processDefinition == null) {
            throw new IllegalStateException("No process definition found with key: '" + processDefinitionKey + "' and blueprintId: '" + blueprintId + "'");
        }
        businessKey = businessKey.equals(UNDEFINED_BUSINESS_KEY) ? null : businessKey;

        authorizationService.requirePermission(
            new EntityAuthorizationRequest(
                OperatonExecution.class,
                OperatonExecutionActionProvider.CREATE,
                createDummyOperatonExecution(
                    processDefinition,
                    businessKey
                )
            )
        );

        ProcessInstance processInstance = formService.submitStartForm(
            processDefinition.getId(),
            businessKey,
            FormUtils.createTypedVariableMap(variables)
        );

        return new ProcessInstanceWithDefinition(processInstance, processDefinition);
    }

    public OperatonExecution createDummyOperatonExecution(
        @NotNull OperatonProcessDefinition processDefinition,
        String businessKey
    ) {
        OperatonExecution execution = new OperatonExecution(
            UUID.randomUUID().toString(),
            1,
            null,
            null,
            businessKey,
            null,
            processDefinition,
            null,
            null,
            null,
            null,
            null,
            true,
            false,
            false,
            false,
            SuspensionState.ACTIVE.getStateCode(),
            0,
            0,
            null,
            new HashSet<>()
        );
        execution.setProcessInstance(execution);

        return execution;
    }

    /**
     * @deprecated Please use getDefinitionByKeyAndCaseDefinition(...)
     */
    @Deprecated(since = "Since 13.8.0", forRemoval = true)
    public OperatonProcessDefinition getProcessDefinition(String processDefinitionKey) {
        denyAuthorization();
        return AuthorizationContext
            .runWithoutAuthorization(() -> operatonRepositoryService.findLatestProcessDefinition(processDefinitionKey));
    }

    public Map<String, Object> getProcessInstanceVariables(String processInstanceId, List<String> variableNames) {
        denyAuthorization();
        return AuthorizationContext
            .runWithoutAuthorization(() -> operatonRuntimeService.getVariables(processInstanceId, variableNames));
    }

    public Map<String, Object> getProcessInstanceVariablesByJsonPointers(
        String processInstanceId,
        List<JsonPointer> variablePointers
    ) {
        denyAuthorization();
        return AuthorizationContext.runWithoutAuthorization(() ->
            operatonRuntimeService.getVariablesByJsonPointers(processInstanceId, variablePointers)
        );
    }

    public List<OperatonHistoricProcessInstance> getAllActiveContextProcessesStartedByCurrentUser(
        Set<String> processes, String userLogin
    ) {
        denyAuthorization();
        List<OperatonHistoricProcessInstance> historicProcessInstances = AuthorizationContext.runWithoutAuthorization(
            () -> historyService.findHistoricProcessInstances(
                byStartUserId(userLogin).and(byUnfinished())
            )
        );

        return historicProcessInstances
            .stream()
            .filter(p -> processes.contains(p.getProcessDefinitionKey()))
            .sorted(Comparator.comparing(OperatonHistoricProcessInstance::getStartTime).reversed())
            .collect(Collectors.toList());
    }

    public List<OperatonProcessDefinition> getDeployedDefinitions() {
        denyAuthorization();
        return AuthorizationContext.runWithoutAuthorization(() -> operatonRepositoryService.findProcessDefinitions(
            byActive().and(byLatestVersion()),
            Sort.by(NAME)
        ));
    }

    public List<OperatonProcessDefinition> getDeployedDefinitions(CaseDefinitionId caseDefinitionId) {
        denyAuthorization();
        return AuthorizationContext.runWithoutAuthorization(() -> operatonRepositoryService.findProcessDefinitions(
            byActive()
                .and(byBlueprintId(caseDefinitionId)),
            Sort.by(NAME)
        ));
    }

    public List<OperatonProcessDefinition> getUnlinkedDeployedDefinitions() {
        denyAuthorization();
        return AuthorizationContext.runWithoutAuthorization(() ->
            operatonRepositoryService.findProcessDefinitions(
                    byActive().and(byNotLinkedToCaseDefinition()).and(byNotLinkedToBuildingBlock()),
                    Sort.by(NAME)
                ).stream()
                .collect(Collectors.groupingBy(
                    OperatonProcessDefinition::getKey,
                    Collectors.maxBy(Comparator.comparing(OperatonProcessDefinition::getVersion))
                ))
                .values()
                .stream()
                .flatMap(Optional::stream)
                .collect(Collectors.toList())
        );
    }

    public List<OperatonProcessDefinition> getUnlinkedDeployedDefinitionsByKey(String processDefinitionKey) {
        denyAuthorization();
        return AuthorizationContext.runWithoutAuthorization(() ->
            operatonRepositoryService.findProcessDefinitions(
                    byActive().and(byKey(processDefinitionKey)),
                    Sort.by(NAME)
                ).stream()
                .filter(def -> def.getVersionTag() == null || !def.getVersionTag()
                    .startsWith(OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX) || !def.getVersionTag()
                    .startsWith(OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX))
                .collect(Collectors.toList())
        );
    }

    public List<OperatonProcessDefinition> getDefinitionsByKeyAndBlueprint(
        BlueprintId blueprintId,
        String processDefinitionKey
    ) {
        denyAuthorization();
        return AuthorizationContext.runWithoutAuthorization(() -> operatonRepositoryService.findProcessDefinitions(
            byVersionTag(blueprintId.getTagPrefix() + blueprintId)
                .and(byKey(processDefinitionKey))
        ));
    }

    public OperatonProcessDefinition getLatestDefinitionByKeyAndBlueprint(
        BlueprintId blueprintId,
        String processDefinitionKey
    ) {
        denyAuthorization();
        return AuthorizationContext.runWithoutAuthorization(() -> operatonRepositoryService.findProcessDefinition(
            byBlueprintId(blueprintId)
                .and(byKey(processDefinitionKey))
        ));
    }

    public byte[] getBpmnModel(OperatonProcessDefinition operatonProcessDefinition) {
        return operatonByteArrayService.getByNameAndDeploymentId(
            operatonProcessDefinition.getResourceName(),
            operatonProcessDefinition.getDeploymentId()
        ).getBytes();
    }

    public List<OperatonProcessDefinition> getDefinitionsByKey(String processDefinitionKey) {
        denyAuthorization();
        return AuthorizationContext.runWithoutAuthorization(() ->
            operatonRepositoryService.findProcessDefinitions(
                byKey(processDefinitionKey)
            )
        );
    }

    public List<OperatonProcessDefinition> getGlobalDefinitionsByKey(String processDefinitionKey) {
        denyAuthorization();
        return AuthorizationContext.runWithoutAuthorization(() ->
            operatonRepositoryService.findProcessDefinitions(
                byKey(processDefinitionKey)
                    .and(byNotLinkedToCaseDefinition())
            )
        );
    }

    @Transactional
    public void deleteAllProcesses(String processDefinitionKey, String reason) {
        denyAuthorization();

        logger.debug("delete all running process instances for processes with key: {}", processDefinitionKey);

        List<ProcessInstance> runningInstances = runtimeService.createProcessInstanceQuery()
            .processDefinitionKey(processDefinitionKey)
            .list();

        AuthorizationContext.runWithoutAuthorization(() -> {
            runningInstances.forEach(i -> deleteProcessInstanceById(i.getProcessInstanceId(), reason));
            return null;
        });
    }

    @Transactional
    public void deleteProcessDefinition(String processDefinitionId) {
        denyAuthorization();

        // TODO: Discuss if cascade = true is the correct way to go about this
        AuthorizationContext.runWithoutAuthorization(() -> {
            repositoryService.deleteProcessDefinition(processDefinitionId, true);
            return null;
        });


    }

    @Transactional
    public DeploymentWithDefinitions deploy(
        BlueprintId blueprintId,
        String fileName,
        ByteArrayInputStream fileInput,
        boolean skipProcessLinksCopy,
        boolean skipIsDeployableCheck,
        @Nullable String originalVersionTag,
        @Nullable String originalProcessDefinitionId
    ) throws ProcessNotDeployableException, FileExtensionNotSupportedException, NoFileExtensionFoundException {
        denyAuthorization();

        if (fileName.endsWith(".bpmn")) {
            BpmnModelInstance bpmnModel = Bpmn.readModelFromStream(fileInput);

            if (!isDeployable(bpmnModel) && !skipIsDeployableCheck) {
                throw new ProcessNotDeployableException(fileName);
            }

            updateCaseDefinitionProcessesVersionTags(bpmnModel, blueprintId);
            updateBuildingBlockDefinitionProcessesVersionTags(bpmnModel, blueprintId);

            setProcessesExecutable(bpmnModel);
            setToNullWhenServiceTaskExpressionIsEmpty(bpmnModel);
            setToNullWhenSendTaskExpressionIsEmpty(bpmnModel);
            setToCorrelateAllWhenMessageSendEventExpressionIsEmpty(bpmnModel);
            setToPropagateBusinessKeyWhenCallActivityIsNew(bpmnModel);
            setTo60SecondsWhenTimerIsEmpty(bpmnModel);

            if (isProcessDefinitionPreviouslyDeployed(blueprintId, bpmnModel)) {
                return null;
            }

            OperatonProcessDefinition latestProcessDefinition = getExistingProcessForFile(blueprintId, bpmnModel);
            if (latestProcessDefinition != null && blueprintId != null) {
                // clean up previous process definition, can only be triggered when we're deploying a draft version
                applicationEventPublisher.publishEvent(new ProcessDefinitionDetached(
                    latestProcessDefinition.getId(),
                    blueprintId
                ));
                operatonProcessDefinitionRepository.setVersionTag(latestProcessDefinition.getId(), DETACHED_PROCESS_DEFINITION_PREFIX + blueprintId);
            }

            var deploymentBuilder = repositoryService.createDeployment()
                .addModelInstance(fileName, bpmnModel);

            OperatonDeploymentSource deploymentSource = new OperatonDeploymentSource(
                skipProcessLinksCopy,
                originalVersionTag,
                originalProcessDefinitionId
            );

            String deploymentSourceUuid = operatonDeploymentSourceHelper.store(deploymentSource);

            deploymentBuilder.source(deploymentSourceUuid);

            DeploymentWithDefinitions deployment = deploymentBuilder.deployWithResult();

            // TODO: Implement linking to process definition on this level for building blocks
            if (blueprintId != null
                && (OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX.equals(blueprintId.getTagPrefix()))) {
                processDefinitionCaseDefinitionLinker.link(
                    (CaseDefinitionId) blueprintId,
                    deployment.getDeployedProcessDefinitions().get(0).getId()
                );
            }

            return deployment;
        } else if (fileName.endsWith(".dmn")) {
            DmnModelInstance dmnModel = Dmn.readModelFromStream(fileInput);

            if (blueprintId != null) {
                setDecisionsVersionTag(dmnModel, blueprintId);

                String decisionDefinitionKey = dmnModel.getDefinitions()
                    .getChildElementsByType(Decision.class)
                    .stream()
                    .map(Decision::getId)
                    .findFirst()
                    .orElseThrow();

                DecisionDefinitionQuery decisionDefinitionQuery = repositoryService.createDecisionDefinitionQuery()
                    .decisionDefinitionKey(decisionDefinitionKey);

                if (blueprintId != null) {
                    decisionDefinitionQuery.versionTag(blueprintId.getTagPrefix() + blueprintId);
                }

                DecisionDefinition decisionDefinition = decisionDefinitionQuery.singleResult();

                if (decisionDefinition != null) {
                    repositoryService.deleteDeployment(decisionDefinition.getDeploymentId());
                }
            }

            return repositoryService.createDeployment().addModelInstance(fileName, dmnModel).deployWithResult();
        } else {
            String[] splitFileName = fileName.split("\\.");

            if (splitFileName.length > 1) {
                String fileExtension = splitFileName[splitFileName.length - 1];
                throw new FileExtensionNotSupportedException(fileExtension);
            } else {
                throw new NoFileExtensionFoundException(fileName);
            }
        }
    }

    @Transactional
    public DeploymentWithDefinitions deploy(
        BlueprintId blueprintId,
        String fileName,
        ByteArrayInputStream fileInput
    ) throws ProcessNotDeployableException, FileExtensionNotSupportedException, NoFileExtensionFoundException {
        return deploy(
            blueprintId,
            fileName,
            fileInput,
            false,
            false,
            null,
            null
        );
    }

    @Transactional
    public DeploymentWithDefinitions deploy(
        BlueprintId blueprintId,
        String fileName,
        ByteArrayInputStream fileInput,
        boolean skipProcessLinksCopy,
        boolean skipIsDeployableCheck
    ) throws ProcessNotDeployableException, FileExtensionNotSupportedException, NoFileExtensionFoundException {
        return deploy(blueprintId, fileName, fileInput, skipProcessLinksCopy, skipIsDeployableCheck, null, null);
    }

    private boolean isProcessDefinitionPreviouslyDeployed(
        BlueprintId blueprintId,
        BpmnModelInstance bpmnModel
    ) throws ProcessNotDeployableException {
        OperatonProcessDefinition latestProcessDefinition = getExistingProcessForFile(blueprintId, bpmnModel);

        if (latestProcessDefinition != null) {
            try {
                byte[] savedBytes = repositoryService.getResourceAsStream(
                        latestProcessDefinition.getDeploymentId(),
                        latestProcessDefinition.getResourceName()
                    )
                    .readAllBytes();

                ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                Bpmn.writeModelToStream(outputStream, bpmnModel);

                if (Arrays.equals(outputStream.toByteArray(), savedBytes)) {
                    outputStream.close();
                    return true;
                }

                outputStream.close();

            } catch (IOException e) {
                throw new ProcessNotDeployableException(blueprintId + " and process: " + latestProcessDefinition.getKey());
            }
        }
        return false;
    }

    public OperatonProcessDefinition getExistingProcessForFile(
        BlueprintId blueprintId,
        BpmnModelInstance bpmnModel
    ) {
        String processDefinitionKey = bpmnModel.getModelElementsByType(Process.class).stream()
            .map(Process::getId)
            .findFirst().orElseThrow();

        List<OperatonProcessDefinition> processDefinition = operatonRepositoryService.findProcessDefinitions(
            byKey(processDefinitionKey)
                .and(byActive())
                .and(blueprintId == null ? byNotLinkedToCaseDefinition() : byVersionTag(
                    blueprintId.getTagPrefix() + blueprintId))
            ,
            Sort.by(Sort.Order.desc(VERSION))
        );

        if (processDefinition.size() > 1 && blueprintId != null) {
            throw new IllegalStateException(
                "Only one process definition should be found for key: " + processDefinitionKey
                    + " and case definition id: " + blueprintId
            );
        } else if (processDefinition.size() > 0) {
            return processDefinition.getFirst();
        } else {
            return null;
        }
    }

     public void setBuildingBlockDefinitionProcessesVersionTags(BpmnModelInstance bpmnModel, BuildingBlockDefinitionId buildingBlockDefinitionId) {
        String currentBuildingBlockVersionTag = OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX + buildingBlockDefinitionId.toString();

        // Set version tag on all processes in this building block
        bpmnModel.getDefinitions().getChildElementsByType(Process.class).forEach(
            process -> {
                process.setOperatonVersionTag(currentBuildingBlockVersionTag);
            }
        );

        // Collect all process keys defined in this building block
        Set<String> processKeysInBuildingBlock = bpmnModel.getDefinitions().getChildElementsByType(Process.class).stream()
            .map(Process::getId)
            .collect(Collectors.toSet());

        // Only update call activities that call processes within this building block
        // or don't already have a BB: version tag pointing to a different building block
        bpmnModel.getModelElementsByType(CallActivity.class).forEach(callActivity -> {
            String calledElement = callActivity.getCalledElement();
            String existingVersionTag = callActivity.getOperatonCalledElementVersionTag();

            // If calling a process within this building block, set the version tag
            if (calledElement != null && processKeysInBuildingBlock.contains(calledElement)) {
                callActivity.setOperatonCalledElementBinding("versionTag");
                callActivity.setOperatonCalledElementVersionTag(currentBuildingBlockVersionTag);
                return;
            }

            // If already has a BB: version tag pointing to a different building block, preserve it
            // (this is a call to another building block and should not be modified)
            BuildingBlockDefinitionId existingBuildingBlockId = BuildingBlockDefinitionId.fromProcessVersionTag(existingVersionTag);
            if (existingBuildingBlockId != null && !existingBuildingBlockId.equals(buildingBlockDefinitionId)) {
                return;
            }

            // Otherwise, set to this building block's version tag (default behavior for processes
            // within this building block that weren't caught by the process key check above)
            callActivity.setOperatonCalledElementBinding("versionTag");
            callActivity.setOperatonCalledElementVersionTag(currentBuildingBlockVersionTag);
        });
    }

    void updateCaseDefinitionProcessesVersionTags(
        BpmnModelInstance bpmnModel,
        @Nullable BlueprintId blueprintId
    ) {
        if (blueprintId != null && blueprintId.getTagPrefix().equals(OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX)) {
            setCaseDefinitionProcessesVersionTags(bpmnModel, (CaseDefinitionId) blueprintId);
        } else {
            clearCaseDefinitionProcessesVersionTags(bpmnModel);
        }
    }

    void updateBuildingBlockDefinitionProcessesVersionTags(
        BpmnModelInstance bpmnModel,
        @Nullable BlueprintId blueprintId
    ) {
        if (blueprintId != null && blueprintId.getTagPrefix().equals(OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX)) {
            setBuildingBlockDefinitionProcessesVersionTags(bpmnModel, (BuildingBlockDefinitionId) blueprintId);
        }
    }

    private void setCaseDefinitionProcessesVersionTags(BpmnModelInstance bpmnModel, CaseDefinitionId caseDefinitionId) {
        bpmnModel.getDefinitions().getChildElementsByType(Process.class).forEach(
            process -> {
                process.setOperatonVersionTag(OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX + caseDefinitionId.toString());
            }
        );

        bpmnModel.getModelElementsByType(CallActivity.class).forEach(callActivity -> {
            String binding = callActivity.getOperatonCalledElementBinding();
            String existingVersionTag = callActivity.getOperatonCalledElementVersionTag();

            CaseDefinitionId existingCaseDefinitionId =
                CaseDefinitionId.fromProcessVersionTag(existingVersionTag);

            // we skip when a binding is already set and the existing version tag is present, but it does not represent a case definition version tag.
            if (binding != null && (existingVersionTag != null && existingCaseDefinitionId == null)) {
                return;
            }

            callActivity.setOperatonCalledElementBinding("versionTag");
            callActivity.setOperatonCalledElementVersionTag(
                OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX + caseDefinitionId
            );
        });

        bpmnModel.getModelElementsByType(BusinessRuleTask.class).forEach(businessRuleTask -> {
            String binding = businessRuleTask.getOperatonDecisionRefBinding();
            String existingVersionTag = businessRuleTask.getOperatonDecisionRefVersionTag();

            CaseDefinitionId existingCaseDefinitionId =
                CaseDefinitionId.fromProcessVersionTag(existingVersionTag);

            // we skip when a binding is already set and the existing version tag is present, but it does not represent a case definition version tag.
            if (binding != null && (existingVersionTag != null && existingCaseDefinitionId == null)) {
                return;
            }

            businessRuleTask.setOperatonDecisionRefBinding("versionTag");
            businessRuleTask.setOperatonDecisionRefVersionTag(
                OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX + caseDefinitionId
            );
        });
    }

    private void clearCaseDefinitionProcessesVersionTags(BpmnModelInstance bpmnModel) {
        bpmnModel.getDefinitions().getChildElementsByType(Process.class)
            .forEach(process -> {
                String existingVersionTag = process.getOperatonVersionTag();
                CaseDefinitionId id = CaseDefinitionId.fromProcessVersionTag(existingVersionTag);

                if (id != null) {
                    process.setOperatonVersionTag(null);
                }
            });

        bpmnModel.getModelElementsByType(CallActivity.class)
            .forEach(callActivity -> {
                String existingVersionTag = callActivity.getOperatonCalledElementVersionTag();
                CaseDefinitionId id = CaseDefinitionId.fromProcessVersionTag(existingVersionTag);

                if (id != null) {
                    callActivity.setOperatonCalledElementBinding(null);
                    callActivity.setOperatonCalledElementVersionTag(null);
                }
            });

        bpmnModel.getModelElementsByType(BusinessRuleTask.class)
            .forEach(businessRuleTask -> {
                String existingVersionTag = businessRuleTask.getOperatonDecisionRefVersionTag();
                CaseDefinitionId id = CaseDefinitionId.fromProcessVersionTag(existingVersionTag);

                if (id != null) {
                    businessRuleTask.setOperatonDecisionRefBinding(null);
                    businessRuleTask.setOperatonDecisionRefVersionTag(null);
                }
            });
    }

    public BpmnModelInstance getBpmnModelInstanceByProcessDefinitionId(String processDefinitionId) {
        denyAuthorization();

        OperatonProcessDefinition definition = getProcessDefinitionById(processDefinitionId);
        byte[] bytes = getBpmnModel(definition);

        return Bpmn.readModelFromStream(new ByteArrayInputStream(bytes));
    }

    @Transactional
    public DeploymentWithDefinitions duplicateProcessDefinitionById(
        BlueprintId blueprintId,
        String processDefinitionId,
        boolean skipProcessLinksCopy,
        boolean skipIsDeployableCheck
    )
        throws ProcessNotDeployableException, FileExtensionNotSupportedException, NoFileExtensionFoundException {
        denyAuthorization();

        ProcessDefinition processDefinition = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(processDefinitionId)
            .singleResult();

        if (processDefinition == null) {
            throw new ProcessDefinitionNotFoundException("No process definition found for ID: " + processDefinitionId);
        }

        String deploymentId = processDefinition.getDeploymentId();

        if (deploymentId == null) {
            throw new ProcessDefinitionNotFoundException(
                "No deployment ID found for process definition ID: " + processDefinitionId
            );
        }

        List<String> resourceNames = repositoryService.getDeploymentResourceNames(deploymentId);

        if (resourceNames.isEmpty()) {
            throw new ProcessNotDeployableException("No resources found for deployment ID: " + deploymentId);
        }

        // TODO: for old deployments where the whole resource folder was deployed, this might not be correct.
        String fileName = resourceNames.get(0);

        try (ByteArrayInputStream fileInput = new ByteArrayInputStream(
            repositoryService.getResourceAsStream(deploymentId, fileName).readAllBytes())) {
            return deploy(blueprintId, fileName, fileInput, skipProcessLinksCopy, skipIsDeployableCheck);

        } catch (IOException e) {
            logger.error("Error reading resource stream for file: {}", fileName, e);
            throw new ProcessNotDeployableException("Error reading resource stream for file: " + fileName);
        }
    }

    private void setDecisionsVersionTag(DmnModelInstance dmnModel, BlueprintId blueprintId) {
        dmnModel.getDefinitions().getChildElementsByType(Decision.class).forEach(
            dmn -> dmn.setVersionTag(blueprintId.getTagPrefix() + blueprintId.toString())
        );
    }

    private void setProcessesExecutable(BpmnModelInstance bpmnModel) {
        bpmnModel.getDefinitions().getChildElementsByType(Process.class).forEach(
            process -> process.setExecutable(true)
        );
    }

    private void setToNullWhenServiceTaskExpressionIsEmpty(BpmnModelInstance bpmnModel) {
        bpmnModel.getModelElementsByType(ServiceTask.class).forEach(task -> {
            if (task.getOperatonType() == null
                && task.getOperatonClass() == null
                && task.getOperatonExpression() == null
                && task.getOperatonDelegateExpression() == null) {
                task.setOperatonExpression("${null}");
                task.setOperatonAsyncAfter(true);
            }
        });
    }

    private void setToNullWhenSendTaskExpressionIsEmpty(BpmnModelInstance bpmnModel) {
        bpmnModel.getModelElementsByType(SendTask.class).forEach(task -> {
            if (task.getOperatonType() == null
                && task.getOperatonClass() == null
                && task.getOperatonExpression() == null
                && task.getOperatonDelegateExpression() == null) {
                task.setOperatonExpression("${null}");
                task.setOperatonAsyncAfter(true);
            }
        });
    }

    private void setToCorrelateAllWhenMessageSendEventExpressionIsEmpty(BpmnModelInstance bpmnModel) {
        Stream.of(IntermediateThrowEvent.class, EndEvent.class)
            .flatMap(sendEventClass -> bpmnModel.getModelElementsByType(sendEventClass).stream())
            .filter(sendEvent -> sendEvent.getId().matches("Event_[a-z0-9]{6,8}"))
            .flatMap(sendEvent -> sendEvent.getChildElementsByType(MessageEventDefinition.class).stream())
            .forEach(event -> {
                if (event.getOperatonType() == null
                    && event.getOperatonClass() == null
                    && event.getOperatonExpression() == null
                    && event.getOperatonDelegateExpression() == null) {
                    String messageName = event.getMessage() == null ? "MY_MESSAGE" : event.getMessage().getName();
                    event.setOperatonExpression(
                        "${correlationService.sendMessageToAll(\"" + messageName + "\", execution)}"
                    );
                }
            });
    }

    private void setToPropagateBusinessKeyWhenCallActivityIsNew(BpmnModelInstance bpmnModel) {
        bpmnModel.getModelElementsByType(CallActivity.class).forEach(callActivity -> {
            if (callActivity.getId().matches("Activity_[a-z0-9]{6,8}")
                && callActivity.getCalledElement() != null
                && callActivity.getChildElementsByType(ExtensionElements.class).isEmpty()) {
                ExtensionElements extensionElement = bpmnModel.newInstance(ExtensionElements.class);
                callActivity.addChildElement(extensionElement);
                OperatonIn businessKeyIn = bpmnModel.newInstance(OperatonIn.class);
                businessKeyIn.setOperatonBusinessKey("#{execution.processBusinessKey}");
                extensionElement.addChildElement(businessKeyIn);
                callActivity.setOperatonAsyncAfter(true);
            }
        });
    }

    private void setTo60SecondsWhenTimerIsEmpty(BpmnModelInstance bpmnModel) {
        bpmnModel.getModelElementsByType(TimerEventDefinition.class).forEach(timerEvent -> {
            if (timerEvent.getTimeDate() == null
                && timerEvent.getTimeDuration() == null
                && timerEvent.getTimeCycle() == null) {
                TimeDuration timeDuration = bpmnModel.newInstance(TimeDuration.class);
                timeDuration.setTextContent("PT60S");
                timerEvent.addChildElement(timeDuration);
            }
        });
    }

    private boolean isDeployable(BpmnModelInstance model) {
        AtomicBoolean isDeployable = new AtomicBoolean(true);
        if (valtimoProperties.getProcess().isSystemProcessUpdatable()) {
            return isDeployable.get();
        }
        model.getDefinitions().getChildElementsByType(Process.class).forEach(
            process -> {
                String processDefinitionKey = process.getId();
                String versionTag = process.getOperatonVersionTag();
                if (processDefinitionKey == null || processDefinitionKey.isEmpty() || isSystemProcess(
                    AuthorizationContext
                        .runWithoutAuthorization(
                            () -> operatonRepositoryService.findProcessDefinition(
                                byKey(processDefinitionKey)
                                    .and(OperatonProcessDefinitionSpecificationHelper.maxVersionOf(versionTag != null ? byVersionTag(versionTag) : byNotLinkedToCaseDefinition()))
                            )
                        )
                )) {
                    isDeployable.set(false);
                }
            });
        return isDeployable.get();
    }

    private boolean isSystemProcess(OperatonProcessDefinition processDefinition) {
        if (processDefinition == null) {
            return false;
        }
        var processProperties = processPropertyService.findByProcessDefinitionKey(processDefinition.getKey());
        if (processProperties != null) {
            return processProperties.isSystemProcess();
        }
        return false;
    }

    private void denyAuthorization() {
        authorizationService.requirePermission(
            new EntityAuthorizationRequest(
                OperatonProcessDefinition.class,
                Action.deny()
            )
        );
    }
}
