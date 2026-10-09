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

package com.ritense.dataprovider.defaultdataproviders.providers

import org.springframework.core.io.Resource
import org.springframework.core.io.ResourceLoader
import org.springframework.core.io.support.ResourcePatternUtils
import org.springframework.util.StringUtils

internal fun resolveClasspathJsonResource(resourceLoader: ResourceLoader, baseDir: String, key: String): Resource? {
    val path = StringUtils.cleanPath("$baseDir/$key.json")
    if (!path.startsWith("$baseDir/")) {
        return null
    }
    return ResourcePatternUtils.getResourcePatternResolver(resourceLoader).getResource("classpath:$path")
}
