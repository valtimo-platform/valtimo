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

package com.ritense.zakenapi.formflow

import com.ritense.formflow.expression.FormFlowBean
import com.ritense.zakenapi.domain.ZaakResponse
import com.ritense.zakenapi.exception.ZaakNotFoundException
import com.ritense.zakenapi.service.ZaakService
import java.util.UUID

@FormFlowBean
open class ZakenFormFlow(
    private val zaakService: ZaakService
) {

    fun getZaak(zaakIdentificatie: String): ZaakResponse? = getZaak(zaakIdentificatie, null)

    fun getZaak(zaakIdentificatie: String, zakenApiPluginId: UUID?): ZaakResponse? {
        return try {
            zaakService.getZaakByIdentificatie(zaakIdentificatie, zakenApiPluginId)
        } catch (_: ZaakNotFoundException) {
            null
        }
    }
}
