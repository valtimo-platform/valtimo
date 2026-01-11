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

package com.ritense.valtimo.settings.service

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.settings.domain.ApplicationSetting
import com.ritense.valtimo.settings.repository.ApplicationSettingRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Transactional
@Service
@SkipComponentScan
class ApplicationSettingService(
    private val applicationSettingRepository: ApplicationSettingRepository
) {

    companion object {
        const val LOGO_KEY = "application.logo"
    }

    @Transactional(readOnly = true)
    fun getLogo(): String? {
        return applicationSettingRepository.findById(LOGO_KEY)
            .map { it.value }
            .orElse(null)
    }

    fun saveLogo(base64Logo: String) {
        val setting = ApplicationSetting(
            key = LOGO_KEY,
            value = base64Logo
        )
        applicationSettingRepository.save(setting)
    }

    fun deleteLogo() {
        applicationSettingRepository.deleteById(LOGO_KEY)
    }
}
