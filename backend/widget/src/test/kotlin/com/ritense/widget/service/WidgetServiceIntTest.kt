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

package com.ritense.widget.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.valtimo.contract.conditions.Condition
import com.ritense.valtimo.contract.repository.ExpressionOperator
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.DOCUMENT_ID
import com.ritense.widget.BaseIntegrationTest
import com.ritense.widget.domain.Widget
import com.ritense.widget.fields.FieldsWidget
import com.ritense.widget.fields.FieldsWidgetProperties
import java.util.UUID
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import kotlin.test.assertEquals

@Transactional
class WidgetServiceIntTest @Autowired constructor(
    private val widgetService: WidgetService,
) : BaseIntegrationTest() {

    lateinit var widgets: List<Widget>

    @BeforeEach
    fun setup() {
        runWithoutAuthorization {
            widgets = listOf(
                widgetService.create(
                    FieldsWidget(
                        key = "firstName",
                        title = "First name",
                        order = 1,
                        width = 1,
                        highContrast = false,
                        displayConditions = listOf(
                            Condition(
                                path = "static",
                                operator = ExpressionOperator.EQUAL_TO,
                                value = "static"
                            )
                        ),
                        properties = FieldsWidgetProperties(emptyList())
                    )
                ),
                widgetService.create(
                    FieldsWidget(
                        key = "bsn",
                        title = "BSN",
                        order = 2,
                        width = 2,
                        highContrast = true,
                        displayConditions = listOf(
                            Condition(
                                path = "static",
                                operator = ExpressionOperator.EQUAL_TO,
                                value = "dynamic"
                            )
                        ),
                        properties = FieldsWidgetProperties(emptyList())
                    )
                )
            )
        }
    }

    @Test
    fun `should filter widgets`(): Unit = runWithoutAuthorization {
        val widgets = widgetService.filterWidgetsOnDisplayConditions(
            widgets, mapOf(DOCUMENT_ID to UUID.randomUUID())
        )

        assertEquals(1, widgets.size)
        assertEquals("firstName", widgets[0].key)
    }

}
