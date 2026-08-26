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

import com.ritense.authorization.AuthorizationContext;
import com.ritense.valtimo.operaton.service.OperatonRepositoryService;
import com.ritense.valtimo.contract.config.ValtimoProperties;
import com.ritense.valtimo.domain.processdefinition.ProcessDefinitionProperties;
import com.ritense.valtimo.processdefinition.repository.ProcessDefinitionPropertiesRepository;

public class ProcessPropertyService {

    private final ProcessDefinitionPropertiesRepository processDefinitionPropertiesRepository;
    private final ValtimoProperties valtimoProperties;
    private final OperatonRepositoryService repositoryService;

    public ProcessPropertyService(
        ProcessDefinitionPropertiesRepository processDefinitionPropertiesRepository,
        ValtimoProperties valtimoProperties,
        OperatonRepositoryService repositoryService
    ) {
        this.processDefinitionPropertiesRepository = processDefinitionPropertiesRepository;
        this.valtimoProperties = valtimoProperties;
        this.repositoryService = repositoryService;
    }

    public boolean isSystemProcessById(String processDefinitionId) {
        return isSystemProcess(getProcessDefinitionKeyById(processDefinitionId));
    }

    public boolean isSystemProcess(String processDefinitionKey) {
        final var processProperties = processDefinitionPropertiesRepository.findByProcessDefinitionKey(processDefinitionKey);
        if (processProperties == null) {
            throw new RuntimeException("Failed to find properties for process with key: " + processDefinitionKey);
        }
        return processProperties.isSystemProcess();
    }

    /**
     * A process that has no properties row yet is not a system process. Unlike
     * {@link #isSystemProcess(String)} this does not throw for such a key, which a listing endpoint
     * cannot afford.
     */
    public boolean isSystemProcessOrUnknown(String processDefinitionKey) {
        final var processProperties = processDefinitionPropertiesRepository.findByProcessDefinitionKey(processDefinitionKey);
        return processProperties != null && processProperties.isSystemProcess();
    }

    /**
     * @deprecated no process definition is read-only anymore, so this always returns
     *     {@code false}. A system process may always be edited; doing so deploys a new process
     *     definition version and leaves every case definition that pinned an earlier version
     *     untouched.
     */
    @Deprecated(since = "13.43.0", forRemoval = true)
    public boolean isReadOnlyById(String processDefinitionId) {
        return false;
    }

    @Deprecated(since = "13.43.0", forRemoval = true)
    public boolean isReadOnly(String processDefinitionKey) {
        return false;
    }

    private String getProcessDefinitionKeyById(String processDefinitionId) {
        var processDefinition = AuthorizationContext
            .runWithoutAuthorization(() -> repositoryService.findProcessDefinitionById(processDefinitionId));
        if (processDefinition == null) {
            throw new RuntimeException("Failed to find process definition with id: " + processDefinitionId);
        }
        return processDefinition.getKey();
    }

    public ProcessDefinitionProperties findByProcessDefinitionKey(String processDefinitionKey) {
        return processDefinitionPropertiesRepository.findByProcessDefinitionKey(processDefinitionKey);
    }

}
