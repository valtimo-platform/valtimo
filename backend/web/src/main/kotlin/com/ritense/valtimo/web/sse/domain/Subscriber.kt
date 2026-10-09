/*
 *  Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 *  Licensed under EUPL, Version 1.2 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" basis,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package com.ritense.valtimo.web.sse.domain

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

class Subscriber(timeout: Long? = null) : SseEmitter(timeout) {

    // SseEmitter.send throws IllegalStateException once completed; track it to tell "gone" from "unsendable"
    @Volatile
    var completed: Boolean = false
        private set

    override fun complete() {
        completed = true
        super.complete()
    }

    override fun completeWithError(ex: Throwable) {
        completed = true
        super.completeWithError(ex)
    }
}
