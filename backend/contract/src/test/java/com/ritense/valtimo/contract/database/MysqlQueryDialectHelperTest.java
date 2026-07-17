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

import java.lang.reflect.Method;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MysqlQueryDialectHelperTest {

    private MysqlQueryDialectHelper helper;
    private Method escapeLikePatternMethod;

    @BeforeEach
    void setUp() throws Exception {
        helper = new MysqlQueryDialectHelper();
        escapeLikePatternMethod = MysqlQueryDialectHelper.class.getDeclaredMethod("escapeLikePattern", String.class);
        escapeLikePatternMethod.setAccessible(true);
    }

    @Test
    void escapeLikePatternShouldEscapePercent() throws Exception {
        String result = (String) escapeLikePatternMethod.invoke(helper, "100%");
        assertEquals("100\\%", result);
    }

    @Test
    void escapeLikePatternShouldEscapeUnderscore() throws Exception {
        String result = (String) escapeLikePatternMethod.invoke(helper, "test_value");
        assertEquals("test\\_value", result);
    }

    @Test
    void escapeLikePatternShouldEscapeBackslash() throws Exception {
        String result = (String) escapeLikePatternMethod.invoke(helper, "path\\to\\file");
        assertEquals("path\\\\to\\\\file", result);
    }

    @Test
    void escapeLikePatternShouldEscapeAllSpecialChars() throws Exception {
        String result = (String) escapeLikePatternMethod.invoke(helper, "100%_test\\");
        assertEquals("100\\%\\_test\\\\", result);
    }

    @Test
    void escapeLikePatternShouldHandleNormalInput() throws Exception {
        String result = (String) escapeLikePatternMethod.invoke(helper, "normal search");
        assertEquals("normal search", result);
    }
}
