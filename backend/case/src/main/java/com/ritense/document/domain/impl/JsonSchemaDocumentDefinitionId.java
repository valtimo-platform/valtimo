/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.document.domain.impl;

import static com.ritense.valtimo.contract.utils.AssertionConcern.assertArgumentLength;
import static com.ritense.valtimo.contract.utils.AssertionConcern.assertArgumentNotNull;
import static com.ritense.valtimo.contract.utils.AssertionConcern.assertArgumentTrue;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.ritense.document.domain.DocumentDefinition;
import com.ritense.document.domain.JsonSchemaDocumentDefinitionSolutionModuleId;
import com.ritense.document.domain.JsonSchemaDocumentDefinitionSolutionModuleType;
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId;
import com.ritense.valtimo.contract.case_.CaseDefinitionId;
import com.ritense.valtimo.contract.domain.AbstractId;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Embedded;
import java.util.Objects;

@Embeddable
public class JsonSchemaDocumentDefinitionId extends AbstractId<JsonSchemaDocumentDefinitionId>
    implements DocumentDefinition.Id {

    @Column(name = "document_definition_name", length = 50, columnDefinition = "VARCHAR(50)", nullable = false, updatable = true)
    private String name;

    @Embedded
    private JsonSchemaDocumentDefinitionSolutionModuleId solutionModuleId;

    @JsonCreator
    private JsonSchemaDocumentDefinitionId(String name, JsonSchemaDocumentDefinitionSolutionModuleId solutionModuleId) {
        assertArgumentId(name, solutionModuleId);
        this.name = name;
        this.solutionModuleId = solutionModuleId;
    }

    private JsonSchemaDocumentDefinitionId() {
    }

    private void assertArgumentId(String name, JsonSchemaDocumentDefinitionSolutionModuleId ownerId) {
        assertArgumentNotNull(name, "name is required");
        assertArgumentLength(name, 1, 50, "name must be between 1-50 characters");
        assertArgumentTrue(name.matches("[A-z0-9-_.]+"), "name contains illegal character. For name: " + name);
        assertArgumentNotNull(ownerId, "ownerId is required");
    }

    public static JsonSchemaDocumentDefinitionId of(String name, CaseDefinitionId caseDefinitionId) {
        return forCase(name, caseDefinitionId);
    }

    public static JsonSchemaDocumentDefinitionId forCase(String name, CaseDefinitionId caseDefinitionId) {
        return new JsonSchemaDocumentDefinitionId(name, JsonSchemaDocumentDefinitionSolutionModuleId.Companion.forCase(caseDefinitionId));
    }

    public static JsonSchemaDocumentDefinitionId forBuildingBlock(String name, BuildingBlockDefinitionId buildingBlockDefinitionId) {
        return new JsonSchemaDocumentDefinitionId(name, JsonSchemaDocumentDefinitionSolutionModuleId.Companion.forBuildingBlock(buildingBlockDefinitionId));
    }

    public static JsonSchemaDocumentDefinitionId existingId(String name, CaseDefinitionId caseDefinitionId) {
        return forCase(name, caseDefinitionId);
    }

    public static JsonSchemaDocumentDefinitionId existingId(DocumentDefinition.Id documentDefinitionId) {
        return (JsonSchemaDocumentDefinitionId) documentDefinitionId;
    }

    public JsonSchemaDocumentDefinitionSolutionModuleType ownerType() {
        return solutionModuleId.solutionModuleType();
    }

    @Override
    public String name() {
        return name;
    }

    @Override
    public CaseDefinitionId caseDefinitionId() {
        return solutionModuleId.asCaseDefinitionId();
    }

    @Override
    public BuildingBlockDefinitionId buildingBlockDefinitionId() {
        return solutionModuleId.asBuildingBlockDefinitionId();
    }

    public JsonSchemaDocumentDefinitionSolutionModuleId ownerId() {
        return solutionModuleId;
    }

    @Override
    public String toString() {
        return name + ":" + solutionModuleId.solutionModuleType() + ":" + solutionModuleId.solutionModuleKey() + ":" + solutionModuleId.solutionModuleVersionTag();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        JsonSchemaDocumentDefinitionId that = (JsonSchemaDocumentDefinitionId) o;
        return Objects.equals(name, that.name) && Objects.equals(solutionModuleId, that.solutionModuleId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, solutionModuleId);
    }
}
