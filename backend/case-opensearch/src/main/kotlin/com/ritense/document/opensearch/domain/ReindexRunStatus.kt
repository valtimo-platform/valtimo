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

package com.ritense.document.opensearch.domain

enum class ReindexRunStatus {
    /** The run is currently in progress (or was, for a row left behind by a crashed instance). */
    RUNNING,

    /** The run finished and indexed all documents in scope. */
    COMPLETED,

    /** The run aborted with an error; resumable from [OpenSearchReindexRun.lastId]. */
    FAILED,

    /** The run was cancelled (e.g. graceful shutdown); resumable from [OpenSearchReindexRun.lastId]. */
    STOPPED,
}
