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

package com.ritense.valtimo.web.rest.dto;

import com.ritense.valtimo.processautofill.web.rest.dto.AutofilledElementDto;
import org.operaton.bpm.engine.rest.dto.repository.ProcessDefinitionDiagramDto;

import java.util.List;

public class ProcessDefinitionDiagramWithPropertyDto {

    private String id;
    private String bpmn20Xml;
    private boolean readOnly;
    private boolean systemProcess;
    private List<AutofilledElementDto> autofilledElements;

    public String getId() {
        return id;
    }

    public String getBpmn20Xml() {
        return bpmn20Xml;
    }

    /**
     * @deprecated no process definition is read-only anymore, so this is always {@code false}.
     */
    @Deprecated(since = "13.44.0", forRemoval = true)
    public boolean isReadOnly() {
        return readOnly;
    }

    public boolean isSystemProcess() {
        return systemProcess;
    }

    public List<AutofilledElementDto> getAutofilledElements() {
        return autofilledElements;
    }

    public ProcessDefinitionDiagramWithPropertyDto(
        ProcessDefinitionDiagramDto processDefinitionDiagramDto,
        boolean readOnly,
        boolean systemProcess,
        List<AutofilledElementDto> autofilledElements
    ) {
        this.id = processDefinitionDiagramDto.getId();
        this.bpmn20Xml = processDefinitionDiagramDto.getBpmn20Xml();
        this.readOnly = readOnly;
        this.systemProcess = systemProcess;
        this.autofilledElements = autofilledElements;
    }

}
