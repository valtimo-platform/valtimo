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

package com.ritense.document.domain.impl.request;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public class AssignToDocumentsRequest {
    @JsonProperty
    @NotNull
    private final List<UUID> documentIds;

    @JsonProperty
    private final String assigneeId;

    @JsonProperty
    private final String assignedTeamKey;

    @JsonCreator
    public AssignToDocumentsRequest(
        @JsonProperty(value = "documentIds", required = true) List<UUID> documentIds,
        @JsonProperty(value = "assigneeId") String assigneeId,
        @JsonProperty(value = "assignedTeamKey") String assignedTeamKey
    ) {
        this.documentIds = documentIds;
        this.assigneeId = assigneeId;
        this.assignedTeamKey = assignedTeamKey;
    }

    public List<UUID> getDocumentIds() {
        return documentIds;
    }

    public String getAssigneeId() {
        return assigneeId;
    }

    public String getAssignedTeamKey() {
        return assignedTeamKey;
    }
}
