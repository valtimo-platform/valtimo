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

package com.ritense.document.domain.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.ritense.valtimo.contract.json.MapperSingleton;
import java.net.URI;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.everit.json.schema.Schema;
import org.junit.jupiter.api.Test;

class JsonSchemaTest {

    private static final URI HOUSE = URI.create("config/unit-test/document/definition/house.schema.json");
    private static final URI PERSON = URI.create("config/unit-test/document/definition/person.schema.json");

    private static final int CONCURRENT_CALLERS = 8;

    @Test
    void shouldBuildTheSchemaOnceForRepeatedCalls() {
        var jsonSchema = JsonSchema.fromResourceUri(HOUSE);

        var first = jsonSchema.getSchema();

        assertThat(jsonSchema.getSchema()).isSameAs(first);
        assertThat(jsonSchema.getSchema()).isSameAs(first);
    }

    @Test
    void shouldShareABuiltSchemaBetweenSeparateInstancesOfTheSameSchema() {
        var one = JsonSchema.fromResourceUri(HOUSE);
        var other = JsonSchema.fromResourceUri(HOUSE);

        assertThat(other.getSchema()).isSameAs(one.getSchema());
    }

    @Test
    void shouldNotShareABuiltSchemaBetweenDifferentSchemas() {
        var house = JsonSchema.fromResourceUri(HOUSE);
        var person = JsonSchema.fromResourceUri(PERSON);

        assertThat(person.getSchema()).isNotSameAs(house.getSchema());
        assertThat(person.getSchema().getId()).isNotEqualTo(house.getSchema().getId());
    }

    @Test
    void shouldBuildAgainWhenTheSchemaJsonDiffers() {
        var original = JsonSchema.fromResourceUri(HOUSE);
        var edited = JsonSchema.fromString(
            original.asJson().toString().replace("\"maxLength\":100", "\"maxLength\":99")
        );

        assertThat(edited.asJson()).isNotEqualTo(original.asJson());
        assertThat(edited.getSchema()).isNotSameAs(original.getSchema());
    }

    @Test
    void shouldStillValidateDocumentsAgainstACachedSchema() {
        var jsonSchema = JsonSchema.fromResourceUri(HOUSE);
        jsonSchema.getSchema();

        var content = JsonDocumentContent.build(
            MapperSingleton.INSTANCE.get().createObjectNode().put("street", "Funenpark")
        );

        assertThat(jsonSchema.validateDocument(content).asJson().get("street").asText())
            .isEqualTo("Funenpark");
    }

    @Test
    void shouldSettleOnOneSchemaUnderConcurrentFirstUse() throws Exception {
        var neverBuiltBefore = uniqueSchemaJson("concurrent-first-use");
        var schemas = IntStream.range(0, CONCURRENT_CALLERS)
            .mapToObj(i -> JsonSchema.fromString(neverBuiltBefore))
            .toList();
        var startTogether = new CyclicBarrier(CONCURRENT_CALLERS);
        ExecutorService executor = Executors.newFixedThreadPool(CONCURRENT_CALLERS);
        try {
            List<Callable<Schema>> calls = schemas.stream()
                .map(jsonSchema -> (Callable<Schema>) () -> {
                    startTogether.await(10, TimeUnit.SECONDS);
                    return jsonSchema.getSchema();
                })
                .collect(Collectors.toList());

            Set<Schema> byIdentity = Collections.newSetFromMap(new IdentityHashMap<>());
            executor.invokeAll(calls).stream().map(JsonSchemaTest::get).forEach(byIdentity::add);

            assertThat(byIdentity).hasSize(1);
            assertThat(JsonSchema.fromString(neverBuiltBefore).getSchema())
                .isSameAs(byIdentity.iterator().next());
        } finally {
            executor.shutdownNow();
        }
    }

    /** The cap is a backstop against unforeseen growth, so passing it drops what was built before. */
    @Test
    void shouldNotHoldOnToSchemasPastTheCap() {
        var jsonSchema = JsonSchema.fromString(uniqueSchemaJson("dropped-past-the-cap"));
        var builtOnce = jsonSchema.getSchema();

        IntStream.rangeClosed(0, 100)
            .forEach(i -> JsonSchema.fromString(uniqueSchemaJson("filler-" + i)).getSchema());

        assertThat(jsonSchema.getSchema()).isNotSameAs(builtOnce);
    }

    private static String uniqueSchemaJson(String name) {
        return """
            {
              "$id": "%s.schema",
              "$schema": "http://json-schema.org/draft-07/schema#",
              "title": "%s",
              "type": "object",
              "properties": {
                "street": {
                  "type": "string",
                  "maxLength": 100
                }
              },
              "additionalProperties": false
            }
            """.formatted(name, name);
    }

    private static Schema get(Future<Schema> future) {
        try {
            return future.get();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
