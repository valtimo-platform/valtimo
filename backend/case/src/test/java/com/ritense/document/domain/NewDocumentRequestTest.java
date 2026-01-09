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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ritense.document.domain.impl.request.NewDocumentRequest;
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId;
import com.ritense.valtimo.contract.case_.CaseDefinitionId;
import com.ritense.valtimo.contract.json.MapperSingleton;
import org.junit.jupiter.api.Test;

public class NewDocumentRequestTest {

    @Test
    public void shouldHaveEqualGetters() throws Exception {
        final ObjectMapper objectMapper = MapperSingleton.INSTANCE.get();
        final JsonNode jsonData = objectMapper.readTree(
            "{\"key\":123,\"somethingelse\":\"henk\",\"nested\":{\"henk\":\"jan\"}}");
        final String definitionName = "some-name";

        var newDocRequest = new NewDocumentRequest(
            definitionName,
            definitionName,
            "1.0.0",
            jsonData
        );

        assertThat(jsonData).isEqualTo(newDocRequest.content());
        assertThat(definitionName).isEqualTo(newDocRequest.documentDefinitionName());
    }

    @Test
    public void shouldExposeBuildingBlockBlueprint() throws Exception {
        final ObjectMapper objectMapper = MapperSingleton.INSTANCE.get();
        final JsonNode jsonData = objectMapper.readTree("{\"key\":123}");
        final String definitionName = "some-name";
        final var newDocRequest = new NewDocumentRequest(
            definitionName,
            null,
            null,
            "bb-key",
            "1.2.3",
            jsonData
        );

        assertThat(newDocRequest.blueprintId())
            .isEqualTo(BuildingBlockDefinitionId.of("bb-key", "1.2.3"));
    }

    @Test
    public void shouldExposeCaseBlueprintWhenPresent() throws Exception {
        final ObjectMapper objectMapper = MapperSingleton.INSTANCE.get();
        final JsonNode jsonData = objectMapper.readTree("{\"key\":123}");
        final var newDocRequest = new NewDocumentRequest(
            "some-name",
            "case-key",
            "1.0.0",
            jsonData
        );

        assertThat(newDocRequest.blueprintId())
            .isEqualTo(CaseDefinitionId.of("case-key", "1.0.0"));
    }

    @Test
    public void shouldRequireBlueprintDetails() throws Exception {
        final ObjectMapper objectMapper = MapperSingleton.INSTANCE.get();
        final JsonNode jsonData = objectMapper.readTree("{\"key\":123}");

        assertThatThrownBy(() -> new NewDocumentRequest(
            "definition",
            null,
            null,
            null,
            null,
            jsonData
        )).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    public void shouldRequireOnlyOneBlueprintDetails() throws Exception {
        final ObjectMapper objectMapper = MapperSingleton.INSTANCE.get();
        final JsonNode jsonData = objectMapper.readTree("{\"key\":123}");

        assertThatThrownBy(() -> new NewDocumentRequest(
            "definition",
            "case-key",
            "1.0.0",
            "bb-key",
            "1.2.3",
            jsonData
        )).isInstanceOf(IllegalArgumentException.class);
    }
}
