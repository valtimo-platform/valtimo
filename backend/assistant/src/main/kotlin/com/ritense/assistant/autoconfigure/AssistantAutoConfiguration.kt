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

package com.ritense.assistant.autoconfigure

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.assistant.executor.CaseDefinitionActionExecutor
import com.ritense.assistant.executor.ProcessDefinitionActionExecutor
import com.ritense.assistant.memory.JpaChatMemoryStore
import com.ritense.assistant.security.config.AssistantHttpSecurityConfigurer
import com.ritense.assistant.repository.AssistantMessageRepository
import com.ritense.assistant.repository.AssistantSessionRepository
import com.ritense.assistant.repository.PendingAssistantActionRepository
import com.ritense.assistant.service.ActionExecutor
import com.ritense.assistant.service.AssistantContextBuilder
import com.ritense.assistant.service.AssistantService
import com.ritense.assistant.service.AssistantSessionService
import com.ritense.assistant.service.PendingActionService
import com.ritense.assistant.tool.CaseDefinitionTools
import com.ritense.assistant.tool.CaseInformationTools
import com.ritense.assistant.tool.ProcessDefinitionTools
import com.ritense.assistant.web.rest.AssistantResource
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case.service.CaseTabService
import com.ritense.case_.service.CaseHeaderWidgetService
import com.ritense.case_.service.CaseWidgetService
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.document.service.DocumentService
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import dev.langchain4j.memory.chat.ChatMemoryProvider
import dev.langchain4j.memory.chat.MessageWindowChatMemory
import dev.langchain4j.model.chat.ChatModel
import dev.langchain4j.store.memory.chat.ChatMemoryStore
import org.operaton.bpm.engine.RepositoryService
import org.springframework.beans.factory.annotation.Value
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.AutoConfigureAfter
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Bean
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.core.annotation.Order
import org.springframework.scheduling.annotation.EnableScheduling

@AutoConfiguration
@AutoConfigureAfter(name = [
    "com.ritense.case.configuration.CaseAutoConfiguration",
    "com.ritense.case_.configuration.CaseWidgetAutoConfiguration",
    "com.ritense.document.autoconfigure.DocumentAutoConfiguration",
    "com.ritense.valtimo.autoconfiguration.ValtimoOperatonAutoConfiguration",
    "com.ritense.processlink.autoconfigure.ProcessLinkAutoConfiguration"
])
@EnableJpaRepositories(basePackages = ["com.ritense.assistant.repository"])
@EntityScan(basePackages = ["com.ritense.assistant.domain"])
@ConditionalOnProperty(name = ["valtimo.assistant.enabled"], havingValue = "true", matchIfMissing = false)
@EnableScheduling
class AssistantAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(ChatMemoryStore::class)
    fun jpaChatMemoryStore(
        messageRepository: AssistantMessageRepository,
        objectMapper: ObjectMapper
    ): ChatMemoryStore {
        return JpaChatMemoryStore(messageRepository, objectMapper)
    }

    @Bean
    @ConditionalOnMissingBean(ChatMemoryProvider::class)
    fun chatMemoryProvider(
        chatMemoryStore: ChatMemoryStore,
        @Value("\${valtimo.assistant.max-messages-per-session:50}") maxMessages: Int
    ): ChatMemoryProvider {
        return ChatMemoryProvider { memoryId ->
            MessageWindowChatMemory.builder()
                .id(memoryId)
                .maxMessages(maxMessages)
                .chatMemoryStore(chatMemoryStore)
                .build()
        }
    }

    @Bean
    @ConditionalOnMissingBean(AssistantContextBuilder::class)
    fun assistantContextBuilder(): AssistantContextBuilder {
        return AssistantContextBuilder()
    }

    @Bean
    @ConditionalOnMissingBean(AssistantSessionService::class)
    fun assistantSessionService(
        sessionRepository: AssistantSessionRepository,
        messageRepository: AssistantMessageRepository,
        pendingActionRepository: PendingAssistantActionRepository
    ): AssistantSessionService {
        return AssistantSessionService(sessionRepository, messageRepository, pendingActionRepository)
    }

    @Bean
    @ConditionalOnMissingBean(CaseDefinitionTools::class)
    @ConditionalOnBean(CaseDefinitionService::class, DocumentDefinitionService::class)
    fun caseDefinitionTools(
        caseDefinitionService: CaseDefinitionService,
        documentDefinitionService: DocumentDefinitionService,
        pendingActionService: PendingActionService,
        objectMapper: ObjectMapper
    ): CaseDefinitionTools {
        return CaseDefinitionTools(
            caseDefinitionService,
            documentDefinitionService,
            pendingActionService,
            objectMapper
        )
    }

    @Bean
    @ConditionalOnMissingBean(CaseInformationTools::class)
    @ConditionalOnBean(DocumentService::class, CaseWidgetService::class, CaseTabService::class, CaseHeaderWidgetService::class)
    fun caseInformationTools(
        documentService: DocumentService,
        caseTabService: CaseTabService,
        caseWidgetService: CaseWidgetService,
        caseHeaderWidgetService: CaseHeaderWidgetService,
        objectMapper: ObjectMapper
    ): CaseInformationTools {
        return CaseInformationTools(
            documentService,
            caseTabService,
            caseWidgetService,
            caseHeaderWidgetService,
            objectMapper
        )
    }

    @Bean
    @ConditionalOnMissingBean(ProcessDefinitionTools::class)
    @ConditionalOnBean(OperatonRepositoryService::class, RepositoryService::class)
    fun processDefinitionTools(
        operatonRepositoryService: OperatonRepositoryService,
        repositoryService: RepositoryService,
        pendingActionService: PendingActionService,
        objectMapper: ObjectMapper
    ): ProcessDefinitionTools {
        return ProcessDefinitionTools(
            operatonRepositoryService,
            repositoryService,
            pendingActionService,
            objectMapper
        )
    }

    @Bean
    @ConditionalOnMissingBean(AssistantService::class)
    fun assistantService(
        chatModel: ChatModel?,
        chatMemoryProvider: ChatMemoryProvider,
        contextBuilder: AssistantContextBuilder,
        sessionService: AssistantSessionService,
        pendingActionService: PendingActionService,
        objectMapper: ObjectMapper,
        caseDefinitionTools: ObjectProvider<CaseDefinitionTools>,
        caseInformationTools: ObjectProvider<CaseInformationTools>,
        processDefinitionTools: ObjectProvider<ProcessDefinitionTools>
    ): AssistantService {
        val assistantTools = listOfNotNull(
            caseDefinitionTools.ifAvailable,
            caseInformationTools.ifAvailable,
            processDefinitionTools.ifAvailable
        )
        return AssistantService(
            chatModel,
            chatMemoryProvider,
            contextBuilder,
            sessionService,
            pendingActionService,
            objectMapper,
            assistantTools
        )
    }

    @Bean
    @ConditionalOnMissingBean(name = ["assistantActionExecutors"])
    fun assistantActionExecutors(
        caseDefinitionActionExecutor: CaseDefinitionActionExecutor?,
        processDefinitionActionExecutor: ProcessDefinitionActionExecutor?
    ): Map<String, ActionExecutor> {
        val executors = mutableMapOf<String, ActionExecutor>()
        caseDefinitionActionExecutor?.let {
            executors["apply_case_definition_change"] = it
        }
        processDefinitionActionExecutor?.let {
            executors["apply_process_definition_change"] = it
        }
        return executors
    }

    @Bean
    @ConditionalOnMissingBean(CaseDefinitionActionExecutor::class)
    @ConditionalOnBean(CaseDefinitionService::class)
    fun caseDefinitionActionExecutor(
        caseDefinitionService: CaseDefinitionService,
        objectMapper: ObjectMapper
    ): CaseDefinitionActionExecutor {
        return CaseDefinitionActionExecutor(caseDefinitionService, objectMapper)
    }

    @Bean
    @ConditionalOnMissingBean(ProcessDefinitionActionExecutor::class)
    @ConditionalOnBean(ProcessDeploymentService::class)
    fun processDefinitionActionExecutor(
        processDeploymentService: ProcessDeploymentService,
        objectMapper: ObjectMapper
    ): ProcessDefinitionActionExecutor {
        return ProcessDefinitionActionExecutor(processDeploymentService, objectMapper)
    }

    @Bean
    @ConditionalOnMissingBean(PendingActionService::class)
    fun pendingActionService(
        pendingActionRepository: PendingAssistantActionRepository,
        assistantActionExecutors: Map<String, ActionExecutor>
    ): PendingActionService {
        return PendingActionService(pendingActionRepository, assistantActionExecutors)
    }

    @Bean
    @ConditionalOnMissingBean(AssistantResource::class)
    fun assistantResource(
        assistantService: AssistantService,
        sessionService: AssistantSessionService,
        pendingActionService: PendingActionService,
        userManagementService: UserManagementService
    ): AssistantResource {
        return AssistantResource(
            assistantService,
            sessionService,
            pendingActionService,
            userManagementService
        )
    }

    @Order(300)
    @Bean
    @ConditionalOnMissingBean(AssistantHttpSecurityConfigurer::class)
    fun assistantHttpSecurityConfigurer(): AssistantHttpSecurityConfigurer {
        return AssistantHttpSecurityConfigurer()
    }
}
