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


package com.ritense.valtimo

import mu.KotlinLogging
import java.util.concurrent.atomic.AtomicBoolean
import javax.script.ScriptEngine
import javax.script.SimpleBindings

internal object ScriptSandboxSelfCheck {
    private val logger = KotlinLogging.logger {}

    private val reported = AtomicBoolean(false)

    private const val CANARY = "typeof engine + ',' + typeof context + ',' + typeof globalThis['polyglot.context']"

    private const val EXPECTED = "undefined,undefined,undefined"

    fun run(engine: ScriptEngine): Boolean {
        val passed = try {
            engine.eval(CANARY, SimpleBindings()) == EXPECTED
        } catch (e: Exception) {
            logger.debug(e) { "Script sandbox self-check could not be evaluated" }
            false
        }
        if (!passed) FilteringScriptBindings.reportInactive(reported)
        return passed
    }
}
