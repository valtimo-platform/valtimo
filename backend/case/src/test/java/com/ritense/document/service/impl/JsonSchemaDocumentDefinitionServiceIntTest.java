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

package com.ritense.document.service.impl;

import static com.ritense.authorization.AuthorizationContext.runWithoutAuthorization;
import static com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN;
import static com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ritense.BaseIntegrationTest;
import com.ritense.authorization.permission.ConditionContainer;
import com.ritense.authorization.permission.Permission;
import com.ritense.authorization.permission.condition.FieldPermissionCondition;
import com.ritense.authorization.permission.condition.PermissionConditionOperator;
import com.ritense.case_.domain.definition.CaseDefinition;
import com.ritense.case_.repository.CaseDefinitionRepository;
import com.ritense.document.domain.DocumentDefinition;
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition;
import com.ritense.document.exception.UnknownDocumentDefinitionException;
import com.ritense.document.service.JsonSchemaDocumentDefinitionActionProvider;
import com.ritense.document.service.result.DeployDocumentDefinitionResultSucceeded;
import com.ritense.valtimo.contract.case_.CaseDefinitionId;
import jakarta.validation.ValidationException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ResourceLoader;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.transaction.annotation.Transactional;

@Tag("integration")
@Transactional
class JsonSchemaDocumentDefinitionServiceIntTest extends BaseIntegrationTest {

    private static final String VERSIONED_KEY = "versioned-path-validation-int-test";
    private static final CaseDefinitionId ACTIVE_VERSION = new CaseDefinitionId(VERSIONED_KEY, "1.0.0");
    private static final CaseDefinitionId INACTIVE_VERSION = new CaseDefinitionId(VERSIONED_KEY, "1.1.0");
    private static final CaseDefinitionId UNKNOWN_VERSION = new CaseDefinitionId(VERSIONED_KEY, "9.9.9");

    @Autowired
    private ResourceLoader resourceLoader;

    @Autowired
    private CaseDefinitionRepository caseDefinitionRepository;

    @Test
    @WithMockUser(username = USERNAME, authorities = FULL_ACCESS_ROLE)
    void validateJsonPathShouldValidateAgainstTheGivenVersion() {
        deployVersions();

        documentDefinitionService.validateJsonPath(INACTIVE_VERSION, "doc:fase.huidigefase");
        assertThatThrownBy(() -> documentDefinitionService.validateJsonPath(VERSIONED_KEY, "doc:fase.huidigefase"))
            .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> documentDefinitionService.validateJsonPath(ACTIVE_VERSION, "doc:fase.huidigefase"))
            .isInstanceOf(ValidationException.class);
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = FULL_ACCESS_ROLE)
    void validateJsonPointerShouldValidateAgainstTheGivenVersion() {
        deployVersions();

        documentDefinitionService.validateJsonPointer(INACTIVE_VERSION, "/fase/huidigefase");
        assertThatThrownBy(() -> documentDefinitionService.validateJsonPointer(INACTIVE_VERSION, "/fase/unknown"))
            .isInstanceOf(ValidationException.class)
            .hasMessageContaining(VERSIONED_KEY);
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = FULL_ACCESS_ROLE)
    void shouldThrowForUnknownVersion() {
        deployVersions();

        assertThatThrownBy(() -> documentDefinitionService.validateJsonPath(UNKNOWN_VERSION, "doc:name"))
            .isInstanceOf(UnknownDocumentDefinitionException.class);
        assertThatThrownBy(() -> documentDefinitionService.validateJsonPointer(UNKNOWN_VERSION, "/name"))
            .isInstanceOf(UnknownDocumentDefinitionException.class);
    }

    private void deployVersions() {
        deployVersion(ACTIVE_VERSION, true, "{ \"name\": { \"type\": \"string\" } }");
        deployVersion(INACTIVE_VERSION, false, """
            {
                "name": { "type": "string" },
                "fase": {
                    "type": "object",
                    "properties": { "huidigefase": { "type": ["string", "null"] } },
                    "additionalProperties": false
                }
            }
            """);
    }

    private void deployVersion(CaseDefinitionId id, boolean active, String properties) {
        caseDefinitionRepository.saveAndFlush(new CaseDefinition(
            id, VERSIONED_KEY, null, null, null, null, false, active, false, false, false, null, null, null, null, null, null
        ));
        var schema = """
            {
                "$id": "%s.schema",
                "$schema": "http://json-schema.org/draft-07/schema#",
                "type": "object",
                "properties": %s,
                "additionalProperties": false
            }
            """.formatted(VERSIONED_KEY, properties);
        var result = runWithoutAuthorization(() -> documentDefinitionService.deploy(schema, id));
        assertThat(result).isInstanceOf(DeployDocumentDefinitionResultSucceeded.class);
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = FULL_ACCESS_ROLE)
    void shouldNotFindVersionsForNonExistingDocumentDefinitionName() {
        final var versions = documentDefinitionService.findVersionsByName("nothing");
        assertThat(versions)
            .isEmpty();
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = USER)
    void shouldGetForRolesOnly() {
        final var expectedDefinition = runWithoutAuthorization(() -> documentDefinitionService.findActiveByName("house")).get();

        final var unexpectedDefinition = runWithoutAuthorization(() -> documentDefinitionService.findActiveByName("person")).get();

        permissionRepository.save(new Permission(
            UUID.randomUUID(),
            JsonSchemaDocumentDefinition.class,
            JsonSchemaDocumentDefinitionActionProvider.VIEW_LIST,
            new ConditionContainer(List.of(
                new FieldPermissionCondition<>(
                    "id.name",
                    PermissionConditionOperator.EQUAL_TO,
                    "house"
                )
            )),
            roleRepository.findByKey(USER)
        ));

        final var all = (List<DocumentDefinition>) documentDefinitionService.findAll(Pageable.unpaged()).getContent();
        assertThat(all).contains(expectedDefinition);
        assertThat(all).doesNotContain(unexpectedDefinition);
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = ADMIN)
    void shouldGetAllForAdmin() {
        assertThatThrownBy(() -> documentDefinitionService.findAllForManagement(Pageable.unpaged()))
            .isExactlyInstanceOf(AccessDeniedException.class);

        final var all = (List<DocumentDefinition>) runWithoutAuthorization(() -> documentDefinitionService.findAllForManagement(Pageable.unpaged())).toList();
        assertThat(all).hasSizeGreaterThanOrEqualTo(7);
    }
}