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

import {test, type BrowserContext, type Page} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {AuditEntry, PlanEditorPage, PlanTarget} from './plan-editor.page';

/** Rebuilds every dev fixture through the editor, each value from the control that owns it, so what the editor cannot offer is reported rather than guessed. Opt-in: rewrites fixture data, minutes per plan. */
const ENABLED = !!process.env.MIGRATION_UI_REPLAY;
const ONLY = process.env.MIGRATION_UI_REPLAY_ONLY;

const CONFIG_ROOT = path.resolve(__dirname, '../../../backend/apps/dev/src/main/resources/config');
const REPORT = path.resolve(__dirname, '../../playwright/migration-ui-replay-report.json');

interface Fixture extends PlanTarget {
  label: string;
  plan: Record<string, any>;
}

function collectFixtures(): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const blueprintDir of ['case', 'building-block'] as const) {
    const root = path.join(CONFIG_ROOT, blueprintDir);
    if (!fs.existsSync(root)) continue;
    for (const key of fs.readdirSync(root)) {
      for (const versionDir of fs.readdirSync(path.join(root, key))) {
        const planDir = path.join(
          root,
          key,
          versionDir,
          blueprintDir === 'case' ? 'case-migration' : 'building-block-migration'
        );
        if (!fs.existsSync(planDir)) continue;
        const versionTag = versionDir.replace(/-/g, '.');
        for (const file of fs.readdirSync(planDir)) {
          const plan = JSON.parse(fs.readFileSync(path.join(planDir, file), 'utf-8'));
          fixtures.push({
            blueprintType: blueprintDir,
            key,
            versionTag,
            migrationKey: plan.key,
            base:
              blueprintDir === 'case'
                ? `/management/v1/case-definition/${key}/version/${versionTag}/migration`
                : `/management/v1/building-block/${key}/version/${versionTag}/migration`,
            label: `${blueprintDir}/${key}/${versionTag}/${plan.key}`,
            plan,
          });
        }
      }
    }
  }
  return fixtures.sort((a, b) => a.label.localeCompare(b.label));
}

interface PlanResult {
  plan: string;
  saved: boolean;
  reason?: string;
  differences: string[];
  audit: AuditEntry[];
  /** Set when the fixture could not be put back — a plan the save path refuses needs a redeploy. */
  restoreFailed?: string;
}

test.describe('Migration plan editor — fixture replay audit', () => {
  test.use({storageState: undefined});
  test.skip(!ENABLED, 'Set MIGRATION_UI_REPLAY=1 to run — it deletes and rebuilds dev fixtures.');

  let context: BrowserContext;
  let page: Page;
  let editor: PlanEditorPage;
  const results: PlanResult[] = [];
  const fixtures = collectFixtures().filter(f => !ONLY || f.label.includes(ONLY));

  // `runAfter` offers plan titles and stores plan keys, so the fixture's key needs its title.
  const titlesByKey = new Map<string, string>(
    collectFixtures().map(f => [f.migrationKey, f.plan.title || f.migrationKey])
  );

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({
      baseURL,
      storageState: 'playwright/.auth/uiState.json',
      // UTC, so the picker's local time is the instant's own digits.
      timezoneId: 'UTC',
    });
    page = await context.newPage();
    editor = new PlanEditorPage(page);
    await page.goto('/');
  });

  for (const fixture of collectFixtures().filter(f => !ONLY || f.label.includes(ONLY))) {
    test(`replays ${fixture.label}`, async () => {
      test.setTimeout(Number(process.env.MIGRATION_UI_REPLAY_TIMEOUT ?? 10 * 60_000));

      // The API's export, not the file: the importer normalises `scheduledAtDate` and fills trigger defaults.
      const baseline = (await editor.getPlanViaApi(fixture)) ?? fixture.plan;
      await editor.deletePlanViaApi(fixture);

      const before = editor.audit.length;
      let saved = false;
      let reason: string | undefined;

      try {
        await editor.openCreate(fixture, fixture.label);
        editor.planTitles = titlesByKey;
        await editor.fillGeneral(fixture.plan, fixture);

        await editor.openTab('Data migration');
        await editor.fillDataMigration(
          PlanEditorPage.rootOf(
            page.getByTestId(idFor(fixture, 'DataMigrationTab')),
            'valtimo-migration-data-migration-tab'
          ),
          fixture.plan.dataMigration ?? [],
          idFor(fixture, 'AddPatchButton'),
          'dataMigration'
        );

        await editor.openTab('Process migration');
        await editor.fillProcessMigration(
          PlanEditorPage.rootOf(
            page.getByTestId(idFor(fixture, 'ProcessMigrationTab')),
            'valtimo-migration-process-migration-tab'
          ),
          fixture.plan.processMigration ?? [],
          idFor(fixture, 'AddInstructionButton'),
          'processMigration'
        );

        await editor.openTab('Add building block');
        await editor.fillBuildingBlocks('addBuildingBlock', fixture.plan.addBuildingBlock ?? []);

        await editor.openTab('Remove building block');
        await editor.fillBuildingBlocks(
          'removeBuildingBlock',
          fixture.plan.removeBuildingBlock ?? []
        );

        const outcome = await editor.save();
        saved = outcome.saved;
        reason = outcome.reason;
      } catch (error) {
        reason = `${(error as Error).message}`.slice(0, 400);
      }

      const stored = await editor.getPlanViaApi(fixture);
      const differences = stored
        ? diff(baseline, stored)
        : [
            `no plan stored under '${fixture.migrationKey}'; this version holds ` +
              `${JSON.stringify(await editor.listPlanKeysViaApi(fixture))}`,
          ];

      results.push({
        plan: fixture.label,
        saved,
        reason,
        differences,
        audit: editor.audit.slice(before),
      });
      // Written per plan: a run that dies at plan 19 still reports the 18 before it.
      fs.writeFileSync(REPORT, JSON.stringify(results, null, 2));

      // Put the fixture back exactly as the API exported it, whatever the replay produced.
      const restoreError = await editor.restorePlanViaApi(fixture, baseline);
      if (restoreError) {
        results[results.length - 1].restoreFailed = restoreError;
        fs.writeFileSync(REPORT, JSON.stringify(results, null, 2));
      }
    });
  }

  test.afterAll(async () => {
    fs.writeFileSync(REPORT, JSON.stringify(results, null, 2));
    await context.close();
  });
});

function idFor(fixture: Fixture, suffix: string): string {
  return `${fixture.blueprintType === 'case' ? 'caseMigration' : 'buildingBlockMigration'}${suffix}`;
}

/** Field-level differences between the fixture and what the UI actually saved. */
function diff(expected: any, actual: any, at = ''): string[] {
  if (JSON.stringify(normalise(expected)) === JSON.stringify(normalise(actual))) return [];
  if (
    expected === null ||
    actual === null ||
    typeof expected !== 'object' ||
    typeof actual !== 'object'
  ) {
    return [
      `${at || '(root)'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    ];
  }
  if (Array.isArray(expected) !== Array.isArray(actual)) {
    return [`${at}: shape differs`];
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  return [...keys].flatMap(key => diff(expected[key], actual[key], at ? `${at}.${key}` : key));
}

/** Key order, and an empty component the exporter omits, are not differences an author would recognise. */
function normalise(value: any): any {
  if (Array.isArray(value)) return value.length === 0 ? undefined : value.map(normalise);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter(key => normalise(value[key]) !== undefined)
        .map(key => [key, normalise(value[key])])
    );
  }
  return value;
}
