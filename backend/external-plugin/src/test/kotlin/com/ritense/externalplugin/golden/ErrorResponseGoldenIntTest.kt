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

package com.ritense.externalplugin.golden

import com.ritense.buildingblock.exception.UnknownBuildingBlockInstanceException
import com.ritense.externalplugin.BaseIntegrationTest
import com.ritense.externalplugin.exception.ExternalPluginConfigurationInUseException
import com.ritense.externalplugin.exception.ExternalPluginNotFoundException
import com.ritense.form.exception.FormDefinitionInUseException
import com.ritense.form.exception.FormDefinitionUsage
import com.ritense.plugin.exception.PluginConfigurationInUseException
import com.ritense.plugin.web.rest.dto.PluginUsageDto
import com.ritense.plugin.web.rest.dto.PluginUsageParentType
import com.ritense.valtimo.contract.document.CaseDocumentResolutionException
import com.ritense.valtimo.contract.web.rest.error.BadRequestAlertException
import com.ritense.valtimo.test.golden.GoldenMvc
import com.ritense.valueresolver.exception.ValueResolverValidationException
import jakarta.validation.ConstraintViolationException
import jakarta.validation.Validator
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.dao.OptimisticLockingFailureException
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType.APPLICATION_JSON
import org.springframework.security.access.AccessDeniedException
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.RequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.validation.BindException
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.context.WebApplicationContext
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException
import org.springframework.web.servlet.NoHandlerFoundException
import java.net.SocketTimeoutException
import java.util.UUID

/**
 * Pins the JSON of every kind of error response the exception translator produces, so that replacing the
 * error handling library can be checked against a baseline. Each endpoint of [ErrorGoldenController] throws
 * one kind of exception.
 */
class ErrorResponseGoldenIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    lateinit var mockMvc: MockMvc

    @BeforeEach
    fun setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build()
    }

    @Test
    fun `translator error responses keep their JSON`() {
        golden("error-internal", get("$BASE/internal"))
        golden("error-response-status-annotation", get("$BASE/response-status-annotation"))
        golden("error-response-status-exception", get("$BASE/response-status-exception"))
        golden("error-access-denied", get("$BASE/access-denied"))
        golden("error-no-such-element", get("$BASE/no-such-element"))
        golden("error-concurrency", get("$BASE/concurrency"))
        golden("error-unsupported-operation", get("$BASE/unsupported-operation"))
        golden("error-socket-timeout", get("$BASE/socket-timeout"))
        golden("error-no-handler", get("$BASE/no-handler"))
        golden("error-no-resource", get("$BASE/does-not-exist"))
        golden("error-type-mismatch", get("$BASE/type-mismatch").param("number", "abc"))
        golden("error-missing-part", multipart("$BASE/missing-part"))
        golden("error-constraint-violation", get("$BASE/constraint-violation"))
        golden("error-bind", get("$BASE/bind"))
        golden(
            "error-method-argument-not-valid",
            post("$BASE/method-argument").contentType(APPLICATION_JSON).content("""{"name": null, "code": "x"}""")
        )
        golden("error-mapper", get("$BASE/mapper"))
        golden("error-accept-x-problem", get("$BASE/internal").accept("application/x.problem+json"))
    }

    @Test
    fun `media type error responses keep their JSON and headers`() {
        val unsupported = golden(
            "error-unsupported-media-type",
            post("$BASE/xml-only").contentType(APPLICATION_JSON).content("{}")
        )
        assertThat(unsupported.response.getHeader(HttpHeaders.ACCEPT)).isEqualTo("application/xml")

        golden("error-not-acceptable", get("$BASE/csv-only").accept(APPLICATION_JSON))

        val notAllowed = golden("error-method-not-allowed-headers", post("$BASE/internal"))
        assertThat(notAllowed.response.getHeader(HttpHeaders.ALLOW)).isNull()
    }

    @Test
    fun `custom problem responses keep their JSON`() {
        golden("problem-bad-request-alert", get("$BASE/bad-request-alert"))
        golden("problem-case-document-resolution", get("$BASE/case-document-resolution"))
        golden("problem-form-definition-in-use", get("$BASE/form-definition-in-use"))
        golden("problem-plugin-configuration-in-use", get("$BASE/plugin-configuration-in-use"))
        golden("problem-external-plugin-configuration-in-use", get("$BASE/external-plugin-configuration-in-use"))
        golden("problem-external-plugin-not-found", get("$BASE/external-plugin-not-found"))
        golden("problem-without-title", get("$BASE/without-title"))
        golden("problem-value-resolver-validation", get("$BASE/value-resolver-validation"))
    }

    @Test
    fun `whitelisted clients get unsanitized error responses`() {
        golden(
            "error-internal-whitelisted",
            get("$BASE/internal"),
            remoteAddr = "127.0.0.1",
            ignorePaths = listOf("/body/stack-trace")
        )
        golden(
            "error-access-denied-whitelisted",
            get("$BASE/access-denied"),
            remoteAddr = "127.0.0.1",
            ignorePaths = listOf("/body/stack-trace")
        )
        golden("problem-bad-request-alert-whitelisted", get("$BASE/bad-request-alert"), remoteAddr = "127.0.0.1")
    }

    private fun golden(
        name: String,
        request: RequestBuilder,
        remoteAddr: String = "10.20.30.40",
        ignorePaths: List<String> = emptyList(),
    ) = mockMvc.perform { context -> request.buildRequest(context).apply { this.remoteAddr = remoteAddr } }
        .andReturn()
        .also { GoldenMvc.assertMatchesGolden(javaClass, name, it, ignorePaths) }

    @TestConfiguration
    class ErrorGoldenConfiguration {
        @Bean
        fun errorGoldenController(validator: Validator) = ErrorGoldenController(validator)
    }

    @RestController
    @RequestMapping(BASE)
    class ErrorGoldenController(private val validator: Validator) {

        @GetMapping("/internal")
        fun internal(): String = throw IllegalStateException("Something broke")

        @GetMapping("/response-status-annotation")
        fun responseStatusAnnotation(): String = throw AnnotatedException("Annotated failure")

        @GetMapping("/response-status-exception")
        fun responseStatusException(): String = throw ResponseStatusException(HttpStatus.CONFLICT, "Already there")

        @GetMapping("/access-denied")
        fun accessDenied(): String = throw AccessDeniedException("No access to this")

        @GetMapping("/no-such-element")
        fun noSuchElement(): String = throw NoSuchElementException("Nothing here")

        @GetMapping("/concurrency")
        fun concurrency(): String = throw OptimisticLockingFailureException("Changed by someone else")

        @GetMapping("/unsupported-operation")
        fun unsupportedOperation(): String = throw UnsupportedOperationException("Not supported")

        @GetMapping("/socket-timeout")
        fun socketTimeout(): String = throw SocketTimeoutException("Read timed out")

        @GetMapping("/no-handler")
        fun noHandler(): String = throw NoHandlerFoundException("GET", "/nowhere", HttpHeaders())

        @GetMapping("/type-mismatch")
        fun typeMismatch(@RequestParam number: Int): String = number.toString()

        @PostMapping("/missing-part")
        fun missingPart(@RequestPart file: MultipartFile): String = file.name

        @GetMapping("/constraint-violation")
        fun constraintViolation(): String = throw ConstraintViolationException(validator.validate(GoldenBean(null, "")))

        @GetMapping("/bind")
        fun bind(): String {
            val exception = BindException(GoldenBean(null, ""), "goldenBean")
            exception.rejectValue("name", "size", "size must be between 1 and 10")
            exception.reject("global", "bean is not valid")
            throw exception
        }

        @PostMapping("/method-argument")
        fun methodArgument(@RequestBody @jakarta.validation.Valid bean: GoldenBean): String = bean.name ?: ""

        @GetMapping("/mapper")
        fun mapper(): String = throw jakarta.validation.ValidationException("Mapped failure")

        @PostMapping("/xml-only", consumes = ["application/xml"])
        fun xmlOnly(@RequestBody body: String): String = body

        @GetMapping("/csv-only", produces = ["text/csv"])
        fun csvOnly(): String = "a,b"

        @GetMapping("/bad-request-alert")
        fun badRequestAlert(): String = throw BadRequestAlertException("Bad thing happened", "goldenEntity", "badThing")

        @GetMapping("/case-document-resolution")
        fun caseDocumentResolution(): String = throw CaseDocumentResolutionException("Case document not found")

        @GetMapping("/form-definition-in-use")
        fun formDefinitionInUse(): String = throw FormDefinitionInUseException(
            UUID.fromString("00000000-0000-0000-0000-00000000000f"),
            listOf(FormDefinitionUsage("golden-process", "Golden process", "task1"))
        )

        @GetMapping("/plugin-configuration-in-use")
        fun pluginConfigurationInUse(): String = throw PluginConfigurationInUseException(
            UUID.fromString("00000000-0000-0000-0000-00000000000a"),
            listOf(usage())
        )

        @GetMapping("/external-plugin-configuration-in-use")
        fun externalPluginConfigurationInUse(): String = throw ExternalPluginConfigurationInUseException(
            UUID.fromString("00000000-0000-0000-0000-00000000000b"),
            listOf(usage())
        )

        @GetMapping("/external-plugin-not-found")
        fun externalPluginNotFound(): String =
            throw ExternalPluginNotFoundException("Host", UUID.fromString("00000000-0000-0000-0000-00000000000c"))

        @GetMapping("/without-title")
        fun withoutTitle(): String = throw UnknownBuildingBlockInstanceException(null as String?)

        @GetMapping("/value-resolver-validation")
        fun valueResolverValidation(): String = throw ValueResolverValidationException("Value is not valid")

        private fun usage() = PluginUsageDto(
            configurationId = UUID.fromString("00000000-0000-0000-0000-00000000000a"),
            configurationTitle = "Golden configuration",
            parentType = PluginUsageParentType.CASE,
            parentKey = "house",
            parentVersionTag = "1.0.0",
            processDefinitionKey = "golden-process",
            activityId = "task1",
        )
    }

    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY, reason = "Cannot process this")
    class AnnotatedException(message: String) : RuntimeException(message)

    data class GoldenBean(
        @field:NotNull
        val name: String?,
        @field:Size(min = 1, max = 10)
        val code: String,
    )

    companion object {
        const val BASE = "/api/test/error-golden"
    }
}
