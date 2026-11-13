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

package com.ritense.form.service

import com.ritense.authorization.AuthorizationContext
import com.ritense.form.BaseIntegrationTest
import com.ritense.form.domain.FormProcessLink
import com.ritense.form.domain.request.CreateFormDefinitionRequest
import com.ritense.form.repository.FormProcessLinkRepository
import com.ritense.form.web.rest.dto.FormProcessLinkCreateRequestDto
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import org.zalando.problem.Status
import org.zalando.problem.ThrowableProblem
import java.util.UUID
import javax.sql.DataSource
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

@Transactional
internal class FormDefinitionDeletionIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var formDefinitionService: FormDefinitionService

    @Autowired
    lateinit var processLinkRepository: ProcessLinkRepository

    @Autowired
    lateinit var processLinkService: ProcessLinkService

    @Autowired
    lateinit var formProcessLinkRepository: FormProcessLinkRepository

    @Autowired
    lateinit var operatonProcessService: OperatonProcessService

    @Autowired
    lateinit var dataSource: DataSource

    @Autowired
    lateinit var transactionManager: PlatformTransactionManager

    @Test
    fun `should not delete a form definition that a form process link uses`() {
        val caseDefinitionId = CaseDefinitionId.of("person", "1.0.0")
        val formId = formDefinitionService.createFormDefinition(
            caseDefinitionId,
            CreateFormDefinitionRequest("linked-form", "{}", false)
        ).id
        processLinkRepository.saveAndFlush(
            FormProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = "linked-process:1:${UUID.randomUUID()}",
                activityId = "start-event",
                activityType = ActivityTypeWithEventName.START_EVENT_START,
                formDefinitionId = formId,
            )
        )

        val exception = assertThrows<ThrowableProblem> {
            formDefinitionService.deleteFormDefinition(caseDefinitionId, formId)
        }

        assertThat(exception.status).isEqualTo(Status.CONFLICT)
        assertThat(formDefinitionRepository.existsById(formId)).isTrue()
    }

    @Test
    fun `should not delete a global form definition that a form process link uses`() {
        val formId = formDefinitionService.createFormDefinition(
            CreateFormDefinitionRequest("global-linked-form-${UUID.randomUUID()}", "{}", false)
        ).id
        saveLink(formId)

        val exception = assertThrows<ThrowableProblem> { formDefinitionService.deleteFormDefinition(formId) }

        assertThat(exception.status).isEqualTo(Status.CONFLICT)
        assertThat(exception.parameters["usages"] as List<*>).hasSize(1)
        assertThat(formDefinitionRepository.existsById(formId)).isTrue()
    }

    @Test
    fun `should not delete the forms of a case when a link from another process uses one`() {
        val caseDefinitionId = CaseDefinitionId.of("person", "1.0.0")
        val formId = formDefinitionService.createFormDefinition(
            caseDefinitionId,
            CreateFormDefinitionRequest("case-linked-form", "{}", false)
        ).id
        saveLink(formId)

        val exception = assertThrows<ThrowableProblem> {
            formDefinitionService.deleteAllFormDefinitions(caseDefinitionId)
        }

        assertThat(exception.status).isEqualTo(Status.CONFLICT)
        assertThat(formDefinitionRepository.existsById(formId)).isTrue()
    }

    @Test
    fun `should delete the forms of a case when nothing links to them`() {
        val caseDefinitionId = CaseDefinitionId.of("person", "1.0.0")
        val formId = formDefinitionService.createFormDefinition(
            caseDefinitionId,
            CreateFormDefinitionRequest("case-unlinked-form", "{}", false)
        ).id

        formDefinitionService.deleteAllFormDefinitions(caseDefinitionId)

        assertThat(formDefinitionRepository.existsById(formId)).isFalse()
    }

    @Test
    fun `should delete the forms of a case when only the processes of the case itself link to them`() {
        val caseDefinitionId = CaseDefinitionId.of("person", "1.0.0")
        val personFormIds = formDefinitionRepository.findAllByCaseDefinitionId(caseDefinitionId).map { it.id }
        val ownProcessDefinitionIds = AuthorizationContext.runWithoutAuthorization {
            operatonProcessService.getAllDefinitions(caseDefinitionId).map { it.id }.toSet()
        }
        val links = formProcessLinkRepository.findByFormDefinitionIdIn(personFormIds)
        assertThat(links).isNotEmpty()
        assertThat(links.map { it.processDefinitionId }).allMatch { it in ownProcessDefinitionIds }

        AuthorizationContext.runWithoutAuthorization { formDefinitionService.deleteAllFormDefinitions(caseDefinitionId) }

        assertThat(formDefinitionRepository.findAllByCaseDefinitionId(caseDefinitionId)).isEmpty()
    }

    private fun saveLink(formId: UUID) {
        processLinkRepository.saveAndFlush(
            FormProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = "linked-process:1:${UUID.randomUUID()}",
                activityId = "start-event",
                activityType = ActivityTypeWithEventName.START_EVENT_START,
                formDefinitionId = formId,
            )
        )
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    fun `delete waits for a concurrent link creation and then refuses`() {
        val caseDefinitionId = CaseDefinitionId.of("person", "1.0.0")
        val formId = formDefinitionService.createFormDefinition(
            caseDefinitionId,
            CreateFormDefinitionRequest("race-link-first-${UUID.randomUUID()}", "{}", false)
        ).id
        val processDefinitionId = "race-process:1:${UUID.randomUUID()}"
        val locked = CountDownLatch(1)
        val release = CountDownLatch(1)
        val executor = Executors.newFixedThreadPool(2)
        try {
            val linkFuture = executor.submit {
                TransactionTemplate(transactionManager).executeWithoutResult {
                    processLinkService.createProcessLink(
                        FormProcessLinkCreateRequestDto(
                            processDefinitionId = processDefinitionId,
                            activityId = "start-event",
                            activityType = ActivityTypeWithEventName.START_EVENT_START,
                            formDefinitionId = formId,
                        ),
                        caseDefinitionId
                    )
                    locked.countDown()
                    release.await(10, TimeUnit.SECONDS)
                }
            }
            assertThat(locked.await(10, TimeUnit.SECONDS)).isTrue()

            val deleteFuture: Future<*> = executor.submit {
                formDefinitionService.deleteFormDefinition(caseDefinitionId, formId)
            }
            assertThrows<TimeoutException> { deleteFuture.get(500, TimeUnit.MILLISECONDS) }

            release.countDown()
            linkFuture.get(10, TimeUnit.SECONDS)
            val exception = assertThrows<ExecutionException> { deleteFuture.get(10, TimeUnit.SECONDS) }

            assertThat(exception.cause).isInstanceOf(ThrowableProblem::class.java)
            assertThat((exception.cause as ThrowableProblem).status).isEqualTo(Status.CONFLICT)
            assertThat(formDefinitionRepository.existsById(formId)).isTrue()
        } finally {
            release.countDown()
            executor.shutdownNow()
            TransactionTemplate(transactionManager).executeWithoutResult {
                processLinkRepository.deleteAllByProcessDefinitionId(processDefinitionId)
                formDefinitionRepository.deleteById(formId)
            }
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    fun `link creation waits for a concurrent delete and then fails`() {
        val caseDefinitionId = CaseDefinitionId.of("person", "1.0.0")
        val formId = formDefinitionService.createFormDefinition(
            caseDefinitionId,
            CreateFormDefinitionRequest("race-delete-first-${UUID.randomUUID()}", "{}", false)
        ).id
        val processDefinitionId = "race-process:1:${UUID.randomUUID()}"
        val deleted = CountDownLatch(1)
        val release = CountDownLatch(1)
        val executor = Executors.newFixedThreadPool(2)
        try {
            val deleteFuture = executor.submit {
                TransactionTemplate(transactionManager).executeWithoutResult {
                    formDefinitionService.deleteFormDefinition(caseDefinitionId, formId)
                    deleted.countDown()
                    release.await(10, TimeUnit.SECONDS)
                }
            }
            assertThat(deleted.await(10, TimeUnit.SECONDS)).isTrue()

            val linkFuture: Future<*> = executor.submit {
                processLinkService.createProcessLink(
                    FormProcessLinkCreateRequestDto(
                        processDefinitionId = processDefinitionId,
                        activityId = "start-event",
                        activityType = ActivityTypeWithEventName.START_EVENT_START,
                        formDefinitionId = formId,
                    ),
                    caseDefinitionId
                )
            }
            assertThrows<TimeoutException> { linkFuture.get(500, TimeUnit.MILLISECONDS) }

            release.countDown()
            deleteFuture.get(10, TimeUnit.SECONDS)
            val exception = assertThrows<ExecutionException> { linkFuture.get(10, TimeUnit.SECONDS) }

            assertThat(exception.cause?.message).contains("Form definition not found")
            assertThat(processLinkRepository.findByProcessDefinitionId(processDefinitionId)).isEmpty()
        } finally {
            release.countDown()
            executor.shutdownNow()
            formDefinitionRepository.findById(formId).ifPresent { formDefinitionRepository.delete(it) }
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    fun `delete under repeatable read waits for a concurrent link creation and then refuses`() {
        assumeTrue(isMySql())
        val caseDefinitionId = CaseDefinitionId.of("person", "1.0.0")
        val formId = formDefinitionService.createFormDefinition(
            caseDefinitionId,
            CreateFormDefinitionRequest("race-rr-${UUID.randomUUID()}", "{}", false)
        ).id
        val processDefinitionId = "race-process:1:${UUID.randomUUID()}"
        val locked = CountDownLatch(1)
        val release = CountDownLatch(1)
        val executor = Executors.newFixedThreadPool(2)
        try {
            val linkFuture = executor.submit {
                TransactionTemplate(transactionManager).executeWithoutResult {
                    processLinkService.createProcessLink(
                        FormProcessLinkCreateRequestDto(
                            processDefinitionId = processDefinitionId,
                            activityId = "start-event",
                            activityType = ActivityTypeWithEventName.START_EVENT_START,
                            formDefinitionId = formId,
                        ),
                        caseDefinitionId
                    )
                    locked.countDown()
                    release.await(10, TimeUnit.SECONDS)
                }
            }
            assertThat(locked.await(10, TimeUnit.SECONDS)).isTrue()

            val deleteFuture: Future<*> = executor.submit {
                val template = TransactionTemplate(transactionManager)
                template.isolationLevel = TransactionDefinition.ISOLATION_REPEATABLE_READ
                template.executeWithoutResult {
                    formDefinitionRepository.count()
                    formDefinitionService.deleteFormDefinition(caseDefinitionId, formId)
                }
            }
            assertThrows<TimeoutException> { deleteFuture.get(500, TimeUnit.MILLISECONDS) }

            release.countDown()
            linkFuture.get(10, TimeUnit.SECONDS)
            val exception = assertThrows<ExecutionException> { deleteFuture.get(10, TimeUnit.SECONDS) }

            assertThat(exception.cause).isInstanceOf(ThrowableProblem::class.java)
            assertThat((exception.cause as ThrowableProblem).status).isEqualTo(Status.CONFLICT)
            assertThat(formDefinitionRepository.existsById(formId)).isTrue()
        } finally {
            release.countDown()
            executor.shutdownNow()
            TransactionTemplate(transactionManager).executeWithoutResult {
                processLinkRepository.deleteAllByProcessDefinitionId(processDefinitionId)
                formDefinitionRepository.deleteById(formId)
            }
        }
    }

    private fun isMySql(): Boolean =
        dataSource.connection.use { it.metaData.databaseProductName } == "MySQL"
}
