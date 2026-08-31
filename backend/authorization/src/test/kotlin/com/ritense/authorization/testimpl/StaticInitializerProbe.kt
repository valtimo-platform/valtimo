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

package com.ritense.authorization.testimpl

/**
 * Holds the flag that [StaticInitializerProbe] sets.
 *
 * Kept on a separate class on purpose. A test has to be able to read the flag without initializing
 * the probe, because initializing the probe is exactly what the test is checking for.
 */
object StaticInitializerProbeFlag {
    @JvmStatic
    @Volatile
    var initialized: Boolean = false
}

/**
 * Stands in for an arbitrary class that happens to be on the classpath and whose static initializer
 * has a side effect.
 *
 * `Class.forName(String)` initializes the class it loads, so a caller supplied class name reaching
 * it runs that class's static initializer. This probe makes that observable through
 * [StaticInitializerProbeFlag], without any of the side effects that make the real thing dangerous.
 *
 * Nothing may reference this class in a way that triggers its initialization, other than by
 * submitting its name to the code under test.
 */
class StaticInitializerProbe private constructor() {
    companion object {
        init {
            StaticInitializerProbeFlag.initialized = true
        }
    }
}
