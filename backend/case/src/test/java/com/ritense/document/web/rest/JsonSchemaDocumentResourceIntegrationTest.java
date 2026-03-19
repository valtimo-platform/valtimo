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

package com.ritense.document.web.rest;

import static com.ritense.valtimo.contract.utils.TestUtil.convertObjectToJsonBytes;
import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ritense.BaseIntegrationTest;
import com.ritense.document.domain.impl.JsonDocumentContent;
import com.ritense.document.domain.impl.JsonSchemaDocument;
import com.ritense.document.domain.impl.request.AssignToDocumentsRequest;
import com.ritense.document.web.rest.impl.JsonSchemaDocumentResource;
import com.ritense.outbox.domain.BaseEvent;
import com.ritense.valtimo.contract.authentication.Team;
import com.ritense.valtimo.contract.event.DocumentDeletedEvent;
import java.util.List;
import java.util.function.Supplier;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class JsonSchemaDocumentResourceIntegrationTest extends BaseIntegrationTest {
    private static final String USER_EMAIL = "user@valtimo.nl";

    private JsonSchemaDocument document;
    private JsonSchemaDocumentResource jsonSchemaDocumentResource;
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        var content = new JsonDocumentContent("{\"street\": \"Funenpark\"}");
        final JsonSchemaDocument.CreateDocumentResultImpl result = JsonSchemaDocument.create(
            definition(),
            content,
            USERNAME,
            getDocumentSequenceGeneratorService(),
            null
        );
        document = result.resultingDocument().orElseThrow();
        documentRepository.save(document);

        jsonSchemaDocumentResource = new JsonSchemaDocumentResource(documentService);
        mockMvc = MockMvcBuilders
            .standaloneSetup(jsonSchemaDocumentResource)
            .setCustomArgumentResolvers(new org.springframework.data.web.PageableHandlerMethodArgumentResolver())
            .build();
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldAssignUserToCase() throws Exception {
        var user = mockUser("John", "Doe");
        var loggedInUser = mockUser("Henk", "de Vries");
        when(userManagementService.findByUsername(user.getUsername())).thenReturn(user);
        when(userManagementService.findById(user.getId())).thenReturn(user);
        when(userManagementService.getCurrentUser()).thenReturn(loggedInUser);

        var postContent = "{ \"assigneeId\": \"" + user.getId() + "\"}";

        mockMvc.perform(
                post("/api/v1/document/{documentId}/assign", document.id().getId().toString())
                    .content(postContent)
                    .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk());

        // Assert that the assignee is saved in the document
        var result = documentRepository.findById(document.id());

        assertTrue(result.isPresent());
        assertInstanceOf(JsonSchemaDocument.class, result.get());

        var savedDocument = (JsonSchemaDocument) result.get();
        assertNotNull(savedDocument.assigneeId());
        assertEquals(user.getUsername(), savedDocument.assigneeId());
        assertNotNull(savedDocument.assigneeFullName());
        assertEquals(user.getFullName(), savedDocument.assigneeFullName());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldAssignUserToMultipleCases() throws Exception {
        var content = new JsonDocumentContent("{\"street\": \"Park\"}");
        final JsonSchemaDocument.CreateDocumentResultImpl resultDoc = JsonSchemaDocument.create(
            definition(),
            content,
            USERNAME,
            getDocumentSequenceGeneratorService(),
            null
        );
        var document2 = resultDoc.resultingDocument().orElseThrow();
        documentRepository.save(document2);

        var user = mockUser("John", "Doe");
        var loggedInUser = mockUser("Henk", "de Vries");
        when(userManagementService.findByUsername(user.getUsername())).thenReturn(user);
        when(userManagementService.findById(user.getId())).thenReturn(user);
        when(userManagementService.getCurrentUser()).thenReturn(loggedInUser);

        AssignToDocumentsRequest assignToDocumentsRequest = new AssignToDocumentsRequest(List.of(document.id().getId(), document2.id().getId()), user.getId());

        mockMvc.perform(
                post("/api/v1/document/assign")
                    .characterEncoding(UTF_8)
                    .content(convertObjectToJsonBytes(assignToDocumentsRequest))
                    .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk());

        // Assert that the assignee is saved in the document
        var result1 = documentRepository.findById(document.id());
        var result2 = documentRepository.findById(document2.id());

        assertTrue(result1.isPresent());
        assertInstanceOf(JsonSchemaDocument.class, result1.get());
        assertTrue(result2.isPresent());
        assertInstanceOf(JsonSchemaDocument.class, result2.get());

        var savedDocument = (JsonSchemaDocument) result1.get();
        assertNotNull(savedDocument.assigneeId());
        assertEquals(user.getUsername(), savedDocument.assigneeId());
        assertNotNull(savedDocument.assigneeFullName());
        assertEquals(user.getFullName(), savedDocument.assigneeFullName());

        var savedDocument2 = (JsonSchemaDocument) result2.get();
        assertNotNull(savedDocument2.assigneeId());
        assertEquals(user.getUsername(), savedDocument2.assigneeId());
        assertNotNull(savedDocument2.assigneeFullName());
        assertEquals(user.getFullName(), savedDocument2.assigneeFullName());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldAssignUserToSingleCasesWithMultipleCasesPresent() throws Exception {
        var content = new JsonDocumentContent("{\"street\": \"Park\"}");
        final JsonSchemaDocument.CreateDocumentResultImpl resultDoc = JsonSchemaDocument.create(
            definition(),
            content,
            USERNAME,
            getDocumentSequenceGeneratorService(),
            null
        );
        var document2 = resultDoc.resultingDocument().orElseThrow();
        documentRepository.save(document2);

        var user = mockUser("John", "Doe");
        var loggedInUser = mockUser("Henk", "de Vries");
        when(userManagementService.findByUsername(user.getUsername())).thenReturn(user);
        when(userManagementService.findById(user.getId())).thenReturn(user);
        when(userManagementService.getCurrentUser()).thenReturn(loggedInUser);

        AssignToDocumentsRequest assignToDocumentsRequest = new AssignToDocumentsRequest(List.of(document.id().getId()), user.getId());

        mockMvc.perform(
                post("/api/v1/document/assign")
                    .characterEncoding(UTF_8)
                    .content(convertObjectToJsonBytes(assignToDocumentsRequest))
                    .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk());

        // Assert that the assignee is saved in the document
        var result1 = documentRepository.findById(document.id());
        var result2 = documentRepository.findById(document2.id());

        assertTrue(result1.isPresent());
        assertInstanceOf(JsonSchemaDocument.class, result1.get());
        assertTrue(result2.isPresent());
        assertInstanceOf(JsonSchemaDocument.class, result2.get());

        var savedDocument = (JsonSchemaDocument) result1.get();
        assertNotNull(savedDocument.assigneeId());
        assertEquals(user.getUsername(), savedDocument.assigneeId());
        assertNotNull(savedDocument.assigneeFullName());
        assertEquals(user.getFullName(), savedDocument.assigneeFullName());

        var savedDocument2 = (JsonSchemaDocument) result2.get();
        assertNull(savedDocument2.assigneeId());
        assertNull(savedDocument2.assigneeFullName());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldNotAssignInvalidUserId() throws Exception {
        var user = mockUser("John", "Doe");
        when(userManagementService.findByUsername(user.getUsername())).thenReturn(null);

        var postContent = "{ \"assigneeId\": \"" + user.getId() + "\"}";

        mockMvc.perform(
                post("/api/v1/document/{documentId}/assign", document.id().getId().toString())
                    .content(user.getUsername())
                    .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldUnassignUserFromCase() throws Exception {
        var user = mockUser("John", "Doe");
        when(userManagementService.findByUsername(user.getUsername())).thenReturn(user);
        when(userManagementService.findById(user.getId())).thenReturn(user);

        mockMvc.perform(
                post("/api/v1/document/{documentId}/unassign", document.id().getId().toString())
                    .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk());

        // Assert that the assignee is saved in the document
        var result = documentRepository.findById(document.id());

        assertTrue(result.isPresent());
        assertInstanceOf(JsonSchemaDocument.class, result.get());

        var savedDocument = (JsonSchemaDocument) result.get();
        assertNull(savedDocument.assigneeId());
        assertNull(savedDocument.assigneeFullName());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldAssignTeamToCase() throws Exception {
        String teamKey = "team-key";
        String teamTitle = "Team Title";
        when(teamManagementService.findByKey(teamKey)).thenReturn(new Team() {
            @Override public String getKey() { return teamKey; }
            @Override public String getTitle() { return teamTitle; }
        });

        var postContent = "{ \"assignedTeamKey\": \"" + teamKey + "\"}";

        mockMvc.perform(
                post("/api/v1/document/{documentId}/assign", document.id().getId().toString())
                    .content(postContent)
                    .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk());

        // Assert that the team is saved in the document
        var result = documentRepository.findById(document.id());

        assertTrue(result.isPresent());
        assertInstanceOf(JsonSchemaDocument.class, result.get());

        var savedDocument = result.get();
        assertNotNull(savedDocument.assignedTeamKey());
        assertEquals(teamKey, savedDocument.assignedTeamKey());
        assertNotNull(savedDocument.assignedTeamTitle());
        assertEquals(teamTitle, savedDocument.assignedTeamTitle());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldUnassignTeamFromCase() throws Exception {
        document.setAssignedTeamKey("team-key");
        document.setAssignedTeamTitle("Team Title");
        documentRepository.save(document);

        mockMvc.perform(
                post("/api/v1/document/{documentId}/unassign", document.id().getId().toString())
                    .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk());

        // Assert that the team is cleared in the document
        var result = documentRepository.findById(document.id());

        assertTrue(result.isPresent());
        assertInstanceOf(JsonSchemaDocument.class, result.get());

        var savedDocument = result.get();
        assertNull(savedDocument.assignedTeamKey());
        assertNull(savedDocument.assignedTeamTitle());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldUnassignUserViaAssignEndpointWithEmptyString() throws Exception {
        document.setAssignee("some-user", "Some User");
        documentRepository.save(document);

        var postContent = "{ \"assigneeId\": \"\"}";

        mockMvc.perform(
                post("/api/v1/document/{documentId}/assign", document.id().getId().toString())
                    .content(postContent)
                    .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk());

        var result = documentRepository.findById(document.id());
        assertTrue(result.isPresent());

        var savedDocument = (JsonSchemaDocument) result.get();
        assertNull(savedDocument.assigneeId());
        assertNull(savedDocument.assigneeFullName());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldUnassignTeamViaAssignEndpointWithEmptyString() throws Exception {
        document.setAssignedTeamKey("team-key");
        document.setAssignedTeamTitle("Team Title");
        documentRepository.save(document);

        var postContent = "{ \"assignedTeamKey\": \"\"}";

        mockMvc.perform(
                post("/api/v1/document/{documentId}/assign", document.id().getId().toString())
                    .content(postContent)
                    .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk());

        var result = documentRepository.findById(document.id());
        assertTrue(result.isPresent());

        var savedDocument = result.get();
        assertNull(savedDocument.assignedTeamKey());
        assertNull(savedDocument.assignedTeamTitle());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldUnassignUserAndKeepTeamViaAssignEndpoint() throws Exception {
        var user = mockUser("John", "Doe");
        when(userManagementService.findByUsername(user.getUsername())).thenReturn(user);
        when(userManagementService.findById(user.getId())).thenReturn(user);
        when(userManagementService.getCurrentUser()).thenReturn(user);

        document.setAssignee(user.getUsername(), user.getFullName());
        document.setAssignedTeamKey("team-key");
        document.setAssignedTeamTitle("Team Title");
        documentRepository.save(document);

        // Send empty assigneeId to unassign user, omit assignedTeamKey to keep it unchanged
        var postContent = "{ \"assigneeId\": \"\"}";

        mockMvc.perform(
                post("/api/v1/document/{documentId}/assign", document.id().getId().toString())
                    .content(postContent)
                    .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk());

        var result = documentRepository.findById(document.id());
        assertTrue(result.isPresent());

        var savedDocument = (JsonSchemaDocument) result.get();
        assertNull(savedDocument.assigneeId());
        assertNull(savedDocument.assigneeFullName());
        // Team should remain unchanged
        assertEquals("team-key", savedDocument.assignedTeamKey());
        assertEquals("Team Title", savedDocument.assignedTeamTitle());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldUnassignTeamAndKeepUserViaAssignEndpoint() throws Exception {
        var user = mockUser("John", "Doe");
        when(userManagementService.findByUsername(user.getUsername())).thenReturn(user);
        when(userManagementService.findById(user.getId())).thenReturn(user);
        when(userManagementService.getCurrentUser()).thenReturn(user);

        document.setAssignee(user.getUsername(), user.getFullName());
        document.setAssignedTeamKey("team-key");
        document.setAssignedTeamTitle("Team Title");
        documentRepository.save(document);

        // Send empty assignedTeamKey to unassign team, omit assigneeId to keep it unchanged
        var postContent = "{ \"assignedTeamKey\": \"\"}";

        mockMvc.perform(
                post("/api/v1/document/{documentId}/assign", document.id().getId().toString())
                    .content(postContent)
                    .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk());

        var result = documentRepository.findById(document.id());
        assertTrue(result.isPresent());

        var savedDocument = (JsonSchemaDocument) result.get();
        // User should remain unchanged
        assertNotNull(savedDocument.assigneeId());
        assertEquals(user.getUsername(), savedDocument.assigneeId());
        // Team should be cleared
        assertNull(savedDocument.assignedTeamKey());
        assertNull(savedDocument.assignedTeamTitle());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldSendOutboxEventWhenRetrievingDocument() throws Exception {
        mockMvc.perform(get("/api/v1/document/{documentId}", document.id().getId().toString()))
            .andDo(print())
            .andExpect(status().isOk());

        ArgumentCaptor<Supplier<BaseEvent>> eventCapture = ArgumentCaptor.forClass(Supplier.class);
        verify(outboxService, times(1)).send(eventCapture.capture());
        var event = eventCapture.getValue().get();
        assertEquals("com.ritense.valtimo.document.viewed", event.getType());
        assertEquals("com.ritense.document.domain.impl.JsonSchemaDocument", event.getResultType());
        assertEquals(document.id().toString(), event.getResultId());
        assertEquals(objectMapper.valueToTree(document), event.getResult());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldDeleteDocumentAndSendEvent() throws Exception {
        mockMvc.perform(delete("/api/v1/document/{documentId}", document.id().getId().toString()))
            .andDo(print())
            .andExpect(status().isOk());

        verify(documentRepository, times(1)).delete(document);

        assertEquals(1, events.stream(DocumentDeletedEvent.class).count());
        var applicationEvent = events.stream(DocumentDeletedEvent.class).findFirst().orElseThrow();
        assertEquals(document.id().getId(), applicationEvent.getCaseDocumentId());

        ArgumentCaptor<Supplier<BaseEvent>> outboxEventCaptor = ArgumentCaptor.forClass(Supplier.class);
        verify(outboxService, times(2)).send(outboxEventCaptor.capture());
        //first event is the viewed event, so we get the second one
        var outboxEvent = outboxEventCaptor.getAllValues().get(1).get();
        assertEquals("com.ritense.valtimo.document.deleted", outboxEvent.getType());
        assertEquals("com.ritense.document.domain.impl.JsonSchemaDocument", outboxEvent.getResultType());
        assertEquals(document.id().toString(), outboxEvent.getResultId());
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldGetCandidateTeams() throws Exception {
        var teams = List.<Team>of(new Team() {
            @Override public String getKey() { return "team-1"; }
            @Override public String getTitle() { return "Team One"; }
        });
        when(teamManagementService.findAll(any(Pageable.class)))
            .thenReturn(new PageImpl<>(teams, Pageable.ofSize(20), teams.size()));

        mockMvc.perform(get("/api/v1/document/{document-id}/candidate-team", document.id().getId().toString())
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].key").value("team-1"))
            .andExpect(jsonPath("$.content[0].title").value("Team One"));
    }
}
