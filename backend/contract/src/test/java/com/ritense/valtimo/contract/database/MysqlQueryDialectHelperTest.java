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

package com.ritense.valtimo.contract.database;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MysqlQueryDialectHelperTest {

    private MysqlQueryDialectHelper helper;

    @BeforeEach
    void setUp() {
        helper = new MysqlQueryDialectHelper();
    }

    @Test
    void escapeLikePatternShouldEscapePercent() {
        String result = helper.escapeLikePattern("100%");
        assertEquals("100\\%", result);
    }

    @Test
    void escapeLikePatternShouldEscapeUnderscore() {
        String result = helper.escapeLikePattern("test_value");
        assertEquals("test\\_value", result);
    }

    @Test
    void escapeLikePatternShouldEscapeBackslash() {
        String result = helper.escapeLikePattern("path\\to\\file");
        assertEquals("path\\\\to\\\\file", result);
    }

    @Test
    void escapeLikePatternShouldEscapeAllSpecialChars() {
        String result = helper.escapeLikePattern("100%_test\\");
        assertEquals("100\\%\\_test\\\\", result);
    }

    @Test
    void escapeLikePatternShouldHandleNormalInput() {
        String result = helper.escapeLikePattern("normal search");
        assertEquals("normal search", result);
    }
}
