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

package com.ritense.adminsettings.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "admin_settings_logo")
open class AdminSettingsLogo(
    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "logo_type", length = 50, nullable = false)
    open var logoType: LogoType,

    @Column(name = "image_base64", nullable = false, columnDefinition = "TEXT")
    open var imageBase64: String
)

enum class LogoType {
    LOGO,
    LOGO_DARK_MODE
}
