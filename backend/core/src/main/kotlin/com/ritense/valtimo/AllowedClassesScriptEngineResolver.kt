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

import com.oracle.truffle.js.scriptengine.GraalJSScriptEngine
import org.camunda.bpm.engine.impl.scripting.engine.DefaultScriptEngineResolver
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.HostAccess
import javax.script.ScriptEngine
import javax.script.ScriptEngineManager

class AllowedClassesScriptEngineResolver(
    scriptEngineManager: ScriptEngineManager,
    otherAllowedClasses: Set<String> = emptySet()
) : DefaultScriptEngineResolver(scriptEngineManager) {
    private val effectiveAllowed = (ALLOWED + otherAllowedClasses) - BLOCKED

    override fun getJavaScriptScriptEngine(language: String?): ScriptEngine {
        val hostAccess = HostAccess.newBuilder()
            .allowPublicAccess(true)
            .allowAllImplementations(true)
            .allowAllClassImplementations(true)
            .allowArrayAccess(true)
            .allowListAccess(true)
            .allowMapAccess(true)
            .allowIterableAccess(true)
            .allowIteratorAccess(true)
            .allowAccessAnnotatedBy(HostAccess.Export::class.java)
            .denyAccess(Class::class.java)
            .denyAccess(ClassLoader::class.java)
            .denyAccess(java.lang.reflect.Method::class.java)
            .denyAccess(java.lang.reflect.Constructor::class.java)
            .denyAccess(java.lang.reflect.Field::class.java)
            .denyAccess(java.lang.reflect.Proxy::class.java)
            .denyAccess(java.sql.Connection::class.java)
            .denyAccess(javax.sql.DataSource::class.java)
            .denyAccess(javax.naming.InitialContext::class.java)
            .denyAccess(java.io.File::class.java)
            .denyAccess(java.io.FileInputStream::class.java)
            .denyAccess(java.io.FileOutputStream::class.java)
            .denyAccess(java.io.FileReader::class.java)
            .denyAccess(java.io.FileWriter::class.java)
            .denyAccess(java.net.URL::class.java)
            .denyAccess(java.net.URLConnection::class.java)
            .denyAccess(java.net.Socket::class.java)
            .denyAccess(java.net.ServerSocket::class.java)
            .denyAccess(org.camunda.bpm.engine.ProcessEngine::class.java)
            .denyAccess(org.camunda.bpm.engine.ProcessEngineServices::class.java)
            .denyAccess(org.camunda.bpm.engine.RuntimeService::class.java)
            .denyAccess(org.camunda.bpm.engine.RepositoryService::class.java)
            .denyAccess(org.camunda.bpm.engine.ManagementService::class.java)
            .denyAccess(org.camunda.bpm.engine.IdentityService::class.java)
            .denyAccess(org.camunda.bpm.engine.AuthorizationService::class.java)
            .denyAccess(org.camunda.bpm.engine.impl.cfg.ProcessEngineConfigurationImpl::class.java)
            .build()

        val ctx = Context.newBuilder("js")
            .allowHostAccess(hostAccess)
            .allowHostClassLookup(effectiveAllowed::contains)

        return GraalJSScriptEngine.create(null, ctx)
    }

    companion object {
        private val BLOCKED = setOf(
            "java.lang.Class",
            "java.lang.ClassLoader",
            "java.lang.Runtime",
            "java.lang.ProcessBuilder",
            "java.lang.Process",
            "java.lang.System",
            "java.lang.Thread",
            "java.lang.ThreadGroup",
            "java.lang.reflect.Method",
            "java.lang.reflect.Constructor",
            "java.lang.reflect.Field",
            "java.lang.reflect.Proxy",
            "java.security.AccessController",
            "javax.script.ScriptEngine",
            "javax.script.ScriptEngineManager",
        )

        private val ALLOWED = mutableSetOf<String?>(
            "java.util.ArrayList",
            "org.joda.time.DateTime",
            "java.util.Date",
            "java.lang.Math",
            // Spin is auto-bound by camunda-engine-plugin-spin. mapTo() could be dangerous
            // if camunda-spin-dataformat-json-jackson is on classpath (currently it's not).
            "org.camunda.spin.Spin",
            //java.time classes
            "java.time.Clock",
            "java.time.Duration",
            "java.time.Instant",
            "java.time.LocalDate",
            "java.time.LocalDateTime",
            "java.time.LocalTime",
            "java.time.MonthDay",
            "java.time.OffsetDateTime",
            "java.time.OffsetTime",
            "java.time.Period",
            "java.time.Year",
            "java.time.YearMonth",
            "java.time.ZonedDateTime",
            "java.time.ZoneId",
            "java.time.ZoneOffset",
        )
    }
}