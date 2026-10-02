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

package com.ritense.processlink.configuration

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationService
import com.ritense.document.service.DocumentService
import com.ritense.exporter.ExportService
import com.ritense.importer.ImportService
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.domain.SupportedProcessLinkTypeHandler
import com.ritense.processlink.exporter.BuildingBlockProcessLinkToBuildingBlockMapper
import com.ritense.processlink.exporter.GlobalProcessLinkExporter
import com.ritense.processlink.exporter.ProcessLinkExporter
import com.ritense.processlink.service.ProcessDefinitionImportPreviewService
import com.ritense.processlink.importer.GlobalProcessLinkImporter
import com.ritense.processlink.importer.ProcessLinkImporter
import com.ritense.processlink.listener.ProcessDefinitionDeletedEventListener
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.processlink.security.config.CaseProcessDefinitionManagementHttpSecurityConfigurer
import com.ritense.processlink.security.config.ProcessDefinitionManagementHttpSecurityConfigurer
import com.ritense.processlink.security.config.ProcessLinkHttpSecurityConfigurer
import com.ritense.processlink.security.config.ProcessLinkTaskHttpSecurityConfigurer
import com.ritense.processlink.service.CopyProcessLinkOnProcessDeploymentListener
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkActivityHandler
import com.ritense.processlink.service.ProcessLinkActivityService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.validation.ProcessDefinitionValidator
import com.ritense.processlink.web.rest.CaseProcessDefinitionManagementResource
import com.ritense.processlink.web.rest.ProcessDefinitionManagementResource
import com.ritense.processlink.web.rest.ProcessDefinitionResponseAssembler
import com.ritense.processlink.web.rest.ProcessLinkResource
import com.ritense.processlink.web.rest.ProcessLinkTaskResource
import com.ritense.processlink.web.rest.error.ProcessDefinitionValidationExceptionMapper
import com.ritense.valtimo.autoconfiguration.ValtimoOperatonAutoConfiguration
import com.ritense.valtimo.contract.annotation.ProcessBean
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.processbean.ProcessBeanService
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.importer.ImportPreviewContributor
import com.ritense.valtimo.event.ProcessDefinitionDeployedEvent
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.processautofill.service.ProcessDefinitionAutofillService
import com.ritense.valtimo.service.OperatonProcessService
import com.ritense.valtimo.service.OperatonTaskService
import com.ritense.valtimo.service.ProcessPropertyService
import com.ritense.valtimo.task.service.UserTaskOpenedStatusService
import org.operaton.bpm.engine.RepositoryService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.AutoConfigureAfter
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.ApplicationContext
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EnableJpaRepositories(
    basePackageClasses = [
        ProcessLinkRepository::class,
    ]
)
@EntityScan(basePackages = ["com.ritense.processlink.domain"])
@AutoConfigureAfter(ValtimoOperatonAutoConfiguration::class)
class ProcessLinkAutoConfiguration {

    @Order(420)
    @Bean
    @ConditionalOnMissingBean(ProcessLinkHttpSecurityConfigurer::class)
    fun processLinkHttpSecurityConfigurer(): ProcessLinkHttpSecurityConfigurer {
        return ProcessLinkHttpSecurityConfigurer()
    }

    @Order(421)
    @Bean
    @ConditionalOnMissingBean(ProcessLinkTaskHttpSecurityConfigurer::class)
    fun processLinkTaskHttpSecurityConfigurer(): ProcessLinkTaskHttpSecurityConfigurer {
        return ProcessLinkTaskHttpSecurityConfigurer()
    }

    @Order(422)
    @Bean
    @ConditionalOnMissingBean(CaseProcessDefinitionManagementHttpSecurityConfigurer::class)
    fun caseProcessDefinitionManagementHttpSecurityConfigurer(): CaseProcessDefinitionManagementHttpSecurityConfigurer {
        return CaseProcessDefinitionManagementHttpSecurityConfigurer()
    }

    @Order(423)
    @Bean
    @ConditionalOnMissingBean(ProcessDefinitionManagementHttpSecurityConfigurer::class)
    fun processDefinitionManagementHttpSecurityConfigurer(): ProcessDefinitionManagementHttpSecurityConfigurer {
        return ProcessDefinitionManagementHttpSecurityConfigurer()
    }

    @Bean
    @ConditionalOnMissingBean(ProcessLinkService::class)
    fun processLinkService(
        processLinkRepository: ProcessLinkRepository,
        processLinkMappers: List<ProcessLinkMapper>,
        processLinkTypes: List<SupportedProcessLinkTypeHandler>,
        operatonRepositoryService: OperatonRepositoryService,
        caseDefinitionChecker: CaseDefinitionChecker,
        buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker,
        applicationEventPublisher: ApplicationEventPublisher,
    ): ProcessLinkService {
        return ProcessLinkService(
            processLinkRepository,
            processLinkMappers,
            processLinkTypes,
            operatonRepositoryService,
            caseDefinitionChecker,
            buildingBlockDefinitionChecker,
            applicationEventPublisher
        )
    }

    @Bean
    @ConditionalOnMissingBean(ProcessLinkActivityService::class)
    fun processLinkTaskService(
        processLinkService: ProcessLinkService,
        taskService: OperatonTaskService,
        processLinkActivityHandlers: List<ProcessLinkActivityHandler<*>>,
        authorizationService: AuthorizationService,
        operatonRepositoryService: OperatonRepositoryService,
        documentService: DocumentService,
        operatonTaskService: OperatonTaskService,
        operatonProcessService: OperatonProcessService
    ): ProcessLinkActivityService {
        return ProcessLinkActivityService(
            processLinkService,
            taskService,
            processLinkActivityHandlers,
            authorizationService,
            operatonRepositoryService,
            documentService,
            operatonTaskService,
            operatonProcessService
        )
    }

    @Bean
    @ConditionalOnMissingBean(ProcessLinkTaskResource::class)
    @ConditionalOnBean(ProcessLinkActivityService::class)
    fun processLinkTaskResource(
        processLinkActivityService: ProcessLinkActivityService,
        userTaskOpenedStatusService: UserTaskOpenedStatusService
    ): ProcessLinkTaskResource {
        return ProcessLinkTaskResource(processLinkActivityService, userTaskOpenedStatusService)
    }

    @Bean
    @ConditionalOnMissingBean(ProcessDefinitionResponseAssembler::class)
    fun processDefinitionWithLinksAssembler(
        processLinkService: ProcessLinkService,
        repositoryService: RepositoryService,
        processDefinitionAutofillService: ProcessDefinitionAutofillService,
    ) = ProcessDefinitionResponseAssembler(
        processLinkService,
        repositoryService,
        processDefinitionAutofillService,
    )

    @Bean
    @ConditionalOnMissingBean(ProcessLinkResource::class)
    fun processLinkResource(
        processLinkService: ProcessLinkService,
    ) = ProcessLinkResource(processLinkService)

    @Bean
    @ConditionalOnMissingBean(CaseProcessDefinitionManagementResource::class)
    fun caseProcessDefinitionManagementResource(
        operatonProcessService: OperatonProcessService,
        processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
        processLinkService: ProcessLinkService,
        processDeploymentService: ProcessDeploymentService,
        assembler: ProcessDefinitionResponseAssembler,
    ) = CaseProcessDefinitionManagementResource(
        operatonProcessService,
        processDefinitionCaseDefinitionService,
        processLinkService,
        processDeploymentService,
        assembler,
    )

    @Bean
    @ConditionalOnMissingBean(ProcessDefinitionManagementResource::class)
    fun processDefinitionManagementResource(
        operatonProcessService: OperatonProcessService,
        processPropertyService: ProcessPropertyService,
        processLinkService: ProcessLinkService,
        processDeploymentService: ProcessDeploymentService,
        processDefinitionValidator: ProcessDefinitionValidator,
        processDefinitionAutofillService: ProcessDefinitionAutofillService,
        exportService: ExportService,
        importService: ImportService,
        processDefinitionImportPreviewService: ProcessDefinitionImportPreviewService,
        objectMapper: ObjectMapper,
        assembler: ProcessDefinitionResponseAssembler,
    ) = ProcessDefinitionManagementResource(
        operatonProcessService,
        processPropertyService,
        processLinkService,
        processDeploymentService,
        processDefinitionValidator,
        processDefinitionAutofillService,
        exportService,
        importService,
        processDefinitionImportPreviewService,
        objectMapper,
        assembler,
    )

    @Bean
    @ConditionalOnMissingBean(CopyProcessLinkOnProcessDeploymentListener::class)
    @ConditionalOnClass(ProcessDefinitionDeployedEvent::class)
    fun copyProcessLinkOnProcessDeploymentListener(
        processLinkRepository: ProcessLinkRepository,
        operatonRepositoryService: OperatonRepositoryService,
        applicationEventPublisher: ApplicationEventPublisher
    ): CopyProcessLinkOnProcessDeploymentListener {
        return CopyProcessLinkOnProcessDeploymentListener(
            processLinkRepository,
            operatonRepositoryService,
            applicationEventPublisher
        )
    }

    @Bean
    @ConditionalOnMissingBean(ProcessLinkExporter::class)
    fun processLinkExporter(
        objectMapper: ObjectMapper,
        processLinkService: ProcessLinkService,
        repositoryService: OperatonRepositoryService,
        buildingBlockMapper: BuildingBlockProcessLinkToBuildingBlockMapper,
    ) = ProcessLinkExporter(
        objectMapper,
        processLinkService,
        repositoryService,
        buildingBlockMapper,
    )

    @Bean
    @ConditionalOnMissingBean(ProcessDefinitionImportPreviewService::class)
    fun processDefinitionImportPreviewService(
        objectMapper: ObjectMapper,
        importPreviewContributors: List<ImportPreviewContributor>,
        processLinkService: ProcessLinkService,
        repositoryService: OperatonRepositoryService,
    ) = ProcessDefinitionImportPreviewService(
        objectMapper,
        importPreviewContributors,
        processLinkService,
        repositoryService,
    )

    @Bean
    @ConditionalOnMissingBean(GlobalProcessLinkExporter::class)
    fun globalProcessLinkExporter(
        objectMapper: ObjectMapper,
        processLinkService: ProcessLinkService,
        repositoryService: OperatonRepositoryService,
    ) = GlobalProcessLinkExporter(
        objectMapper,
        processLinkService,
        repositoryService,
    )

    @Bean
    @ConditionalOnMissingBean(ProcessLinkImporter::class)
    fun processLinkImporter(
        processLinkService: ProcessLinkService,
        repositoryService: OperatonRepositoryService,
        processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
        objectMapper: ObjectMapper,
        processLinkMappers: List<ProcessLinkMapper>,
        applicationEventPublisher: ApplicationEventPublisher,
    ) = ProcessLinkImporter(
        processLinkService,
        repositoryService,
        processDefinitionCaseDefinitionService,
        objectMapper,
        processLinkMappers,
        applicationEventPublisher,
    )

    @Bean
    @ConditionalOnMissingBean(GlobalProcessLinkImporter::class)
    fun globalProcessLinkImporter(
        processLinkService: ProcessLinkService,
        repositoryService: OperatonRepositoryService,
        processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
        objectMapper: ObjectMapper,
        processLinkMappers: List<ProcessLinkMapper>,
        applicationEventPublisher: ApplicationEventPublisher,
    ) = GlobalProcessLinkImporter(
        processLinkService,
        repositoryService,
        processDefinitionCaseDefinitionService,
        objectMapper,
        processLinkMappers,
        applicationEventPublisher,
    )

    @Bean
    @ConditionalOnMissingBean(ProcessDefinitionDeletedEventListener::class)
    fun processDefinitionDeletedEventListener(
        processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
        processLinkService: ProcessLinkService
    ) = ProcessDefinitionDeletedEventListener(processDefinitionCaseDefinitionService, processLinkService)

    @Bean
    @ConditionalOnMissingBean(ProcessDefinitionValidator::class)
    fun processDefinitionValidator(
        applicationContext: ApplicationContext,
        processBeanService: ProcessBeanService?
    ): ProcessDefinitionValidator {
        return ProcessDefinitionValidator(
            processBeansSupplier = { applicationContext.getBeansWithAnnotation(ProcessBean::class.java) },
            processBeanService = processBeanService
        )
    }

    @Bean
    @ConditionalOnMissingBean(ProcessDefinitionValidationExceptionMapper::class)
    fun processDefinitionValidationExceptionTranslator(): ProcessDefinitionValidationExceptionMapper {
        return ProcessDefinitionValidationExceptionMapper()
    }

    @Bean
    @ConditionalOnMissingBean(ProcessDeploymentService::class)
    fun processDeploymentService(
        operatonProcessService: OperatonProcessService,
        processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
        processLinkService: ProcessLinkService,
        processDefinitionValidator: ProcessDefinitionValidator,
        repositoryService: RepositoryService,
        applicationEventPublisher: ApplicationEventPublisher,
    ): ProcessDeploymentService {
        return ProcessDeploymentService(
            operatonProcessService,
            processDefinitionCaseDefinitionService,
            processLinkService,
            processDefinitionValidator,
            repositoryService,
            applicationEventPublisher
        )
    }
}
