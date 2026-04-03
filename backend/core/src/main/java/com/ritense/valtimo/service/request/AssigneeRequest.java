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

package com.ritense.valtimo.service.request;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

public class AssigneeRequest {

    @JsonProperty
    private final String assignee;

    @JsonProperty
    private final String assignedTeamKey;

    @JsonCreator
    public AssigneeRequest(
        @JsonProperty(value = "assignee") String assignee,
        @JsonProperty(value = "assignedTeamKey") String assignedTeamKey
    ) {
        this.assignee = assignee;
        this.assignedTeamKey = assignedTeamKey;
    }

    public String getAssignee() {
        return this.assignee;
    }

    public String getAssignedTeamKey() {
        return this.assignedTeamKey;
    }
}