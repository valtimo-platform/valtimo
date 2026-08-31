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

package com.ritense.valtimo.operaton

import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.ProcessDefinition

/**
 * The process definition [processDefinitionId] names, or null when Operaton has none.
 *
 * [RepositoryService.getProcessDefinition] answers the same question from the deployment cache and would
 * be cheaper — but it **throws** when nothing is deployed under the id, and that is not a throw a caller
 * can absorb. Every Operaton command runs inside `SpringTransactionInterceptor`, whose
 * `TransactionTemplate` *joins* the caller's transaction, so an exception leaving the command marks that
 * transaction rollback-only before the caller ever gets to see it. Catching it then buys nothing: the
 * work carries on and appears to succeed, and the commit afterwards fails with an
 * `UnexpectedRollbackException` naming no cause at all.
 *
 * So this is the lookup to use wherever a missing process definition is an expected answer rather than a
 * failure — a link row that outlived the deployment it names, a definition referenced by configuration
 * that was never deployed — and especially inside a transaction that has other work to lose. A query
 * *answers*: no match is null.
 *
 * Not to be confused with `OperatonRepositoryService.findProcessDefinition`, which reads Valtimo's own
 * authorization-gated `OperatonProcessDefinition` view by specification.
 */
fun RepositoryService.findProcessDefinitionOrNull(processDefinitionId: String): ProcessDefinition? =
    createProcessDefinitionQuery().processDefinitionId(processDefinitionId).singleResult()
