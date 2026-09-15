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

/**
 * Raised for a malicious/malformed plugin package — mapped to a 400, not a 500.
 *
 * Lives outside the upload route so the plugin manager can raise it too: a containment refusal
 * deep in the install path is a bad package, not a host failure, and must reach the caller as a
 * 400 with the reason rather than an opaque 500.
 */
export class InvalidPluginPackageError extends Error {}
