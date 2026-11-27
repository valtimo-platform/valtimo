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

import type {Reporter, TestCase, TestResult} from '@playwright/test/reporter';
import {fetchBackendErrors} from './api.utils';

/**
 * For every failed attempt, prints the backend ERROR log events written while it ran, and at the
 * end a summary grouped by exception — so a nightly run tells a backend/env failure apart from a
 * test failure without digging through server logs. Relies on serial execution (1 worker).
 */
class BackendErrorsReporter implements Reporter {
  private readonly pending: Promise<void>[] = [];
  private readonly testsByException = new Map<string, Set<string>>();

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === 'passed' || result.status === 'skipped') return;

    const sinceMs = result.startTime.getTime();
    const untilMs = sinceMs + result.duration;
    const title = `${test.titlePath().slice(1).join(' › ')}${result.retry ? ` (retry #${result.retry})` : ''}`;

    this.pending.push(
      fetchBackendErrors(sinceMs, {untilMs, limit: 10}).then(errors => {
        if (!errors.length) return;
        console.log(`\n[backend errors] ${title}\n${errors.join('\n')}\n`);
        for (const error of errors) {
          const exception = error.split('\n').at(-1)?.trim() ?? error;
          if (!this.testsByException.has(exception)) this.testsByException.set(exception, new Set());
          this.testsByException.get(exception)!.add(test.title);
        }
      })
    );
  }

  async onEnd(): Promise<void> {
    await Promise.all(this.pending);
    if (!this.testsByException.size) return;

    console.log('\n[backend errors] Summary — failed tests per backend exception:');
    for (const [exception, tests] of this.testsByException) {
      console.log(`\n  ${exception}\n${[...tests].map(title => `    - ${title}`).join('\n')}`);
    }
  }

  printsToStdio(): boolean {
    return false;
  }
}

export default BackendErrorsReporter;
