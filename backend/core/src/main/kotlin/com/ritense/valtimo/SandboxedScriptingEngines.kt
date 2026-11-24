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

import org.operaton.bpm.engine.delegate.VariableScope
import org.operaton.bpm.engine.impl.cfg.ProcessEngineConfigurationImpl
import org.operaton.bpm.engine.impl.scripting.engine.ScriptBindingsFactory
import org.operaton.bpm.engine.impl.scripting.engine.ScriptEngineResolver
import org.operaton.bpm.engine.impl.scripting.engine.ScriptingEngines
import javax.script.Bindings
import javax.script.ScriptEngine

/**
 * Builds script bindings from `engine.createBindings()` for every engine, as Operaton did before 1.1.
 *
 * Operaton 1.1 writes process variables straight into a GraalJS engine's own ENGINE_SCOPE bindings. That skips
 * [FilteringScriptBindings] and [GraalJsContextCleanup], and GraalJS reads a variable named `polyglot.js.*` as an
 * engine option.
 *
 * Install with [installBeforeInit] so Operaton wires this one instance into both the script environment and the DMN
 * engine, then [completeAfterInit] once the resolver factories exist.
 */
class SandboxedScriptingEngines(scriptEngineResolver: ScriptEngineResolver) : ScriptingEngines(scriptEngineResolver) {

    override fun createBindings(scriptEngine: ScriptEngine, variableScope: VariableScope): Bindings =
        scriptBindingsFactory.createBindings(variableScope, scriptEngine.createBindings())

    companion object {
        fun installBeforeInit(configuration: ProcessEngineConfigurationImpl) {
            configuration.scriptingEngines = SandboxedScriptingEngines(configuration.scriptEngineResolver)
        }

        fun completeAfterInit(configuration: ProcessEngineConfigurationImpl) {
            val engines = configuration.scriptingEngines
            check(engines is SandboxedScriptingEngines) {
                "Script bindings are not sandboxed: scriptingEngines was replaced by ${engines?.javaClass?.name}"
            }
            engines.scriptBindingsFactory = ScriptBindingsFactory(configuration.resolverFactories)
            engines.isEnableScriptEngineCaching = configuration.isEnableScriptEngineCaching
        }
    }
}
