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

package com.ritense.valtimo.web.rest;

import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ritense.valtimo.contract.authentication.Team;
import com.ritense.valtimo.contract.authentication.UserManagementService;
import com.ritense.valtimo.operaton.dto.TeamDto;
import com.ritense.valtimo.contract.json.MapperSingleton;
import com.ritense.valtimo.operaton.dto.TaskExtended;
import com.ritense.valtimo.service.OperatonProcessService;
import com.ritense.valtimo.service.OperatonTaskService;
import com.ritense.valtimo.service.request.AssigneeRequest;
import com.ritense.valtimo.task.service.UserTaskOpenedStatusService;
import com.ritense.valtimo.service.request.SetDueDateRequest;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.operaton.bpm.engine.FormService;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class TaskResourceTest {

    private MockMvc mockMvc;
    private TaskResource taskResource;
    private FormService formService;
    private OperatonTaskService operatonTaskService;
    private OperatonProcessService operatonProcessService;
    private UserTaskOpenedStatusService userTaskOpenedStatusService;
    private UserManagementService userManagementService;
    private AssigneeRequest assigneeRequest;
    private SetDueDateRequest dueDateRequest;
    private ObjectMapper objectMapper;
    private String assigneeId = "AAAA-1111";
    private String taskId = UUID.randomUUID().toString();
    private LocalDateTime dueDate;

    @BeforeEach
    void init() {
        formService = mock(FormService.class);
        operatonTaskService = mock(OperatonTaskService.class);
        operatonProcessService = mock(OperatonProcessService.class);
        userTaskOpenedStatusService = mock(UserTaskOpenedStatusService.class);
        userManagementService = mock(UserManagementService.class);

        taskResource = new TaskResource(
            formService,
            operatonTaskService,
            operatonProcessService,
            userTaskOpenedStatusService,
            userManagementService
        );
        objectMapper = MapperSingleton.INSTANCE.get();

        assigneeRequest = new AssigneeRequest(assigneeId, null);

        dueDate = LocalDateTime.now().truncatedTo(ChronoUnit.MILLIS);
        dueDateRequest = new SetDueDateRequest(dueDate);

        MappingJackson2HttpMessageConverter converter = new MappingJackson2HttpMessageConverter();
        converter.setObjectMapper(objectMapper);
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(taskResource)
            .setMessageConverters(converter)
            .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
            .setValidator(validator)
            .build();
    }

    @Test
    void assign() throws Exception {
        mockMvc.perform(post("/api/v1/task/{taskId}/assign", taskId)
                .content(objectMapper.writeValueAsString(assigneeRequest))
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
            )
            .andDo(print())
            .andExpect(status().isOk());

        verify(operatonTaskService, times(1)).assign(taskId, assigneeId);
    }

    @Test
    void setDueDate() throws Exception {
        mockMvc.perform(post("/api/v1/task/{taskId}/set-due-date", taskId)
                .content(objectMapper.writeValueAsString(dueDateRequest))
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
            )
            .andDo(print())
            .andExpect(status().isOk());

        verify(operatonTaskService, times(1)).setDueDate(taskId, dueDate);
    }

    @Test
    void shouldRejectSetDueDateWhenDueDateIsNull() throws Exception {
        mockMvc.perform(post("/api/v1/task/{taskId}/set-due-date", taskId)
                .content("{\"dueDate\": null}")
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
            )
            .andDo(print())
            .andExpect(status().isBadRequest());
    }

    @Test
    void removeDueDate() throws Exception {
        mockMvc.perform(post("/api/v1/task/{taskId}/set-due-date", taskId)
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
            )
            .andDo(print())
            .andExpect(status().isOk());

        verify(operatonTaskService, times(1)).setDueDate(taskId, null);
    }

    @Test
    void getTasksPaged() throws Exception {
        List<TaskExtended> tasks = List.of(
            new TaskExtended(
                "1",
                "name",
                "assignee",
                LocalDateTime.now(),
                LocalDateTime.now(),
                LocalDateTime.now(),
                LocalDateTime.now(),
                "delegationState",
                "description",
                "executionId",
                "owner",
                "parentTaskId",
                1,
                "processDefinitionId",
                "processInstanceId",
                "taskDefinitionKey",
                "caseExecutionId",
                "caseInstanceId",
                "caseDefinitionId",
                true,
                "tenantId",
                "businessKey",
                "businessKey",
                "processDefinitionKey",
                null,
                null,
                false,
                null
            )
        );

        Pageable pageable = PageRequest.of(1, 1);

        when(operatonTaskService.findTasksFiltered(any(), any())).thenReturn(new PageImpl<>(tasks, pageable, 5L));

        mockMvc.perform(get("/api/v2/task?filter=all")
                .content(objectMapper.writeValueAsString(assigneeRequest))
                .characterEncoding(StandardCharsets.UTF_8.name())
                .accept(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray())
            .andExpect(jsonPath("$.content[0].id").value(tasks.get(0).getId()))
            .andExpect(jsonPath("$.content[0].name").value(tasks.get(0).getName()))
            .andExpect(jsonPath("$.content[0].assignee").value(tasks.get(0).getAssignee()))
            .andExpect(jsonPath("$.content[0].created").isNotEmpty())
            .andExpect(jsonPath("$.content[0].due").isNotEmpty())
            .andExpect(jsonPath("$.content[0].followUp").isNotEmpty())
            .andExpect(jsonPath("$.content[0].delegationState").value(tasks.get(0).getDelegationState()))
            .andExpect(jsonPath("$.content[0].description").value(tasks.get(0).getDescription()))
            .andExpect(jsonPath("$.content[0].executionId").value(tasks.get(0).getExecutionId()))
            .andExpect(jsonPath("$.content[0].owner").value(tasks.get(0).getOwner()))
            .andExpect(jsonPath("$.content[0].parentTaskId").value(tasks.get(0).getParentTaskId()))
            .andExpect(jsonPath("$.content[0].priority").value(tasks.get(0).getPriority()))
            .andExpect(jsonPath("$.content[0].processDefinitionId").value(tasks.get(0).getProcessDefinitionId()))
            .andExpect(jsonPath("$.content[0].processInstanceId").value(tasks.get(0).getProcessInstanceId()))
            .andExpect(jsonPath("$.content[0].taskDefinitionKey").value(tasks.get(0).getTaskDefinitionKey()))
            .andExpect(jsonPath("$.content[0].caseExecutionId").value(tasks.get(0).getCaseExecutionId()))
            .andExpect(jsonPath("$.content[0].caseInstanceId").value(tasks.get(0).getCaseInstanceId()))
            .andExpect(jsonPath("$.content[0].caseDefinitionId").value(tasks.get(0).getCaseDefinitionId()))
            .andExpect(jsonPath("$.content[0].suspended").value(tasks.get(0).getSuspended()))
            .andExpect(jsonPath("$.content[0].tenantId").value(tasks.get(0).getTenantId()))
            .andExpect(jsonPath("$.content[0].businessKey").value(tasks.get(0).getBusinessKey()))
            .andExpect(jsonPath("$.content[0].processDefinitionKey").value(tasks.get(0).getProcessDefinitionKey()))
            .andExpect(jsonPath("$.totalElements").value(5))
            .andExpect(jsonPath("$.totalPages").value(5));
    }

    @Test
    void getTasksPaged_withAssignedTeam() throws Exception {
        TeamDto team = new TeamDto("team-a", "Team Alpha");

        List<TaskExtended> tasks = List.of(
            new TaskExtended(
                "1", "name", "assignee",
                LocalDateTime.now(), LocalDateTime.now(), LocalDateTime.now(), LocalDateTime.now(),
                "delegationState", "description", "executionId", "owner", "parentTaskId",
                1, "processDefinitionId", "processInstanceId", "taskDefinitionKey",
                "caseExecutionId", "caseInstanceId", "caseDefinitionId",
                true, "tenantId", "businessKey", "businessKey", "processDefinitionKey",
                null, null, false, team
            )
        );

        Pageable pageable = PageRequest.of(0, 10);
        when(operatonTaskService.findTasksFiltered(any(), any())).thenReturn(new PageImpl<>(tasks, pageable, 1L));

        mockMvc.perform(get("/api/v2/task?filter=all")
                .characterEncoding(StandardCharsets.UTF_8.name())
                .accept(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].assignedTeam.key").value("team-a"))
            .andExpect(jsonPath("$.content[0].assignedTeam.title").value("Team Alpha"));
    }

    @Test
    void getTasksPaged_withoutAssignedTeam() throws Exception {
        List<TaskExtended> tasks = List.of(
            new TaskExtended(
                "1", "name", "assignee",
                LocalDateTime.now(), LocalDateTime.now(), LocalDateTime.now(), LocalDateTime.now(),
                "delegationState", "description", "executionId", "owner", "parentTaskId",
                1, "processDefinitionId", "processInstanceId", "taskDefinitionKey",
                "caseExecutionId", "caseInstanceId", "caseDefinitionId",
                true, "tenantId", "businessKey", "businessKey", "processDefinitionKey",
                null, null, false, null
            )
        );

        Pageable pageable = PageRequest.of(0, 10);
        when(operatonTaskService.findTasksFiltered(any(), any())).thenReturn(new PageImpl<>(tasks, pageable, 1L));

        mockMvc.perform(get("/api/v2/task?filter=all")
                .characterEncoding(StandardCharsets.UTF_8.name())
                .accept(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].assignedTeam").doesNotExist());
    }

    @Test
    void assignTeam() throws Exception {
        var request = new AssigneeRequest(null, "team-a");

        mockMvc.perform(post("/api/v1/task/{taskId}/assign", taskId)
                .content(objectMapper.writeValueAsString(request))
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
            )
            .andDo(print())
            .andExpect(status().isOk());

        verify(operatonTaskService, never()).assign(any(), any());
        verify(operatonTaskService, times(1)).assignTeamToTask(taskId, "team-a");
    }

    @Test
    void assignUserAndTeam() throws Exception {
        var request = new AssigneeRequest(assigneeId, "team-a");

        mockMvc.perform(post("/api/v1/task/{taskId}/assign", taskId)
                .content(objectMapper.writeValueAsString(request))
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
            )
            .andDo(print())
            .andExpect(status().isOk());

        verify(operatonTaskService, times(1)).assign(taskId, assigneeId);
        verify(operatonTaskService, times(1)).assignTeamToTask(taskId, "team-a");
    }

    @Test
    void assign_emptyAssignee_unassignsUser() throws Exception {
        var request = new AssigneeRequest("", null);

        mockMvc.perform(post("/api/v1/task/{taskId}/assign", taskId)
                .content(objectMapper.writeValueAsString(request))
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
            )
            .andDo(print())
            .andExpect(status().isOk());

        verify(operatonTaskService, times(1)).unassign(taskId);
        verify(operatonTaskService, never()).assign(any(), any());
        verify(operatonTaskService, never()).assignTeamToTask(any(), any());
        verify(operatonTaskService, never()).unassignTeamFromTask(any());
    }

    @Test
    void assign_emptyTeamKey_unassignsTeam() throws Exception {
        var request = new AssigneeRequest(null, "");

        mockMvc.perform(post("/api/v1/task/{taskId}/assign", taskId)
                .content(objectMapper.writeValueAsString(request))
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
            )
            .andDo(print())
            .andExpect(status().isOk());

        verify(operatonTaskService, never()).assign(any(), any());
        verify(operatonTaskService, never()).unassign(any());
        verify(operatonTaskService, times(1)).unassignTeamFromTask(taskId);
        verify(operatonTaskService, never()).assignTeamToTask(any(), any());
    }

    @Test
    void assign_emptyAssigneeAndTeamKey_unassignsBoth() throws Exception {
        var request = new AssigneeRequest("", "");

        mockMvc.perform(post("/api/v1/task/{taskId}/assign", taskId)
                .content(objectMapper.writeValueAsString(request))
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
            )
            .andDo(print())
            .andExpect(status().isOk());

        verify(operatonTaskService, times(1)).unassign(taskId);
        verify(operatonTaskService, never()).assign(any(), any());
        verify(operatonTaskService, times(1)).unassignTeamFromTask(taskId);
        verify(operatonTaskService, never()).assignTeamToTask(any(), any());
    }

    @Test
    void assign_emptyAssigneeWithTeam_unassignsUserAndAssignsTeam() throws Exception {
        var request = new AssigneeRequest("", "team-a");

        mockMvc.perform(post("/api/v1/task/{taskId}/assign", taskId)
                .content(objectMapper.writeValueAsString(request))
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
            )
            .andDo(print())
            .andExpect(status().isOk());

        verify(operatonTaskService, times(1)).unassign(taskId);
        verify(operatonTaskService, never()).assign(any(), any());
        verify(operatonTaskService, times(1)).assignTeamToTask(taskId, "team-a");
        verify(operatonTaskService, never()).unassignTeamFromTask(any());
    }

    @Test
    void assign_assigneeWithEmptyTeam_assignsUserAndUnassignsTeam() throws Exception {
        var request = new AssigneeRequest(assigneeId, "");

        mockMvc.perform(post("/api/v1/task/{taskId}/assign", taskId)
                .content(objectMapper.writeValueAsString(request))
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
            )
            .andDo(print())
            .andExpect(status().isOk());

        verify(operatonTaskService, times(1)).assign(taskId, assigneeId);
        verify(operatonTaskService, never()).unassign(any());
        verify(operatonTaskService, times(1)).unassignTeamFromTask(taskId);
        verify(operatonTaskService, never()).assignTeamToTask(any(), any());
    }

    @Test
    void unassign_alsoClearsTeam() throws Exception {
        mockMvc.perform(post("/api/v1/task/{taskId}/unassign", taskId)
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
            )
            .andDo(print())
            .andExpect(status().isOk());

        verify(operatonTaskService, times(1)).unassign(taskId);
        verify(operatonTaskService, times(1)).unassignTeamFromTask(taskId);
    }

    @Test
    void getCandidateTeams() throws Exception {
        Team team = new Team() {
            @Override public String getKey() { return "team-a"; }
            @Override public String getTitle() { return "Team Alpha"; }
        };
        when(operatonTaskService.getCandidateTeams(eq(taskId), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(team)));

        mockMvc.perform(get("/api/v1/task/{taskId}/candidate-team", taskId)
                .characterEncoding(StandardCharsets.UTF_8.name())
                .accept(MediaType.APPLICATION_JSON_VALUE)
            )
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray())
            .andExpect(jsonPath("$.content[0].key").value("team-a"))
            .andExpect(jsonPath("$.content[0].title").value("Team Alpha"))
            .andExpect(jsonPath("$.totalElements").value(1));
    }

}