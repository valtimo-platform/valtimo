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

package com.ritense.documentenapi.authorization

import com.ritense.authorization.Action
import com.ritense.authorization.ResourceActionProvider

class ZgwDocumentActionProvider : ResourceActionProvider<ZgwDocument> {
    override fun getAvailableActions(): List<Action<ZgwDocument>> {
        return listOf(VIEW, VIEW_LIST, CREATE, MODIFY, DELETE)
    }

    companion object {
        val VIEW = Action<ZgwDocument>(Action.VIEW)
        val VIEW_LIST = Action<ZgwDocument>(Action.VIEW_LIST)
        val CREATE = Action<ZgwDocument>(Action.CREATE)
        val MODIFY = Action<ZgwDocument>(Action.MODIFY)
        val DELETE = Action<ZgwDocument>(Action.DELETE)
    }
}
