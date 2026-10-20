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

import {existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync} from 'fs';

const LOCK_PATH = 'playwright/.auth/run.lock';

interface RunLock {
  pid: number;
  startedAt: string;
}

function readLock(): RunLock | null {
  try {
    return JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as RunLock;
  } catch {
    return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    // Signal 0 tests for existence without touching the process.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Claim this checkout for one run.
 *
 * Every run shares `playwright/.auth/`, and teardown deletes the token and UI state files by
 * name. A second run therefore pulls the auth state out from under the first, which surfaces far
 * later as a wall of `ENOENT: playwright/.auth/uiState.json` failures that look like product
 * breakage. Fail here instead, while the cause is still obvious.
 */
export function acquireRunLock(): void {
  mkdirSync('playwright/.auth', {recursive: true});

  const existing = readLock();
  if (existing && isAlive(existing.pid)) {
    throw new Error(
      `[GLOBAL SETUP] Another Playwright run (pid ${existing.pid}, started ${existing.startedAt}) ` +
        'is already using this checkout. Both runs share playwright/.auth, so the one that ' +
        "finishes first deletes the other's login. Wait for it, or run from a separate checkout."
    );
  }

  if (existing) {
    console.log(`[GLOBAL SETUP] Clearing the lock of a run that died (pid ${existing.pid})`);
  }

  writeFileSync(LOCK_PATH, JSON.stringify({pid: process.pid, startedAt: new Date().toISOString()}));
}

/** True when this process owns the lock — teardown deletes shared files only then. */
export function ownsRunLock(): boolean {
  return readLock()?.pid === process.pid;
}

export function releaseRunLock(): void {
  if (existsSync(LOCK_PATH) && ownsRunLock()) unlinkSync(LOCK_PATH);
}
