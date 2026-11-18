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

package com.ritense.document.opensearch.service

import org.springframework.dao.DataAccessResourceFailureException
import java.io.IOException

/** Whether OpenSearch could not be reached, as opposed to OpenSearch refusing the request. */
fun isTransportFailure(e: Throwable): Boolean =
    generateSequence(e) { it.cause }.any { it is DataAccessResourceFailureException || it is IOException }
