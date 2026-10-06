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
 * Run every teardown step in order, even when an earlier one fails, then raise what went wrong.
 *
 * A plain `await a(); await b();` teardown stops at the first throw, so a child that refuses to
 * be deleted takes its parent — and the browser context — down with it, and the next run starts
 * on a dirtier environment than the failure itself warranted.
 */
export async function runCleanups(...steps: Array<() => Promise<unknown>>): Promise<void> {
  const failures: string[] = [];

  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      failures.push((error as Error).message);
    }
  }

  if (failures.length) {
    throw new Error(
      `[cleanup] ${failures.length} teardown step(s) failed:\n${failures.join('\n')}`
    );
  }
}
