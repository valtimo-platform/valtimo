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

package com.valtimo.keycloak.service;

import com.ritense.authorization.Action;
import com.ritense.authorization.AuthorizationService;
import com.ritense.authorization.request.EntityAuthorizationRequest;
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants;
import com.ritense.valtimo.contract.authentication.ManageableUser;
import com.ritense.valtimo.contract.authentication.NamedUser;
import com.ritense.valtimo.contract.authentication.User;
import com.ritense.valtimo.contract.authentication.UserManagementService;
import com.ritense.valtimo.contract.authentication.UserNotFoundException;
import com.ritense.valtimo.contract.authentication.model.SearchByUserGroupsCriteria;
import com.ritense.valtimo.contract.authentication.model.ValtimoUser;
import com.ritense.valtimo.contract.authentication.model.ValtimoUserBuilder;
import com.ritense.valtimo.contract.utils.SecurityUtils;
import jakarta.ws.rs.NotFoundException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.apache.commons.lang3.NotImplementedException;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.RoleResource;
import org.keycloak.representations.idm.GroupRepresentation;
import org.keycloak.representations.idm.RoleRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import static java.util.Comparator.comparing;
import static java.util.Comparator.naturalOrder;
import static java.util.Comparator.nullsLast;

import static com.ritense.authorization.AuthorizationContext.runWithoutAuthorization;
import static com.ritense.valtimo.contract.Constants.SYSTEM_ACCOUNT;
import static com.valtimo.keycloak.authorization.UserActionProvider.VIEW;
import static com.valtimo.keycloak.authorization.UserActionProvider.VIEW_LIST;

public class KeycloakUserManagementService implements UserManagementService {
    private static final Logger logger = LoggerFactory.getLogger(KeycloakUserManagementService.class);
    protected static final int MAX_USERS = 100000;
    private static final String MAX_USERS_WARNING_MESSAGE = "Maximum number of users retrieved from keycloak: " + MAX_USERS + ".";
    private static final ValtimoUser SYSTEM_VALTIMO_USER = new ValtimoUserBuilder().id(SYSTEM_ACCOUNT).lastName(SYSTEM_ACCOUNT).build();

    private final KeycloakService keycloakService;
    private final String clientName;
    private final UserCache userCache;
    private final AuthorizationService authorizationService;

    public KeycloakUserManagementService(
        KeycloakService keycloakService,
        String keycloakClientName,
        UserCache userCache,
        AuthorizationService authorizationService
    ) {
        this.keycloakService = keycloakService;
        this.clientName = keycloakClientName;
        this.userCache = userCache;
        this.authorizationService = authorizationService;
    }

    @Override
    public ManageableUser createUser(ManageableUser user) {
        throw new NotImplementedException();
    }

    @Override
    public ManageableUser updateUser(ManageableUser updatedUserData) throws UserNotFoundException {
        throw new NotImplementedException();
    }

    @Override
    public void deleteUser(String userId) {
        throw new NotImplementedException();
    }

    @Override
    public boolean resendVerificationEmail(String userId) {
        throw new NotImplementedException();
    }

    @Override
    public void activateUser(String userId) {
        throw new NotImplementedException();
    }

    @Override
    public void deactivateUser(String userId) {
        throw new NotImplementedException();
    }

    @Override
    public List<ManageableUser> getAllUsers() {
        List<ManageableUser> users;
        try (Keycloak keycloak = keycloakService.keycloak()) {
            users = keycloakService.usersResource(keycloak).search(null, 0, MAX_USERS, true).stream()
                .filter(UserRepresentation::isEnabled)
                .map(user -> (ManageableUser) toValtimoUserByRetrievingRolesWithoutAuthorization(user))
                .filter(this::hasUserViewListPermission)
                .toList();
        }

        if (users.size() >= MAX_USERS) {
            logger.warn(MAX_USERS_WARNING_MESSAGE);
        }

        return users;
    }

    @Override
    public Page<ManageableUser> getAllUsers(Pageable pageable) {
        List<ManageableUser> users = getAllUsers();
        return PageableExecutionUtils.getPage(users, pageable, users::size);
    }

    @Override
    public Page<ManageableUser> queryUsers(String searchTerm, Pageable pageable) {
        List<ManageableUser> users;
        try (Keycloak keycloak = keycloakService.keycloak()) {
            users = keycloakService.usersResource(keycloak).search(searchTerm, 0, MAX_USERS, true).stream()
                .filter(UserRepresentation::isEnabled)
                .map(user -> (ManageableUser) toValtimoUserByRetrievingRolesWithoutAuthorization(user))
                .filter(this::hasUserViewListPermission)
                .toList();
        }

        if (users.size() >= MAX_USERS) {
            logger.warn(MAX_USERS_WARNING_MESSAGE);
        }
        return PageableExecutionUtils.getPage(users, pageable, users::size);
    }

    @Override
    public Optional<ManageableUser> findByEmail(String email) {
        return Optional.ofNullable(
            userCache.get(
                CacheType.EMAIL,
                email,
                (emailToRetrieve) -> findUserRepresentationByEmail(emailToRetrieve).map(this::toValtimoUserByRetrievingRoles).orElse(null)
            )
        );
    }

    @Override
    public ValtimoUser findByUsername(String username) {
        ValtimoUser valtimoUser = userCache.get(
            CacheType.USERNAME,
            username,
            (identifier) -> {
                UserRepresentation user = null;
                try (Keycloak keycloak = keycloakService.keycloak()) {
                    var users = keycloakService.usersResource(keycloak).searchByUsername(username, true);
                    if (!users.isEmpty()) {
                        user = users.get(0);
                    }
                }
                Boolean isUserEnabled = user != null ? user.isEnabled() : null;
                return Boolean.TRUE.equals(isUserEnabled) ? toValtimoUserByRetrievingRolesWithoutAuthorization(user) : null;
            }
        );
        requireUserPermission(VIEW, valtimoUser);
        return valtimoUser;
    }

    @Override
    public ValtimoUser findById(String userId) {
        UserRepresentation user;
        if (userId.equals(SYSTEM_ACCOUNT)) {
            requireUserPermission(VIEW, SYSTEM_VALTIMO_USER);
            return SYSTEM_VALTIMO_USER;
        } else {
            try (Keycloak keycloak = keycloakService.keycloak()) {
                user = keycloakService.usersResource(keycloak).get(userId).toRepresentation();
            }
            ValtimoUser valtimoUser = Boolean.TRUE.equals(user.isEnabled()) ? toValtimoUserByRetrievingRolesWithoutAuthorization(user) : null;
            requireUserPermission(VIEW, valtimoUser);
            return valtimoUser;
        }
    }

    @Override
    public List<ManageableUser> findByRole(String authority) {
        return findUserRepresentationByRoleWithoutAuthorization(authority).stream()
            .filter(user -> hasUserViewListPermission(user, List.of(authority))) // <- uses an incomplete list of roles
            .map(user -> (ManageableUser) toValtimoUserByRetrievingRolesWithoutAuthorization(user)) // <- does an additional call to retrieve the roles
            .filter(this::hasUserViewListPermission)
            .toList();
    }

    @Override
    public List<ManageableUser> findByRoles(SearchByUserGroupsCriteria groupsCriteria) {
        Set<String> allUserGroups = new HashSet<>(groupsCriteria.getRequiredUserGroups());
        groupsCriteria.getOrUserGroups().forEach(allUserGroups::addAll);

        List<ManageableUser> allUsers = allUserGroups.stream()
            .map(this::findByRole)
            .flatMap(Collection::stream)
            .distinct()
            .toList();

        return allUsers.stream()
            .filter(user -> new HashSet<>(user.getRoles()).containsAll(groupsCriteria.getRequiredUserGroups()))
            .filter(user -> groupsCriteria.getOrUserGroups().stream()
                .map(userGroups -> user.getRoles().stream().anyMatch(userGroups::contains))
                .reduce(true, (orUserGroup1, orUserGroup2) -> orUserGroup1 && orUserGroup2))
            .sorted(comparing(ManageableUser::getFullName, nullsLast(naturalOrder())))
            .filter(this::hasUserViewListPermission)
            .toList();
    }

    @Override
    public List<NamedUser> findNamedUserByRolesWithoutAuthorization(Set<String> roles) {
        return roles.stream()
            .map(this::findUserRepresentationByRoleWithoutAuthorization)
            .flatMap(Collection::stream)
            .map(this::toNamedUser)
            .distinct()
            .sorted(comparing(NamedUser::getLabel))
            .toList();
    }

    @Override
    public ManageableUser getCurrentUser() {
        if (SecurityUtils.getCurrentUserAuthentication() == null) {
            return SYSTEM_VALTIMO_USER;
        } else if (SecurityUtils.getCurrentUserAuthentication() instanceof AnonymousAuthenticationToken) {
            return null;
        } else {
            return runWithoutAuthorization(() -> findByEmail(SecurityUtils.getCurrentUserLogin()).orElseThrow(() ->
                new IllegalStateException("No user found for email: ${currentUserService.currentUser.email}")
            ));
        }
    }

    @Override
    public String getCurrentUserId() {
        if (SecurityUtils.getCurrentUserAuthentication() != null) {
            return runWithoutAuthorization(() -> findUserRepresentationByEmail(SecurityUtils.getCurrentUserLogin()).orElseThrow(() ->
                new IllegalStateException("No user found for email: " + SecurityUtils.getCurrentUserLogin())
            ).getId());
        } else {
            return SYSTEM_ACCOUNT;
        }
    }

    private Optional<UserRepresentation> findUserRepresentationByEmail(String email) {
        if (email == null || !email.contains("@")) {
            return Optional.empty();
        }
        List<UserRepresentation> userList;
        try (Keycloak keycloak = keycloakService.keycloak()) {
            userList = keycloakService
                .usersResource(keycloak)
                .searchByEmail(email, true);
        }
        if (userList.isEmpty() || !Objects.equals(userList.get(0).getEmail(), email)) {
            return Optional.empty();
        } else {
            UserRepresentation user = userList.get(0);
            requireUserPermission(VIEW, user);
            return Optional.of(user);
        }
    }

    private List<UserRepresentation> findUserRepresentationByRoleWithoutAuthorization(String authority) {

        List<List<UserRepresentation>> usersList = new ArrayList<>();
        try (Keycloak keycloak = keycloakService.keycloak()) {
            Set<GroupRepresentation> roleGroups = new HashSet<>();
            try {
                RoleResource roleResource = keycloakService.realmRolesResource(keycloak).get(authority);
                usersList.add(roleResource.getUserMembers(0, MAX_USERS));
                roleGroups.addAll(roleResource.getRoleGroupMembers());
            } catch (NotFoundException e) {
                logger.debug("Failed to find users by realm. Error: {}", e.getMessage());
            }
            if (!clientName.isBlank()) {
                try {
                    RoleResource roleResource = keycloakService.clientRolesResource(keycloak).get(authority);
                    usersList.add(roleResource.getUserMembers(0, MAX_USERS));
                    roleGroups.addAll(roleResource.getRoleGroupMembers());
                } catch (NotFoundException e) {
                    logger.debug("Failed to find users by client. Error: {}", e.getMessage());
                }
            }
            try {
                for (GroupRepresentation group : roleGroups) {
                    usersList.add(keycloakService.realmResource(keycloak)
                        .groups()
                        .group(group.getId())
                        .members(0, MAX_USERS));
                }
            } catch (NotFoundException e) {
                logger.debug("Failed to find users by group. Error: {}", e.getMessage());
            }
        }

        usersList.forEach(users -> {
            if (users.size() >= MAX_USERS) {
                logger.warn(MAX_USERS_WARNING_MESSAGE);
            }
        });

        var users = usersList.stream()
            .flatMap(Collection::stream)
            .filter(UserRepresentation::isEnabled)
            .map(UserRepresentationWrapper::new)
            .distinct()
            .map(UserRepresentationWrapper::userRepresentation)
            .toList();

        if (users.isEmpty()) {
            logger.error("No active users found with role {}", authority);
        }

        return users;
    }

    private ValtimoUser toValtimoUserByRetrievingRoles(UserRepresentation userRepresentation) {
        ValtimoUser user = toValtimoUserByRetrievingRolesWithoutAuthorization(userRepresentation);
        requireUserPermission(VIEW, user);
        return user;
    }

    private ValtimoUser toValtimoUserByRetrievingRolesWithoutAuthorization(UserRepresentation userRepresentation) {
        return userCache.get(
            CacheType.USERNAME,
            userRepresentation.getUsername(),
            (username) -> new ValtimoUserBuilder()
                .id(userRepresentation.getId())
                .username(userRepresentation.getUsername())
                .firstName(userRepresentation.getFirstName())
                .lastName(userRepresentation.getLastName())
                .email(userRepresentation.getEmail())
                .roles(getRolesAsStringFromUser(userRepresentation)) // <- does an additional call to retrieve the roles
                .build()
        );
    }

    private NamedUser toNamedUser(UserRepresentation userRepresentation) {
        return new NamedUser(
            userRepresentation.getId(),
            userRepresentation.getEmail(),
            userRepresentation.getFirstName(),
            userRepresentation.getLastName(),
            userRepresentation.getUsername()
        );
    }

    private List<String> getRolesAsStringFromUser(UserRepresentation userRepresentation) {
        var roles = new ArrayList<String>();
        if (userRepresentation.getRealmRoles() != null) {
            roles.addAll(userRepresentation.getRealmRoles());
        }
        if (userRepresentation.getClientRoles() != null) {
            roles.addAll(userRepresentation.getClientRoles().values().stream().flatMap(Collection::stream).toList());
        }
        if (!roles.isEmpty()) {
            return roles;
        }
        return getRolesFromUser(userRepresentation)
            .stream()
            .map(RoleRepresentation::getName)
            .toList();
    }

    private List<RoleRepresentation> getRolesFromUser(UserRepresentation userRepresentation) {
        try (Keycloak keycloak = keycloakService.keycloak()) {
            var realmRoles = keycloakService
                .usersResource(keycloak)
                .get(userRepresentation.getId())
                .roles().realmLevel().listEffective(true);
            var roles = new ArrayList<>(realmRoles);
            if (!clientName.isBlank()) {
                var clientRoles = keycloakService
                    .usersResource(keycloak)
                    .get(userRepresentation.getId())
                    .roles().clientLevel(keycloakService.getClientId(keycloak)).listEffective(true);
                roles.addAll(clientRoles);
            }
            return roles;
        }
    }

    private void requireUserPermission(Action<User> action, UserRepresentation user) {
        requireUserPermission(action, toValtimoUserByRetrievingRolesWithoutAuthorization(user));
    }

    private void requireUserPermission(Action<User> action, User... users) {
        if (!isAdmin()) {
            List<User> userList = Arrays.stream(users).filter(Objects::nonNull).toList();
            if (userList.isEmpty()) {
                return;
            }
            authorizationService.requirePermission(
                new EntityAuthorizationRequest<>(
                    User.class,
                    action,
                    userList
                )
            );
        }
    }

    private boolean hasUserViewListPermission(UserRepresentation userRepresentation) {
        return hasUserViewListPermission(toValtimoUserByRetrievingRolesWithoutAuthorization(userRepresentation));
    }

    private boolean hasUserViewListPermission(User user) {
        if (isAdmin()) {
            return true;
        }
        return authorizationService.hasPermission(
            new EntityAuthorizationRequest<>(
                User.class,
                VIEW_LIST,
                user
            )
        );
    }

    private boolean hasUserViewListPermission(UserRepresentation userRepresentation, List<String> roles) {
        if (isAdmin()) {
            return true;
        }
        return authorizationService.hasPermission(
            new EntityAuthorizationRequest<>(
                User.class,
                VIEW_LIST,
                new ValtimoUserBuilder()
                    .id(userRepresentation.getId())
                    .username(userRepresentation.getUsername())
                    .firstName(userRepresentation.getFirstName())
                    .lastName(userRepresentation.getLastName())
                    .email(userRepresentation.getEmail())
                    .roles(roles)
                    .build()
            )
        );
    }

    /**
     * TODO: remove in next major release
     * */
    private boolean isAdmin() {
        return SecurityUtils.isCurrentUserInRole(AuthoritiesConstants.ADMIN);
    }

    private record UserRepresentationWrapper(UserRepresentation userRepresentation) {

        String getId() {
            return userRepresentation.getId();
        }

        String getUsername() {
            return userRepresentation.getUsername();
        }

        String getEmail() {
            return userRepresentation.getEmail();
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (o == null || getClass() != o.getClass()) {
                return false;
            }
            UserRepresentationWrapper that = (UserRepresentationWrapper) o;
            return Objects.equals(getId(), that.getId())
                && Objects.equals(getUsername(), that.getUsername())
                && Objects.equals(getEmail(), that.getEmail());
        }

        @Override
        public int hashCode() {
            return Objects.hash(getId(), getUsername(), getEmail());
        }
    }
}
