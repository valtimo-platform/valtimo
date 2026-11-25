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

package com.ritense.document.service.impl;

import static org.assertj.core.api.AssertionsForClassTypes.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.ritense.document.domain.DocumentDefinition;
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId;
import com.ritense.document.domain.impl.sequence.JsonSchemaDocumentDefinitionSequenceRecord;
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionSequenceRepository;
import java.time.Duration;
import java.util.Optional;
import com.ritense.valtimo.contract.case_.CaseDefinitionId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.semver4j.Semver;
import org.springframework.core.retry.RetryPolicy;
import org.springframework.resilience.annotation.Retryable;
import org.springframework.util.backoff.BackOffExecution;

public class JsonSchemaDocumentDefinitionSequenceGeneratorServiceTest {

    private JsonSchemaDocumentDefinitionSequenceRepository documentDefinitionSequenceRepository;
    private JsonSchemaDocumentDefinitionSequenceGeneratorService sequenceGeneratorService;

    @BeforeEach
    public void setUp() {
        documentDefinitionSequenceRepository = mock(JsonSchemaDocumentDefinitionSequenceRepository.class);
        sequenceGeneratorService = new JsonSchemaDocumentDefinitionSequenceGeneratorService(
            documentDefinitionSequenceRepository);
    }

    @Test
    public void shouldGetNewSequenceWithInitialValueOf1() {
        final var id = JsonSchemaDocumentDefinitionId.of(
            "Some-Name",
            new CaseDefinitionId("test", Semver.of(1, 0, 0))
        );

        when(documentDefinitionSequenceRepository.findByDefinitionName(id.name())).thenReturn(Optional.empty());

        final long nextSequence = sequenceGeneratorService.next(id);

        assertThat(nextSequence).isEqualTo(1);
    }

    @Test
    public void shouldGetUpdatedSequenceWithValueOf2() {
        final var id = JsonSchemaDocumentDefinitionId.existingId(
            "Some-Name",
            new CaseDefinitionId("test", Semver.of(1, 0, 0))
        );

        when(documentDefinitionSequenceRepository.findByDefinitionName(id.name()))
            .thenReturn(Optional.empty())
            .thenReturn(Optional.of(new JsonSchemaDocumentDefinitionSequenceRecord(id.name())));
        sequenceGeneratorService.next(id);
        final long nextSequence = sequenceGeneratorService.next(id);

        assertThat(nextSequence).isEqualTo(2);
    }

    @Test
    public void shouldRetryWithRandomDelayBetweenHalfAndFiveSeconds() throws NoSuchMethodException {
        final var retryable = JsonSchemaDocumentDefinitionSequenceGeneratorService.class
            .getMethod("next", DocumentDefinition.Id.class)
            .getAnnotation(Retryable.class);
        // Same mapping as Spring's AbstractRetryInterceptor
        final var backOff = RetryPolicy.builder()
            .maxRetries(retryable.maxRetries())
            .delay(Duration.ofMillis(retryable.delay()))
            .jitter(Duration.ofMillis(retryable.jitter()))
            .multiplier(retryable.multiplier())
            .maxDelay(Duration.ofMillis(retryable.maxDelay()))
            .build()
            .getBackOff();

        long min = Long.MAX_VALUE;
        long max = Long.MIN_VALUE;
        for (int run = 0; run < 250; run++) {
            final BackOffExecution execution = backOff.start();
            for (int retry = 0; retry < retryable.maxRetries(); retry++) {
                final long delay = execution.nextBackOff();
                min = Math.min(min, delay);
                max = Math.max(max, delay);
            }
            assertThat(execution.nextBackOff()).isEqualTo(BackOffExecution.STOP);
        }

        assertThat(retryable.maxRetries()).isEqualTo(4);
        assertThat(min).isBetween(500L, 1000L);
        assertThat(max).isBetween(4500L, 5000L);
    }

}