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

package com.ritense.document.web.rest;

import static com.ritense.authorization.AuthorizationContext.runWithoutAuthorization;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ritense.BaseIntegrationTest;
import com.ritense.document.domain.CaseTagColor;
import com.ritense.document.domain.impl.JsonDocumentContent;
import com.ritense.document.domain.impl.JsonSchemaDocument;
import com.ritense.document.domain.impl.request.NewDocumentRequest;
import com.ritense.document.service.CaseTagService;
import com.ritense.document.service.impl.SearchRequest;
import com.ritense.document.web.rest.dto.CaseTagCreateRequestDto;
import com.ritense.document.web.rest.impl.JsonSchemaDocumentResource;
import com.ritense.document.web.rest.impl.JsonSchemaDocumentSearchResource;
import com.ritense.outbox.OutboxService;
import com.ritense.valtimo.contract.case_.CaseDefinitionId;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * Regression test for the lazy {@code JsonSchemaDocument.caseTags} collection.
 *
 * <p>{@code caseTags} is fetched lazily and is exposed as a {@code @JsonProperty} on the {@code Document}
 * interface, so it is serialized in the document REST responses. Because {@code spring.jpa.open-in-view} is
 * disabled, no Hibernate session is open while the MVC layer serializes the response — the read paths must
 * therefore initialize {@code caseTags} within their transaction, or serialization fails with a
 * {@link org.hibernate.LazyInitializationException}.</p>
 *
 * <p>Two things make this a real guard for the read-path initialization:
 * <ul>
 *   <li>The test is intentionally <b>NOT</b> {@code @Transactional}: a test-managed transaction would keep
 *       the session open during serialization and hide exactly the failure we are guarding against.</li>
 *   <li>{@link OutboxService} is replaced with a plain mock, so the outbox's in-transaction
 *       {@code valueToTree(document)} side effect (which would otherwise initialize {@code caseTags} for us)
 *       never runs. The read-path initialization is then the only thing that loads {@code caseTags}.</li>
 * </ul>
 * With the eager fetch removed, this test fails unless the read paths explicitly initialize the collection.</p>
 */
class JsonSchemaDocumentCaseTagsSerializationIntegrationTest extends BaseIntegrationTest {

    private static final String USER_EMAIL = "user@valtimo.nl";
    private static final CaseDefinitionId CASE_DEFINITION_ID = CaseDefinitionId.of("house", "1.1.0");

    // Plain mock (not the parent's spy): its send() does nothing, so the outbox never initializes caseTags.
    @MockitoBean
    private OutboxService outboxService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CaseTagService caseTagService;

    private MockMvc documentMockMvc;
    private MockMvc searchMockMvc;

    private JsonSchemaDocument document;
    private String tagKey;

    @BeforeEach
    void setUp() {
        tagKey = "regression-tag-" + UUID.randomUUID();

        runWithoutAuthorization(() -> caseTagService.create(
            CASE_DEFINITION_ID,
            new CaseTagCreateRequestDto(tagKey, "Regression Tag", CaseTagColor.MAGENTA)
        ));

        var definition = definition();
        var content = new JsonDocumentContent("{\"street\": \"Regression case tags street\"}");
        document = runWithoutAuthorization(() ->
            documentService.createDocument(
                new NewDocumentRequest(
                    definition.id().name(),
                    definition.id().caseDefinitionId().getKey(),
                    definition.id().caseDefinitionId().getVersionTag().getVersion(),
                    content.asJson()
                )
            ).resultingDocument().orElseThrow()
        );

        runWithoutAuthorization(() -> {
            documentService.addCaseTag(document.id(), tagKey);
            return null;
        });

        documentMockMvc = MockMvcBuilders
            .standaloneSetup(new JsonSchemaDocumentResource(documentService))
            .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
            .build();

        searchMockMvc = MockMvcBuilders
            .standaloneSetup(new JsonSchemaDocumentSearchResource(documentSearchService))
            .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
            .build();
    }

    @AfterEach
    void tearDown() {
        // Non-transactional test: clean up the committed document and tag so other tests are unaffected.
        runWithoutAuthorization(() -> {
            if (document != null) {
                try {
                    documentService.deleteDocument(document.id());
                } catch (RuntimeException e) {
                    documentRepository.deleteById(document.id());
                }
            }
            if (tagKey != null) {
                try {
                    caseTagService.delete(CASE_DEFINITION_ID, tagKey);
                } catch (RuntimeException ignored) {
                    // best-effort cleanup
                }
            }
            return null;
        });
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldSerializeCaseTagsWhenGettingDocumentOutsideOfSession() throws Exception {
        documentMockMvc.perform(get("/api/v1/document/{documentId}", document.id().getId().toString()))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.caseTags").isArray())
            .andExpect(jsonPath("$.caseTags.length()").value(1))
            .andExpect(jsonPath("$.caseTags[0].key").value(tagKey))
            .andExpect(jsonPath("$.caseTags[0].title").value("Regression Tag"))
            .andExpect(jsonPath("$.caseTags[0].color").value("MAGENTA"))
            .andExpect(jsonPath("$.caseTags[0].caseDefinitionKey").value("house"));
    }

    @Test
    @WithMockUser(username = USER_EMAIL, authorities = {FULL_ACCESS_ROLE})
    void shouldSerializeCaseTagsWhenSearchingDocumentsOutsideOfSession() throws Exception {
        var searchRequest = new SearchRequest();
        searchRequest.setDocumentDefinitionName("house");

        searchMockMvc.perform(
                post("/api/v1/document-search")
                    .param("size", "2000")
                    .content(objectMapper.writeValueAsBytes(searchRequest))
                    .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[*].caseTags[*].key", hasItem(tagKey)));
    }
}
