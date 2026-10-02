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

package com.ritense.document.domain

/**
 * Upper bound on how deep the everit `Schema` walkers in this package recurse into a schema.
 *
 * A schema can be recursive: a `$ref` may (indirectly) point back at one of its own ancestors. Walking such a
 * schema without a limit keeps recursing until the JVM throws a `StackOverflowError`. This limit is well above
 * the nesting depth of any realistic document schema, so reaching it means the schema is (effectively) cyclic;
 * the walkers then stop descending instead of failing.
 */
internal const val MAX_SCHEMA_DEPTH = 100
