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

package com.ritense.buildingblock

import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.service.BuildingBlockDefinitionProcessDefinitionService
import com.ritense.buildingblock.service.BuildingBlockDocumentDefinitionService
import com.ritense.buildingblock.service.BuildingBlockManagementService
import com.ritense.buildingblock.service.BuildingBlockPluginDefinitionService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.contract.mail.MailSender
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.mockingDetails
import org.mockito.kotlin.reset
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationEventPublisher
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean
import org.springframework.test.context.junit.jupiter.SpringExtension

@AutoConfigureMockMvc(addFilters = false)
@SpringBootTest
@ExtendWith(SpringExtension::class)
@Tag("integration")
abstract class BaseIntegrationTest {
    @MockitoBean
    lateinit var userManagementService: UserManagementService

    @MockitoBean
    lateinit var mailSender: MailSender

    @MockitoSpyBean
    lateinit var processLinkService: ProcessLinkService

    @MockitoSpyBean
    lateinit var buildingBlockManagementService: BuildingBlockManagementService

    @MockitoSpyBean
    lateinit var buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository

    @MockitoSpyBean
    lateinit var buildingBlockDocumentDefinitionService: BuildingBlockDocumentDefinitionService

    @MockitoSpyBean
    lateinit var buildingBlockProcessService: BuildingBlockDefinitionProcessDefinitionService

    @MockitoSpyBean
    lateinit var buildingBlockPluginDefinitionService: BuildingBlockPluginDefinitionService

    @MockitoSpyBean
    lateinit var operatonRepositoryService: OperatonRepositoryService

    @Autowired
    lateinit var applicationEventPublisher: ApplicationEventPublisher

    @AfterEach
    fun resetMocks() {
        listOf(
            userManagementService,
            mailSender,
            processLinkService,
            buildingBlockManagementService,
            buildingBlockDefinitionRepository,
            buildingBlockDocumentDefinitionService,
            buildingBlockProcessService,
            buildingBlockPluginDefinitionService,
            operatonRepositoryService,
            applicationEventPublisher
        ).filter { mockingDetails(it).isMock || mockingDetails(it).isSpy }
            .forEach { reset(it) }
    }
}
