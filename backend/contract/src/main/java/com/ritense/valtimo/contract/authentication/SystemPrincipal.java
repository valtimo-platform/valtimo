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

package com.ritense.valtimo.contract.authentication;

/**
 * Marker for a Spring Security principal that represents a non-human / system actor rather than a
 * Keycloak user — for example an external plugin authenticated by a service token. Such a caller is
 * authenticated (so it satisfies {@code .authenticated()} security rules) but has no user account,
 * so {@link UserManagementService#getCurrentUser()} resolves it to the system user instead of
 * attempting a user lookup that would fail.
 */
public interface SystemPrincipal {
}
