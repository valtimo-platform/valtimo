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

import {HttpErrorResponse} from '@angular/common/http';

/** `400 BAD_REQUEST "the message"` — what Spring puts in `detail` for a `ResponseStatusException`. */
const RESPONSE_STATUS_WRAPPER = /^\d{3}\s+[A-Z_]+\s+"([\s\S]*)"$/;

/** The server's own sentence, or null when it sent none. Spring wraps a `ResponseStatusException` as `400 BAD_REQUEST "…"`, so the wrapper is unpeeled. */
export const getServerErrorMessage = (error: unknown): string | null => {
  const body = (error as HttpErrorResponse)?.error;
  const raw = body?.detail ?? body?.message ?? (typeof body === 'string' ? body : null);
  if (typeof raw !== 'string' || !raw.trim()) return null;

  const trimmed = raw.trim();

  return (RESPONSE_STATUS_WRAPPER.exec(trimmed)?.[1] ?? trimmed).trim() || null;
};
