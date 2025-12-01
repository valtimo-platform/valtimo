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

package com.ritense.document.service.impl;

import static com.ritense.authorization.AuthorizationContext.runWithoutAuthorization;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ritense.BaseIntegrationTest;
import com.ritense.document.domain.impl.JsonDocumentContent;
import com.ritense.document.domain.impl.JsonSchemaDocument;
import com.ritense.document.domain.impl.JsonSchemaDocumentId;
import com.ritense.document.domain.impl.request.NewDocumentRequest;
import com.ritense.document.exception.DocumentNotFoundException;
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.context.support.WithMockUser;

@Tag("integration")
class JsonSchemaDocumentServiceAtomicUpdateIntTest extends BaseIntegrationTest {

    private static final String USERNAME = "test@test.com";

    @Autowired
    private JsonSchemaDocumentService documentService;

    @Autowired
    private JsonSchemaDocumentDefinitionService documentDefinitionService;

    @Autowired
    private ObjectMapper objectMapper;

    private JsonSchemaDocument testDocument;
    private JsonSchemaDocumentId documentId;

    @BeforeEach
    void setUp() {
        testDocument = createDocument("""
            {
                "person": {
                    "firstName": "John",
                    "lastName": "Doe"
                },
                "counter": 0
            }
            """);
        documentId = testDocument.id();
    }

    @AfterEach
    void tearDown() {
        documentRepository.deleteAll();
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = {AuthoritiesConstants.ADMIN})
    void shouldModifyDocumentAtomically() {
        documentService.modifyDocumentAtomic(
            documentId, document -> {
                JsonSchemaDocument jsonDoc = (JsonSchemaDocument) document;
                try {
                    var contentNode = objectMapper.readTree(jsonDoc.content().asJson().toString());
                    ((com.fasterxml.jackson.databind.node.ObjectNode) contentNode).put("person.firstName", "Jane");
                    var newContent = JsonDocumentContent.build(
                        jsonDoc.content().asJson(),
                        contentNode,
                        null
                    );
                    return jsonDoc.applyModifiedContent(
                        newContent,
                        documentDefinitionService.findBy(jsonDoc.definitionId()).get()
                    ).resultingDocument().orElseThrow();
                } catch (Exception e) {
                    throw new RuntimeException("Failed to modify document", e);
                }
            }
        );

        JsonSchemaDocument updatedDocument = documentService.get(documentId.toString());
        assertTrue(updatedDocument.content().asJson().toString().contains("Jane"));
        assertTrue(updatedDocument.content().asJson().toString().contains("Doe"));
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = {AuthoritiesConstants.ADMIN})
    void shouldIncrementVersionAtomically() throws Throwable {
        int originalCounter = 0;
        int originalVersion = testDocument.version();
        int threadCount = 20;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        AtomicReference<Throwable> exception = new AtomicReference<>();

        IntStream.range(0, threadCount).forEach(i -> executor.submit(() -> {
            readyLatch.countDown();
            try {
                runWithoutAuthorization(() -> {
                    startLatch.await(); // ensure simultaneous start

                    documentService.modifyDocumentAtomic(
                        documentId, document -> {
                            JsonSchemaDocument jsonDoc = (JsonSchemaDocument) document;
                            try {
                                var contentNode = objectMapper.readTree(jsonDoc.content().asJson().toString());
                                int currentCounter = contentNode.get("counter").asInt();
                                ((com.fasterxml.jackson.databind.node.ObjectNode) contentNode).put(
                                    "counter",
                                    currentCounter + 1
                                );

                                var newContent = JsonDocumentContent.build(
                                    jsonDoc.content().asJson(),
                                    contentNode,
                                    null
                                );
                                return jsonDoc.applyModifiedContent(
                                    newContent,
                                    documentDefinitionService.findBy(jsonDoc.definitionId()).get()
                                ).resultingDocument().orElseThrow();
                            } catch (Exception e) {
                                throw new RuntimeException("Failed to modify document", e);
                            }
                        }
                    );
                    return null;
                });
            } catch (Throwable e) {
                exception.set(e);
            } finally {
                doneLatch.countDown();
            }
        }));

        readyLatch.await();
        startLatch.countDown();
        assertTrue(doneLatch.await(5, TimeUnit.MINUTES));
        executor.shutdown();

        if (exception.get() != null) {
            throw exception.get();
        }
        JsonSchemaDocument updated = documentRepository.findById(documentId).orElseThrow();
        var contentNode = objectMapper.readTree(updated.content().asJson().toString());
        int updatedCounter = contentNode.get("counter").asInt();

        assertEquals(originalCounter + threadCount, updatedCounter);
        assertEquals(originalVersion + threadCount, updated.version());
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = {AuthoritiesConstants.ADMIN})
    void shouldThrowExceptionForNonExistentDocument() {
        var nonExistentId = JsonSchemaDocumentId.existingId(UUID.randomUUID());

        assertThrows(
            DocumentNotFoundException.class, () ->
                documentService.modifyDocumentAtomic(nonExistentId, document -> document)
        );
    }

    private JsonSchemaDocument createDocument(String content) {
        return runWithoutAuthorization(() -> {
            var createRequest = new NewDocumentRequest(
                "allows-all",
                "allows-all",
                "1.0.0",
                new JsonDocumentContent(content).asJson()
            );

            var result = documentService.createDocument(createRequest);
            return (JsonSchemaDocument) result.resultingDocument().orElseThrow();
        });
    }
}
