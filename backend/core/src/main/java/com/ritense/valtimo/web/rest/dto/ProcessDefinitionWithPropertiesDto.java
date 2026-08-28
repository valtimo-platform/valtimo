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

package com.ritense.valtimo.web.rest.dto;

import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition;
import org.operaton.bpm.engine.rest.dto.repository.ProcessDefinitionDto;

public class ProcessDefinitionWithPropertiesDto extends ProcessDefinitionDto {

    protected boolean isReadOnly;
    protected boolean systemProcess;

    @Deprecated(since = "13.44.0", forRemoval = true)
    public void setReadOnly(boolean isReadOnly) {
        this.isReadOnly = isReadOnly;
    }

    /**
     * @deprecated no process definition is read-only anymore; kept for existing clients, always {@code false}.
     */
    @Deprecated(since = "13.44.0", forRemoval = true)
    public boolean isReadOnly() {
        return isReadOnly;
    }

    public void setSystemProcess(boolean systemProcess) {
        this.systemProcess = systemProcess;
    }

    public boolean isSystemProcess() {
        return systemProcess;
    }

    public static ProcessDefinitionWithPropertiesDto fromProcessDefinition(OperatonProcessDefinition definition) {
        ProcessDefinitionWithPropertiesDto dto = new ProcessDefinitionWithPropertiesDto();
        dto.id = definition.getId();
        dto.key = definition.getKey();
        dto.category = definition.getCategory();
        dto.name = definition.getName();
        dto.version = definition.getVersion();
        dto.resource = definition.getResourceName();
        dto.deploymentId = definition.getDeploymentId();
        dto.diagram = definition.getDiagramResourceName();
        dto.suspended = definition.isSuspended();
        dto.tenantId = definition.getTenantId();
        dto.versionTag = definition.getVersionTag();
        dto.historyTimeToLive = definition.getHistoryTimeToLive();
        dto.isStartableInTasklist = definition.isStartableInTasklist();
        return dto;
    }

}
