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

package com.ritense.valtimo.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ritense.valtimo.contract.authentication.model.ValtimoUser;
import com.ritense.valtimo.domain.user.UserSettings;
import com.ritense.valtimo.repository.UserSettingsRepository;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;

class UserSettingsServiceTest {

    private UserSettingsRepository userSettingsRepository;
    private UserSettingsService userSettingsService;
    private ValtimoUser user;

    @BeforeEach
    void setUp() {
        userSettingsRepository = mock(UserSettingsRepository.class);
        userSettingsService = new UserSettingsService(userSettingsRepository);
        user = new ValtimoUser();
        user.setUsername("example");
    }

    @Test
    void shouldMergeOntoTheRowInsertedByAConcurrentSave() {
        // First read sees no row, so the save is an insert the concurrent writer wins
        when(userSettingsRepository.findById("example"))
            .thenReturn(Optional.empty())
            .thenReturn(Optional.of(new UserSettings("example", Map.of("languageCode", "nl"))));
        when(userSettingsRepository.saveAndFlush(any()))
            .thenThrow(new DataIntegrityViolationException("duplicate key"))
            .thenReturn(null);

        userSettingsService.saveUserSettings(user, Map.of("preferredTheme", "white"));

        ArgumentCaptor<UserSettings> saved = ArgumentCaptor.forClass(UserSettings.class);
        verify(userSettingsRepository, times(2)).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getSettings())
            .containsEntry("languageCode", "nl")
            .containsEntry("preferredTheme", "white");
    }

    @Test
    void shouldNotRetryWhenTheFirstSaveSucceeds() {
        when(userSettingsRepository.findById("example")).thenReturn(Optional.empty());
        when(userSettingsRepository.saveAndFlush(any())).thenReturn(null);

        userSettingsService.saveUserSettings(user, Map.of("languageCode", "en"));

        verify(userSettingsRepository, times(1)).saveAndFlush(any());
    }

    @Test
    void shouldGiveUpWhenTheConflictKeepsRepeating() {
        when(userSettingsRepository.findById("example")).thenReturn(Optional.empty());
        when(userSettingsRepository.saveAndFlush(any()))
            .thenThrow(new DataIntegrityViolationException("duplicate key"));

        assertThrows(
            DataIntegrityViolationException.class,
            () -> userSettingsService.saveUserSettings(user, Map.of("languageCode", "en"))
        );

        verify(userSettingsRepository, times(3)).saveAndFlush(any());
    }
}
