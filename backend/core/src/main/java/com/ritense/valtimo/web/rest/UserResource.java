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

package com.ritense.valtimo.web.rest;

import jakarta.validation.Valid;
import static com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ritense.valtimo.contract.annotation.SkipComponentScan;
import com.ritense.valtimo.contract.authentication.ManageableUser;
import com.ritense.valtimo.contract.authentication.UserManagementService;
import com.ritense.valtimo.contract.authentication.model.ValtimoUser;
import com.ritense.valtimo.contract.endpoint.EndpointDescription;
import com.ritense.valtimo.service.UserSettingsService;
import com.ritense.valtimo.web.rest.dto.UserTeamDto;
import com.ritense.valtimo.web.rest.util.HeaderUtil;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriUtils;

@RestController
@SkipComponentScan
@RequestMapping(value = "/api", produces = APPLICATION_JSON_UTF8_VALUE)
public class UserResource {

    private static final Logger logger = LoggerFactory.getLogger(UserResource.class);
    private final UserManagementService userManagementService;
    private final UserSettingsService userSettingsService;
    private final ObjectMapper objectMapper;

    public UserResource(
        UserManagementService userManagementService,
        UserSettingsService userSettingsService,
        ObjectMapper objectMapper
    ) {
        this.userManagementService = userManagementService;
        this.userSettingsService = userSettingsService;
        this.objectMapper = objectMapper;
    }

    @EndpointDescription(
        en = "Create a user",
        nl = "Gebruiker aanmaken"
    )
    @Deprecated(since = "Since 13.20.0", forRemoval = true)
    @PostMapping("/v1/users")
    public ResponseEntity<ManageableUser> createUser(@Valid @RequestBody ValtimoUser valtimoUser) throws URISyntaxException {
        logger.debug("Request to save ValtimoUser : {}", valtimoUser);
        final ManageableUser user = userManagementService.createUser(valtimoUser);
        final URI uri = new URI("/api/v1/users/" + UriUtils.encode(user.getId(), StandardCharsets.UTF_8));
        final HttpHeaders headers = HeaderUtil.createAlert("userManagement.created", user.getEmail());
        return ResponseEntity.created(uri).headers(headers).body(user);
    }

    @EndpointDescription(
        en = "Update a user",
        nl = "Gebruiker bijwerken"
    )
    @Deprecated(since = "Since 13.20.0", forRemoval = true)
    @PutMapping("/v1/users")
    public ResponseEntity<ManageableUser> updateUser(@Valid @RequestBody ValtimoUser valtimoUser) {
        logger.debug("Request to update ValtimoUser : {}", valtimoUser);
        final ManageableUser user = userManagementService.updateUser(valtimoUser);
        final HttpHeaders headers = HeaderUtil.createAlert("userManagement.updated", user.getEmail());
        return ResponseEntity.ok().headers(headers).body(user);
    }

    @EndpointDescription(
        en = "Activate a user",
        nl = "Gebruiker activeren"
    )
    @Deprecated(since = "Since 13.20.0", forRemoval = true)
    @PutMapping("/v1/users/{userId}/activate")
    public ResponseEntity<Void> activateUser(@PathVariable String userId) {
        logger.debug("Request to activate userId : {}", userId);
        userManagementService.activateUser(userId);
        final HttpHeaders headers = HeaderUtil.createAlert("userManagement.activated", userId);
        return ResponseEntity.ok().headers(headers).build();
    }

    @EndpointDescription(
        en = "Deactivate a user",
        nl = "Gebruiker deactiveren"
    )
    @Deprecated(since = "Since 13.20.0", forRemoval = true)
    @PutMapping("/v1/users/{userId}/deactivate")
    public ResponseEntity<Void> deactivateUser(@PathVariable String userId) {
        logger.debug("Request to deactivate user : {}", userId);
        userManagementService.deactivateUser(userId);
        final HttpHeaders headers = HeaderUtil.createAlert("userManagement.deactivated", userId);
        return ResponseEntity.ok().headers(headers).build();
    }

    @EndpointDescription(
        en = "List all users",
        nl = "Alle gebruikers ophalen"
    )
    @GetMapping("/v1/users")
    public ResponseEntity<Page<ManageableUser>> getAllUsers(Pageable pageable) throws URISyntaxException {
        final Page<ManageableUser> page = userManagementService.getAllUsers(pageable);
        return ResponseEntity.ok(page);
    }

    @EndpointDescription(
        en = "Search users by search term",
        nl = "Gebruikers op zoekterm zoeken"
    )
    @GetMapping(value = "/v1/users", params = {"searchTerm"})
    public ResponseEntity<Page<ManageableUser>> queryUsers(@RequestParam("searchTerm") String searchTerm, Pageable pageable) {
        final Page<ManageableUser> page = userManagementService.queryUsers(searchTerm, pageable);
        return ResponseEntity.ok(page);
    }

    @EndpointDescription(
        en = "Get a user by email",
        nl = "Gebruiker op e-mailadres ophalen"
    )
    @GetMapping("/v1/users/email/{email}/")
    public ResponseEntity<ManageableUser> getUserByEmail(@PathVariable String email) {
        logger.debug("Request to get user by email : {}", email);
        return userManagementService.findByEmail(email)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @EndpointDescription(
        en = "Get a user by id",
        nl = "Gebruiker op id ophalen"
    )
    @GetMapping("/v1/users/{userId}")
    public ResponseEntity<ManageableUser> getUser(@PathVariable String userId) {
        logger.debug("Request to get user by id : {}", userId);
        final ManageableUser manageableUser = userManagementService.findByUsername(userId);
        return ResponseEntity.ok(manageableUser);
    }

    @EndpointDescription(
        en = "List users by role",
        nl = "Gebruikers op rol ophalen"
    )
    @GetMapping("/v1/users/authority/{authority}")
    public ResponseEntity<List<ManageableUser>> getAllUsersByRole(@PathVariable String authority) {
        logger.debug("Request to get users by role : {}", authority);
        final List<ManageableUser> usersWithRole = userManagementService.findByRole(authority);
        return ResponseEntity.ok(usersWithRole);
    }

    @EndpointDescription(
        en = "Delete a user",
        nl = "Gebruiker verwijderen"
    )
    @Deprecated(since = "Since 13.20.0", forRemoval = true)
    @DeleteMapping("/v1/users/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable String userId) {
        logger.debug("Request to delete user : {}", userId);
        userManagementService.deleteUser(userId);
        final HttpHeaders headers = HeaderUtil.createAlert("userManagement.deleted", userId);
        return ResponseEntity.ok().headers(headers).build();
    }

    @EndpointDescription(
        en = "Resend the verification email to a user",
        nl = "Verificatie-e-mail opnieuw naar een gebruiker sturen"
    )
    @PostMapping("/v1/users/send-verification-email/{userId}")
    public ResponseEntity<Void> resendVerificationEmail(@PathVariable String userId) {
        logger.debug("Request to resend verification email to user : {}", userId);
        boolean success = userManagementService.resendVerificationEmail(userId);
        return success ? ResponseEntity.ok().build() : ResponseEntity.badRequest().build();
    }

    @EndpointDescription(
        en = "Get current user settings",
        nl = "Instellingen van huidige gebruiker ophalen"
    )
    @GetMapping("/v1/user/settings")
    public ResponseEntity<String> getCurrentUserSettings() throws JsonProcessingException {
        logger.debug("Request to get current user settings");
        var result = userSettingsService.findUserSettings(userManagementService.getCurrentUser());
        Map<String, Object> settings = Map.of();
        if (result.isPresent()) {
            settings = result.get().getSettings();
        }

        return ResponseEntity.ok(objectMapper.writeValueAsString(settings));
    }

    @EndpointDescription(
        en = "Save current user settings",
        nl = "Instellingen van huidige gebruiker opslaan"
    )
    @PutMapping("/v1/user/settings")
    public ResponseEntity<Object> saveCurrentUserSettings(@RequestBody String settings) {
        logger.debug("Request to create settings for current user");
        try {
            Map<String, Object> settingsMap = objectMapper.readValue(settings, new TypeReference<>() {
            });
            userSettingsService.saveUserSettings(userManagementService.getCurrentUser(), settingsMap);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok().build();
    }

    @EndpointDescription(
        en = "Get current user teams",
        nl = "Teams van huidige gebruiker ophalen"
    )
    @GetMapping("/v1/user/team")
    public ResponseEntity<List<UserTeamDto>> getCurrentUserTeams() {
        List<UserTeamDto> teams = userManagementService.getCurrentUserTeams().stream()
            .map(UserTeamDto::new)
            .toList();
        return ResponseEntity.ok(teams);
    }
}
