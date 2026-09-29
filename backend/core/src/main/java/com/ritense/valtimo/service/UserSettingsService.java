/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.valtimo.service;

import com.ritense.valtimo.contract.authentication.ManageableUser;
import com.ritense.valtimo.domain.user.UserSettings;
import com.ritense.valtimo.repository.UserSettingsRepository;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;

public class UserSettingsService {

    private static final int SAVE_ATTEMPTS = 3;

    private final UserSettingsRepository userSettingsRepository;

    public UserSettingsService(UserSettingsRepository userSettingsRepository) {
        this.userSettingsRepository = userSettingsRepository;
    }

    public Optional<UserSettings> findUserSettings(ManageableUser user) {
        return userSettingsRepository.findById(user.getUsername());
    }

    public void saveUserSettings(ManageableUser user, Map<String, Object> settings) {
        for (int attempt = 1; attempt <= SAVE_ATTEMPTS; attempt++) {
            try {
                mergeAndSave(user, settings);
                return;
            } catch (DataIntegrityViolationException e) {
                if (attempt == SAVE_ATTEMPTS) {
                    throw e;
                }
            }
        }
    }

    private void mergeAndSave(ManageableUser user, Map<String, Object> settings) {
        Map<String, Object> merged = userSettingsRepository.findById(user.getUsername())
            .map(UserSettings::getSettings)
            .map(HashMap::new)
            .orElseGet(HashMap::new);
        merged.putAll(settings);
        userSettingsRepository.saveAndFlush(new UserSettings(user.getUsername(), merged));
    }
}
