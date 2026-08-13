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

package com.ritense.externalplugin.service

import com.ritense.valtimo.contract.endpoint.EndpointDescription as EndpointDescriptionAnnotation
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.web.bind.annotation.RequestMethod
import org.springframework.web.method.HandlerMethod
import org.springframework.web.servlet.mvc.method.RequestMappingInfo
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping

/**
 * Resolves the localised text the activation-time permission screen renders for each endpoint a
 * plugin requests (plan §4). The screen is security-critical — it is where an admin decides what the
 * plugin may reach — so a manifest's wildcard glob has to resolve against the controller's Spring
 * placeholder pattern (`{documentId}` and friends), and the answer must not depend on the JVM's
 * handler-map iteration order.
 */
class EndpointDescriptionServiceTest {

    /** Controller whose annotated handlers back the stubbed handler mappings below. */
    @Suppress("unused")
    private class TestController {
        @EndpointDescriptionAnnotation(en = "Get a document", nl = "Document ophalen")
        fun getDocument() = Unit

        @EndpointDescriptionAnnotation(en = "Search cases", nl = "Zaken zoeken")
        fun searchCases() = Unit

        @EndpointDescriptionAnnotation(en = "Count cases", nl = "Zaken tellen")
        fun countCases() = Unit

        @EndpointDescriptionAnnotation(en = "Add a note", nl = "Notitie toevoegen")
        fun addNote() = Unit

        fun undocumented() = Unit
    }

    private val controller = TestController()

    private fun handlerMethod(methodName: String) =
        HandlerMethod(controller, TestController::class.java.getDeclaredMethod(methodName))

    private fun info(path: String, method: RequestMethod?) = RequestMappingInfo
        .paths(path)
        .apply { method?.let { methods(it) } }
        .build()

    /**
     * Builds the service over a stubbed handler mapping. `entries` order is preserved (LinkedHashMap),
     * which lets the determinism test feed the same registrations in two different orders.
     */
    private fun service(vararg entries: Pair<RequestMappingInfo, String>): EndpointDescriptionService {
        val handlerMethods = linkedMapOf<RequestMappingInfo, HandlerMethod>()
        entries.forEach { (mappingInfo, methodName) ->
            handlerMethods[mappingInfo] = handlerMethod(methodName)
        }
        val mapping = mock<RequestMappingHandlerMapping>()
        whenever(mapping.handlerMethods).thenReturn(handlerMethods)
        return EndpointDescriptionService(listOf(mapping))
    }

    private fun defaultService() = service(
        info("/api/v1/document/{documentId}", RequestMethod.GET) to "getDocument",
        info("/api/v1/case/{caseDefinitionName}/search", RequestMethod.POST) to "searchCases",
        info("/api/v1/document/{documentId}/note", RequestMethod.POST) to "addNote",
    )

    private fun describe(
        service: EndpointDescriptionService,
        method: String,
        pattern: String,
        locale: String = "en",
    ) = service.resolveDescriptions(listOf(EndpointQuery(method, pattern)), locale).single()

    // ---------------------------------------------------------------- exact match

    @Test
    fun `resolves an exactly matching method and pattern`() {
        val result = describe(defaultService(), "GET", "/api/v1/document/{documentId}")

        assertThat(result.description).isEqualTo("Get a document")
        assertThat(result.method).isEqualTo("GET")
        assertThat(result.pattern).isEqualTo("/api/v1/document/{documentId}")
    }

    @Test
    fun `upper-cases the queried method before looking it up`() {
        assertThat(describe(defaultService(), "get", "/api/v1/document/{documentId}").description)
            .isEqualTo("Get a document")
        assertThat(describe(defaultService(), "get", "/api/v1/document/{documentId}").method)
            .isEqualTo("GET")
    }

    // ---------------------------------------------------------------- glob patterns

    @Test
    fun `resolves a manifest glob against a Spring placeholder pattern`() {
        // What a plugin manifest actually declares: permissions.endpoints uses `*`, not `{param}`.
        assertThat(describe(defaultService(), "GET", "/api/v1/document/*").description)
            .isEqualTo("Get a document")
    }

    @Test
    fun `a single wildcard never spans a slash`() {
        // `/api/v1/document/*` must not resolve to the two-segment `.../note` endpoint.
        assertThat(describe(defaultService(), "POST", "/api/v1/document/*").description).isNull()
    }

    @Test
    fun `a double wildcard spans several segments`() {
        assertThat(describe(defaultService(), "POST", "/api/v1/document/**").description)
            .isEqualTo("Add a note")
    }

    @Test
    fun `resolves a glob in the middle of a path`() {
        assertThat(describe(defaultService(), "POST", "/api/v1/case/*/search").description)
            .isEqualTo("Search cases")
    }

    @Test
    fun `requires the method to match, not only the path`() {
        assertThat(describe(defaultService(), "DELETE", "/api/v1/document/*").description).isNull()
    }

    // ---------------------------------------------------------------- placeholder queries

    @Test
    fun `resolves a placeholder query against a differently-named placeholder`() {
        assertThat(describe(defaultService(), "GET", "/api/v1/document/{id}").description)
            .isEqualTo("Get a document")
    }

    // ---------------------------------------------------------------- locales

    @Test
    fun `returns the Dutch text for the nl locale`() {
        assertThat(describe(defaultService(), "GET", "/api/v1/document/{documentId}", "nl").description)
            .isEqualTo("Document ophalen")
    }

    @Test
    fun `falls back to English for a locale the annotation does not declare`() {
        assertThat(describe(defaultService(), "GET", "/api/v1/document/{documentId}", "de").description)
            .isEqualTo("Get a document")
    }

    // ---------------------------------------------------------------- misses

    @Test
    fun `returns a null description for an unknown pattern rather than failing`() {
        val result = describe(defaultService(), "GET", "/api/v1/unknown/thing")

        assertThat(result.description).isNull()
        assertThat(result.pattern).isEqualTo("/api/v1/unknown/thing")
    }

    @Test
    fun `ignores handlers that carry no annotation`() {
        val service = service(info("/api/v1/undocumented", RequestMethod.GET) to "undocumented")

        assertThat(describe(service, "GET", "/api/v1/undocumented").description).isNull()
    }

    @Test
    fun `resolves several queries in one call, preserving order`() {
        val results = defaultService().resolveDescriptions(
            listOf(
                EndpointQuery("GET", "/api/v1/document/*"),
                EndpointQuery("POST", "/api/v1/case/*/search"),
                EndpointQuery("GET", "/api/v1/nope"),
            )
        )

        assertThat(results.map { it.description })
            .containsExactly("Get a document", "Search cases", null)
    }

    // ---------------------------------------------------------------- method-less handlers

    @Test
    fun `a handler declaring no HTTP method is indexed under every verb`() {
        val service = service(info("/api/v1/document/{documentId}", null) to "getDocument")

        for (verb in listOf("GET", "POST", "PUT", "PATCH", "DELETE")) {
            assertThat(describe(service, verb, "/api/v1/document/*").description)
                .isEqualTo("Get a document")
        }
    }

    // ---------------------------------------------------------------- determinism

    @Test
    fun `a broad glob matching several endpoints resolves the same way regardless of registration order`() {
        // Spring's handler map iterates in an unstable order, so a first-match-wins lookup would make
        // the permission screen show different text for the same grant on different boots.
        val search = info("/api/v1/case/{caseDefinitionName}/search", RequestMethod.POST) to "searchCases"
        val count = info("/api/v1/case/{caseDefinitionName}/count", RequestMethod.POST) to "countCases"

        val oneOrder = describe(service(search, count), "POST", "/api/v1/case/**").description
        val otherOrder = describe(service(count, search), "POST", "/api/v1/case/**").description

        assertThat(oneOrder).isNotNull()
        assertThat(oneOrder).isEqualTo(otherOrder)
    }

    @Test
    fun `repeated lookups of the same broad glob are stable`() {
        val service = service(
            info("/api/v1/case/{caseDefinitionName}/search", RequestMethod.POST) to "searchCases",
            info("/api/v1/case/{caseDefinitionName}/count", RequestMethod.POST) to "countCases",
        )

        val descriptions = (1..5).map { describe(service, "POST", "/api/v1/case/**").description }

        assertThat(descriptions.distinct()).hasSize(1)
    }

    // ---------------------------------------------------------------- multiple handler mappings

    @Test
    fun `indexes handlers from every supplied handler mapping`() {
        val first = mock<RequestMappingHandlerMapping>()
        whenever(first.handlerMethods).thenReturn(
            linkedMapOf(info("/api/v1/document/{documentId}", RequestMethod.GET) to handlerMethod("getDocument"))
        )
        val second = mock<RequestMappingHandlerMapping>()
        whenever(second.handlerMethods).thenReturn(
            linkedMapOf(
                info("/api/v1/case/{caseDefinitionName}/search", RequestMethod.POST) to handlerMethod("searchCases")
            )
        )
        val service = EndpointDescriptionService(listOf(first, second))

        assertThat(describe(service, "GET", "/api/v1/document/*").description).isEqualTo("Get a document")
        assertThat(describe(service, "POST", "/api/v1/case/*/search").description).isEqualTo("Search cases")
    }

    @Test
    fun `an empty handler mapping list resolves everything to null`() {
        val service = EndpointDescriptionService(emptyList())

        assertThat(describe(service, "GET", "/api/v1/document/*").description).isNull()
    }
}
