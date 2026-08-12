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

package com.ritense.document.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.ritense.document.domain.validation.DocumentContentValidationResult;
import com.ritense.valtimo.contract.BlueprintId;
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId;
import com.ritense.valtimo.contract.case_.CaseDefinitionId;
import java.time.temporal.Temporal;

public interface DocumentDefinition {

    @JsonProperty
    Id id();

    @JsonProperty
    Temporal createdOn();

    @JsonProperty
    JsonNode schema();

    DocumentContentValidationResult validate(DocumentContent documentContent);

    interface Id {

        @JsonProperty
        String name();

        @JsonProperty
        default CaseDefinitionId caseDefinitionId() { return null; }

        @JsonProperty
        default BuildingBlockDefinitionId buildingBlockDefinitionId() { return null; }

        /**
         * The blueprint this document definition belongs to, regardless of its type. A document
         * definition is owned by either a case definition or a building block definition, so use
         * this whenever the caller does not care which of the two it is - {@link #caseDefinitionId()}
         * on its own returns {@code null} for building block documents.
         */
        @JsonIgnore
        default BlueprintId asBlueprintId() {
            CaseDefinitionId caseDefinitionId = caseDefinitionId();
            return caseDefinitionId != null ? caseDefinitionId : buildingBlockDefinitionId();
        }
    }

}