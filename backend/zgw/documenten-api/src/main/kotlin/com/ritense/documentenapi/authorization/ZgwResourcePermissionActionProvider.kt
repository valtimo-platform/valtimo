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

class ZgwResourcePermissionActionProvider : ResourceActionProvider<ZgwResourcePermission> {
    override fun getAvailableActions(): List<Action<ZgwResourcePermission>> {
        return listOf(VIEW, VIEW_LIST, CREATE, MODIFY, DELETE)
    }

    companion object {
        var VIEW = Action<ZgwResourcePermission>(Action.VIEW)
        var VIEW_LIST = Action<ZgwResourcePermission>(Action.VIEW_LIST)
        var CREATE = Action<ZgwResourcePermission>(Action.CREATE)
        var MODIFY = Action<ZgwResourcePermission>(Action.MODIFY)
        var DELETE = Action<ZgwResourcePermission>(Action.DELETE)
    }
}
