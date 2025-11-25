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

package com.ritense.valtimo.contract.utils;

import static org.assertj.core.api.AssertionsForClassTypes.assertThat;

import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

class RequestHelperTest {
    MockHttpServletRequest mockRequest;

    @BeforeEach
    void setup() {
        mockRequest = new MockHttpServletRequest();
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(mockRequest));
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void getZoneOffsetShouldDefaultToUtcIfHeaderEmpty() {
        ZoneOffset zoneOffset = RequestHelper.getZoneOffset();

        assertThat(zoneOffset).isSameAs(ZoneOffset.UTC);
    }

    @Test
    void getZoneOffsetShouldDefaultToUtcIfHeaderInvalid() {
        mockRequest.addHeader("X-Timezone-Offset", "invalid zone offset");

        ZoneOffset zoneOffset = RequestHelper.getZoneOffset();

        assertThat(zoneOffset).isSameAs(ZoneOffset.UTC);
    }

    @Test
    void getZoneOffsetShouldReturnZoneOffsetSetIfValidHeader() {
        mockRequest.addHeader("X-Timezone-Offset", "+01:00");

        ZoneOffset zoneOffset = RequestHelper.getZoneOffset();

        assertThat(zoneOffset).isSameAs(ZoneOffset.of("+01:00"));
    }

    // Tests for getRequestZoneOffset method

    @Test
    void getRequestZoneOffsetShouldReturnEmptyWhenNoRequestContext() {
        RequestContextHolder.resetRequestAttributes();

        Optional<ZoneOffset> zoneOffset = RequestHelper.getRequestZoneOffset();

        assertThat(zoneOffset).isEmpty();
    }

    @Test
    void getRequestZoneOffsetShouldReturnEmptyWhenHeaderNotPresent() {
        Optional<ZoneOffset> zoneOffset = RequestHelper.getRequestZoneOffset();

        assertThat(zoneOffset).isEmpty();
    }

    @Test
    void getRequestZoneOffsetShouldReturnEmptyWhenHeaderIsBlank() {
        mockRequest.addHeader("X-Timezone-Offset", "");

        Optional<ZoneOffset> zoneOffset = RequestHelper.getRequestZoneOffset();

        assertThat(zoneOffset).isEmpty();
    }

    @Test
    void getRequestZoneOffsetShouldReturnEmptyWhenHeaderIsWhitespace() {
        mockRequest.addHeader("X-Timezone-Offset", "   ");

        Optional<ZoneOffset> zoneOffset = RequestHelper.getRequestZoneOffset();

        assertThat(zoneOffset).isEmpty();
    }

    @Test
    void getRequestZoneOffsetShouldReturnZoneOffsetWhenValidPositiveOffset() {
        mockRequest.addHeader("X-Timezone-Offset", "+01:00");

        Optional<ZoneOffset> zoneOffset = RequestHelper.getRequestZoneOffset();

        assertThat(zoneOffset).isPresent();
        assertThat(zoneOffset.orElseThrow()).isEqualTo(ZoneOffset.of("+01:00"));
    }

    @Test
    void getRequestZoneOffsetShouldReturnZoneOffsetWhenValidNegativeOffset() {
        mockRequest.addHeader("X-Timezone-Offset", "-05:00");

        Optional<ZoneOffset> zoneOffset = RequestHelper.getRequestZoneOffset();

        assertThat(zoneOffset).isPresent();
        assertThat(zoneOffset.orElseThrow()).isEqualTo(ZoneOffset.of("-05:00"));
    }

    @Test
    void getRequestZoneOffsetShouldReturnZoneOffsetWhenValidUtcOffset() {
        mockRequest.addHeader("X-Timezone-Offset", "Z");

        Optional<ZoneOffset> zoneOffset = RequestHelper.getRequestZoneOffset();

        assertThat(zoneOffset).isPresent();
        assertThat(zoneOffset.orElseThrow()).isEqualTo(ZoneOffset.UTC);
    }

    @Test
    void getRequestZoneOffsetShouldReturnZoneOffsetWhenValidOffsetWithSeconds() {
        mockRequest.addHeader("X-Timezone-Offset", "+05:30:00");

        Optional<ZoneOffset> zoneOffset = RequestHelper.getRequestZoneOffset();

        assertThat(zoneOffset).isPresent();
        assertThat(zoneOffset.orElseThrow()).isEqualTo(ZoneOffset.of("+05:30:00"));
    }

    @Test
    void getRequestZoneOffsetShouldReturnEmptyWhenInvalidOffset() {
        mockRequest.addHeader("X-Timezone-Offset", "invalid-offset");

        Optional<ZoneOffset> zoneOffset = RequestHelper.getRequestZoneOffset();

        assertThat(zoneOffset).isEmpty();
    }

    @Test
    void getRequestZoneOffsetShouldReturnEmptyWhenOffsetOutOfRange() {
        mockRequest.addHeader("X-Timezone-Offset", "+25:00");

        Optional<ZoneOffset> zoneOffset = RequestHelper.getRequestZoneOffset();

        assertThat(zoneOffset).isEmpty();
    }

    @Test
    void getRequestZoneOffsetShouldReturnZoneOffsetWhenValidShortFormat() {
        mockRequest.addHeader("X-Timezone-Offset", "+01");

        Optional<ZoneOffset> zoneOffset = RequestHelper.getRequestZoneOffset();

        assertThat(zoneOffset).isPresent();
        assertThat(zoneOffset.orElseThrow()).isEqualTo(ZoneOffset.of("+01"));
    }

    @Test
    void getRequestZoneOffsetShouldReturnZoneOffsetWhenValidMinuteOnlyOffset() {
        mockRequest.addHeader("X-Timezone-Offset", "+00:30");

        Optional<ZoneOffset> zoneOffset = RequestHelper.getRequestZoneOffset();

        assertThat(zoneOffset).isPresent();
        assertThat(zoneOffset.orElseThrow()).isEqualTo(ZoneOffset.of("+00:30"));
    }
}