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
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.everit.json.schema.Schema;
import org.junit.jupiter.api.Test;

/** Caching a built schema is only observable as identity: an uncached build returns an equal schema. */
class JsonSchemaTest {

    private static final URI HOUSE = URI.create("config/unit-test/document/definition/house.schema.json");
    private static final URI PERSON = URI.create("config/unit-test/document/definition/person.schema.json");

    @Test
    void shouldBuildTheSchemaOnceForRepeatedCalls() {
        var jsonSchema = JsonSchema.fromResourceUri(HOUSE);

        var first = jsonSchema.getSchema();

        assertThat(jsonSchema.getSchema()).isSameAs(first);
        assertThat(jsonSchema.getSchema()).isSameAs(first);
    }

    /** Keyed by the schema JSON, not per instance: Hibernate hands back a fresh definition each time. */
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

    /** An edited schema is a different key, which is why the cache cannot go stale. */
    @Test
    void shouldBuildAgainWhenTheSchemaJsonDiffers() {
        var original = JsonSchema.fromResourceUri(HOUSE);
        var edited = JsonSchema.fromString(
            original.asJson().toString().replace("\"maxLength\":100", "\"maxLength\":99")
        );

        assertThat(edited.asJson()).isNotEqualTo(original.asJson()); // the edit really took
        assertThat(edited.getSchema()).isNotSameAs(original.getSchema());
    }

    @Test
    void shouldStillValidateDocumentsAgainstACachedSchema() {
        var jsonSchema = JsonSchema.fromResourceUri(HOUSE);
        jsonSchema.getSchema(); // prime the cache

        var content = JsonDocumentContent.build(
            MapperSingleton.INSTANCE.get().createObjectNode().put("street", "Funenpark")
        );

        assertThat(jsonSchema.validateDocument(content).asJson().get("street").asText())
            .isEqualTo("Funenpark");
    }

    /** Concurrent misses may build twice; every caller must still get an equivalent schema. */
    @Test
    void shouldSettleOnOneSchemaUnderConcurrentFirstUse() throws Exception {
        var schemas = IntStream.range(0, 8)
            .mapToObj(i -> JsonSchema.fromResourceUri(HOUSE))
            .toList();
        ExecutorService executor = Executors.newFixedThreadPool(8);
        try {
            List<Callable<Schema>> calls = schemas.stream()
                .map(s -> (Callable<Schema>) s::getSchema)
                .collect(Collectors.toList());

            Set<Schema> distinct = executor.invokeAll(calls).stream()
                .map(JsonSchemaTest::get)
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));

            assertThat(distinct).hasSize(1);
        } finally {
            executor.shutdownNow();
        }
    }

    private static Schema get(Future<Schema> future) {
        try {
            return future.get();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
