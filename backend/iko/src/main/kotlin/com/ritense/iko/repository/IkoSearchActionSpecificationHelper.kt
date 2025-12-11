/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.iko.repository

import com.ritense.iko.domain.IkoSearchAction
import com.ritense.iko.domain.IkoSearchActionId
import org.springframework.data.jpa.domain.Specification

class IkoSearchActionSpecificationHelper {

    companion object {

        const val ID: String = "id"
        const val KEY: String = "key"
        const val IKO_VIEW: String = "ikoView"
        const val TITLE: String = "title"

        @JvmStatic
        fun query() = Specification<IkoSearchAction> { _, _, cb ->
            cb.conjunction()
        }

        @JvmStatic
        fun byKey(key: String) = Specification<IkoSearchAction> { root, _, cb ->
            cb.equal(root.get<IkoSearchActionId>(ID).get<String>(KEY), key)
        }

        @JvmStatic
        fun byIkoViewKey(ikoViewKey: String) = Specification<IkoSearchAction> { root, _, cb ->
            cb.equal(
                root.get<IkoSearchActionId>(ID).get<String>(IKO_VIEW).get<String>(KEY),
                ikoViewKey
            )
        }

        @JvmStatic
        fun byTitleContains(titlePart: String) = Specification<IkoSearchAction> { root, _, cb ->
            cb.like(root[TITLE], "%$titlePart%")
        }
    }
}
