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

package com.ritense.authorization.web

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationResourceTypeResolver
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.UnknownAuthorizationResourceTypeException
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.authorization.request.RelatedEntityAuthorizationRequest
import com.ritense.authorization.web.request.PermissionAvailableRequest
import com.ritense.authorization.web.result.PermissionAvailableResult
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import jakarta.validation.Valid
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class PermissionResource(
    private var authorizationService: AuthorizationService,
    private val resourceTypeResolver: AuthorizationResourceTypeResolver,
) {

    private val logger: Logger = LoggerFactory.getLogger(PermissionResource::class.java)

    @Transactional(readOnly = true)
    @PostMapping("/v1/permissions")
    fun userHasPermission(@Valid @RequestBody permissionsPresentRequest: List<PermissionAvailableRequest>)
        : ResponseEntity<List<PermissionAvailableResult>> {

        val permissionResponse: List<PermissionAvailableResult> = permissionsPresentRequest.map {
            val hasPermission =
                try {
                    val authorizationRequest = if (it.context == null) {
                        EntityAuthorizationRequest(
                            resourceTypeResolver.resolve(it.resource),
                            Action(it.action),
                        )
                    } else {
                        RelatedEntityAuthorizationRequest(
                            resourceTypeResolver.resolve(it.resource),
                            Action(it.action),
                            resourceTypeResolver.resolve(it.context.resource),
                            it.context.identifier
                        )
                    }
                    authorizationService.hasPermission(authorizationRequest)
                } catch (ex: UnknownAuthorizationResourceTypeException) {
                    // Reported as "no permission", the same as a known resource type the user is not
                    // allowed to access, so that the response does not reveal which resource types
                    // exist. Logged at debug because any authenticated caller can trigger it.
                    logger.debug("Failed to determine permissions for action '${it.action}'", ex)
                    false
                } catch (ex: Exception) {
                    // The resource type has passed the allowlist at this point, so it is safe to log.
                    logger.error("Failed to determine permissions for resource '${it.resource}'", ex)
                    false
                }

            PermissionAvailableResult(
                it.resource,
                it.action,
                it.context,
                hasPermission
            )
        }

        return ResponseEntity.ok(permissionResponse)
    }
}
