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

import {expect, request, type APIRequestContext, type Locator, type Page} from '@playwright/test';
import {VSelect} from '../../shared/v-select/v-select.utils';
import {
  AUTO_KEY_INPUT_TEST_IDS,
  VALUE_CONDITION_TREE_TEST_IDS,
  VALUE_PATH_SELECTOR_TEST_IDS,
} from '../../constants';
import {fillValuePathManually} from '../../utils/value-path-selector.utils';

/** Playwright's default action timeout is unbounded; a control that never becomes actionable would otherwise eat the whole test budget. */
const CLICK_TIMEOUT = 15_000;
/** Flow nodes come from the engine for a process pair, which is slower than a render. */
const ACTIVITY_TIMEOUT = 25_000;
const DELETE = 'Delete';

/** Direct children only: a building-block entry embeds whole copies of both tabs. */
const PATCH_ROW = ':scope > .migration-tab__patches > .migration-tab__patch';
const CARD_ROW = ':scope > .migration-tab__items > .migration-tab__card';

/** How a value the fixture needs was reachable in the UI. */
export type Reach = 'dropdown' | 'manual-fallback' | 'not-offered' | 'typed';

export interface AuditEntry {
  plan: string;
  control: string;
  wanted: string;
  reach: Reach;
  offered?: string[];
}

export interface PlanTarget {
  blueprintType: 'case' | 'building-block';
  key: string;
  versionTag: string;
  migrationKey: string;
  base: string;
}

/** The migration plan editor, driven the way an author drives it — every value picked from the control that owns it. */
export class PlanEditorPage {
  public readonly audit: AuditEntry[] = [];
  private _plan = '';
  private _blueprintType: PlanTarget['blueprintType'] = 'case';
  /** migrationKey -> title, for the pickers that label an option with the title. */
  public planTitles = new Map<string, string>();

  constructor(private readonly page: Page) {}

  private record(control: string, wanted: string, reach: Reach, offered?: string[]): void {
    this.audit.push({plan: this._plan, control, wanted, reach, offered});
    this.trace(`${control}=${wanted} -> ${reach}`);
  }

  /** A 10-minute hang reports nothing about where it was; this is what makes the log say. */
  private trace(message: string): void {
    if (process.env.MIGRATION_UI_REPLAY_TRACE) console.log(`    [replay] ${message}`);
  }

  // ---------------------------------------------------------------- navigation

  private editorUrl(target: PlanTarget): string {
    return target.blueprintType === 'case'
      ? `/case-management/case/${target.key}/version/${target.versionTag}/migration/create`
      : `/building-block-management/building-block/${target.key}/version/${target.versionTag}/migration/create`;
  }

  async deletePlanViaApi(target: PlanTarget): Promise<void> {
    const api = await migrationApi();
    // Already gone is the same outcome: it must not be there when the UI recreates it.
    await api.delete(`/api${target.base}/${target.migrationKey}`);
  }

  /** Puts the fixture back. Fails for a plan the save path refuses — those deploy from file only, and a redeploy is the only way back. */
  async restorePlanViaApi(target: PlanTarget, plan: unknown): Promise<string | null> {
    const api = await migrationApi();
    const response = await api.post(`/api${target.base}`, {data: plan});
    if (response.ok()) return null;
    return `${response.status()}: ${(await response.text()).slice(0, 200)}`;
  }

  async getPlanViaApi(target: PlanTarget): Promise<Record<string, unknown> | null> {
    const api = await migrationApi();
    const response = await api.get(`/api${target.base}/${target.migrationKey}`);
    return response.ok() ? ((await response.json()) as Record<string, unknown>) : null;
  }

  /** Which plans this version actually holds — the answer when the expected key is not one of them. */
  async listPlanKeysViaApi(target: PlanTarget): Promise<string[]> {
    const api = await migrationApi();
    const response = await api.get(`/api${target.base}`);
    if (!response.ok()) return [];
    return ((await response.json()) as {migrationKey: string}[]).map(plan => plan.migrationKey);
  }

  async openCreate(target: PlanTarget, planLabel: string): Promise<void> {
    this._plan = planLabel;
    this._blueprintType = target.blueprintType;
    await this.page.goto(this.editorUrl(target));
    this.trace(`opened ${this.page.url()}`);
    // The editor asks the backend for a pre-filled plan; every control below is populated from it.
    await expect(this.page.locator('.migration-tab__loading')).toHaveCount(0, {timeout: 60_000});
    await expect(this.tabPane('general')).toBeVisible();
  }

  // --------------------------------------------------------------------- tabs

  private testId(tab: string): string {
    const prefix =
      this._blueprintType === 'building-block' ? 'buildingBlockMigration' : 'caseMigration';
    return `${prefix}${tab}`;
  }

  private tabPane(
    tab:
      'general' | 'dataMigration' | 'processMigration' | 'addBuildingBlock' | 'removeBuildingBlock'
  ): Locator {
    const suffix = {
      general: 'GeneralTab',
      dataMigration: 'DataMigrationTab',
      processMigration: 'ProcessMigrationTab',
      addBuildingBlock: 'AddBuildingBlockTab',
      removeBuildingBlock: 'RemoveBuildingBlockTab',
    }[tab];
    return this.page.getByTestId(this.testId(suffix));
  }

  /** cds-tabs keeps every pane in the DOM, so the heading button is what actually switches. */
  async openTab(heading: string): Promise<void> {
    await this.page
      .getByRole('tab', {name: heading, exact: true})
      .first()
      .click({timeout: CLICK_TIMEOUT});
  }

  get saveButton(): Locator {
    return this.page.getByTestId(this.testId('SaveButton'));
  }

  async save(): Promise<{saved: boolean; reason?: string}> {
    if (await this.saveButton.isDisabled()) {
      return {saved: false, reason: 'Save stayed disabled'};
    }
    // Exactly the save endpoint — `…/suggestion/activity-mapping/validate` is also a POST containing '/migration'.
    const response = this.page.waitForResponse(
      r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/migration'),
      {timeout: 30_000}
    );
    await this.saveButton.click({timeout: CLICK_TIMEOUT});
    const result = await response;
    return result.ok()
      ? {saved: true}
      : {saved: false, reason: `POST ${result.status()}: ${(await result.text()).slice(0, 300)}`};
  }

  // ----------------------------------------------------------------- controls

  /** A Carbon `cds-select`: audits whether [value] is on offer before picking it. */
  private async pickNative(host: Locator, value: string, control: string): Promise<void> {
    const select = host.locator('select').first();
    await expect(select).toBeVisible({timeout: 20_000});
    const offered = await select
      .locator('option')
      .evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));

    if (!offered.includes(value)) {
      this.record(control, value, 'not-offered', offered);
      return;
    }
    this.record(control, value, 'dropdown');
    await select.selectOption(value, {timeout: CLICK_TIMEOUT});
  }

  /** A `v-select` combo box. Matches on the key, which a labelled option carries in brackets. */
  private async pickVSelect(host: Locator, value: string, control: string): Promise<void> {
    const select = new VSelect(this.page, host);
    const offered = await select.optionLabels();
    const label = offered.find(option => option === value || option.endsWith(`(${value})`));

    if (!label) {
      this.record(control, value, 'not-offered', offered);
      return;
    }
    this.record(control, value, 'dropdown');
    await select.selectByLabel(label);
  }

  /** A `valtimo-value-path-selector`: prefers the dropdown, records when only manual entry reaches the path. */
  private async setValuePath(host: Locator, path: string, control: string): Promise<void> {
    const combo = host.getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.path);

    if ((await combo.count()) > 0) {
      await combo.click({timeout: CLICK_TIMEOUT});
      // The list box is appended to the body, not to the selector, and is filled per blueprint version.
      const options = this.page.getByRole('option');
      await options
        .first()
        .waitFor({state: 'visible', timeout: CLICK_TIMEOUT})
        .catch(() => undefined);
      const option = this.page.getByRole('option', {name: path, exact: true});
      if ((await option.count()) > 0) {
        await option.click({timeout: CLICK_TIMEOUT});
        this.record(control, path, 'dropdown');
        await this.page.keyboard.press('Escape');
        return;
      }
      const offered = (await options.allInnerTexts()).map(text => text.trim());
      await this.page.keyboard.press('Escape');
      this.record(control, path, 'manual-fallback', offered);
    } else {
      this.record(control, path, 'manual-fallback');
    }

    await fillValuePathManually(host, path);
  }

  /** A mapping side: select when the engine returned flow nodes, free-text otherwise. The row renders as the input first, so waiting for the select tells "none" from "not yet". */
  private async setActivity(row: Locator, side: 'source' | 'target', id: string, control: string) {
    const select = row.locator(`cds-select[formcontrolname="${side}"]`);
    await select.waitFor({state: 'attached', timeout: ACTIVITY_TIMEOUT}).catch(() => undefined);

    if ((await select.count()) > 0) {
      await this.pickNative(select, id, control);
      return;
    }
    this.record(control, id, 'manual-fallback');
    await row.locator(`input[formcontrolname="${side}"]`).fill(id, {timeout: CLICK_TIMEOUT});
  }

  private async fillText(host: Locator, value: string): Promise<void> {
    await host.fill(value, {timeout: CLICK_TIMEOUT});
    await host.blur();
  }

  // ------------------------------------------------------------------ general

  async fillGeneral(plan: Record<string, any>, target: PlanTarget): Promise<void> {
    await this.openTab('General');
    const pane = this.tabPane('general');

    const sourceKey = plan.source?.key ?? target.key;
    await this.pickVSelect(
      pane.getByTestId(this.testId('SourceKeySelect')),
      sourceKey,
      'general.sourceKey'
    );
    await this.pickVSelect(
      pane.getByTestId(this.testId('SourceVersionSelect')),
      plan.source.versionTag,
      'general.sourceVersion'
    );

    // Title after the source: picking a source re-suggests, overwriting a title it believes it wrote.
    await expect(this.page.locator('.migration-tab__loading')).toHaveCount(0, {timeout: 60_000});
    await this.fillText(pane.locator('input[formcontrolname="title"]'), plan.title ?? '');

    // The key is generated from the title; unlocking it is the only way to land on the fixture's own key.
    const keyInput = pane.getByTestId(AUTO_KEY_INPUT_TEST_IDS.input);
    if (!(await keyInput.isEditable())) {
      await pane.getByTestId(AUTO_KEY_INPUT_TEST_IDS.editButton).click({timeout: CLICK_TIMEOUT});
    }
    await this.fillText(keyInput, plan.key);

    if (target.blueprintType === 'case') {
      await this.fillTriggers(pane, plan.migrationTriggers ?? {});
      await this.fillConditions(pane, plan.conditions ?? []);
    }
  }

  private async fillTriggers(pane: Locator, triggers: Record<string, any>): Promise<void> {
    const button = pane.locator('input[type="checkbox"]').first();
    if (triggers.triggeredByButton === true) await setChecked(button, true);
    else await setChecked(button, false);

    if (triggers.scheduledAtDate) {
      // The instant the server stores, typed in the context's UTC; the picker takes whole minutes only.
      const instant = toServerInstant(String(triggers.scheduledAtDate));
      const minutes = instant.slice(0, 16);
      if (!instant.endsWith(':00Z')) {
        this.record('general.scheduledAtDate', triggers.scheduledAtDate, 'not-offered', [minutes]);
      }
      await this.fillText(pane.locator('input[formcontrolname="scheduledAtDate"]'), minutes);
    }
    if (triggers.runAfter) {
      await this.pickVSelect(
        pane.locator('v-select[formcontrolname="runAfter"]'),
        this.planTitles.get(triggers.runAfter) ?? triggers.runAfter,
        'general.runAfter'
      );
    }
  }

  private async fillConditions(pane: Locator, conditions: any[]): Promise<void> {
    await this.fillConditionTree(pane.locator('.value-condition-tree').first(), conditions);
  }

  /** One level of the condition tree; a group adds a nested tree and recurses into it. */
  private async fillConditionTree(tree: Locator, conditions: any[]): Promise<void> {
    for (const condition of conditions) {
      const mode = condition.allOf ? 'allOf' : condition.anyOf ? 'anyOf' : null;
      if (mode) {
        await tree
          .locator('> .value-condition-tree__actions > button')
          .last()
          .click({timeout: CLICK_TIMEOUT});
        const group = tree.locator('> .value-condition-tree__row').last();
        await this.pickNative(
          group.getByTestId(VALUE_CONDITION_TREE_TEST_IDS.groupModeSelect),
          mode,
          'condition.groupMode'
        );
        await this.fillConditionTree(
          group.locator('.value-condition-tree__nested .value-condition-tree').first(),
          condition[mode]
        );
        continue;
      }
      await tree
        .locator('> .value-condition-tree__actions > button')
        .first()
        .click({timeout: CLICK_TIMEOUT});
      const row = tree.locator('> .value-condition-tree__row .value-condition-tree__fields').last();
      await this.setValuePath(
        row.locator('valtimo-value-path-selector'),
        condition.path,
        'condition.path'
      );
      await this.pickNative(
        row.getByTestId(VALUE_CONDITION_TREE_TEST_IDS.operatorSelect),
        condition.operator,
        'condition.operator'
      );
      if (condition.value !== undefined && condition.value !== null) {
        await this.fillText(
          row.getByTestId(VALUE_CONDITION_TREE_TEST_IDS.valueInput),
          String(condition.value)
        );
      }
    }
  }

  // ----------------------------------------------------------- data migration

  /** Drops whatever the suggestion pre-filled, so what is saved is what this harness typed. */
  private async clearRows(pane: Locator, rowSelector: string): Promise<void> {
    this.trace(`clearRows ${rowSelector}`);
    const rows = pane.locator(rowSelector);
    // Bounded: a delete that does not take would otherwise spin until the test times out.
    for (let guard = 0; guard < 80; guard++) {
      const before = await rows.count();
      if (before === 0) return;
      await rows.first().getByTitle(DELETE, {exact: true}).first().click({timeout: CLICK_TIMEOUT});
      await expect(rows).toHaveCount(before - 1, {timeout: CLICK_TIMEOUT});
    }
  }

  async fillDataMigration(
    pane: Locator,
    patches: any[],
    addTestId: string,
    prefix: string
  ): Promise<void> {
    this.trace(`fillDataMigration ${prefix} (${patches.length})`);
    await this.clearRows(pane, PATCH_ROW);

    for (const [index, patch] of patches.entries()) {
      await pane.getByTestId(addTestId).first().click({timeout: CLICK_TIMEOUT});
      const row = pane.locator(PATCH_ROW).nth(index);

      const mode = patch.source ? 'path' : patch.value !== undefined ? 'value' : 'null';
      await this.pickNative(
        row.locator('cds-select[formcontrolname="mode"]'),
        mode,
        `${prefix}.mode`
      );

      if (mode === 'path') {
        await this.setValuePath(
          row.locator('.migration-tab__patch-side--from valtimo-value-path-selector'),
          patch.source,
          `${prefix}.source`
        );
      } else if (mode === 'value') {
        await this.fillText(
          row.locator('.migration-tab__patch-side--from input'),
          String(patch.value)
        );
      }

      await this.setValuePath(
        row.locator('.migration-tab__patch-side--to valtimo-value-path-selector'),
        patch.target,
        `${prefix}.target`
      );

      if (patch.targetType) {
        await this.pickNative(
          row.locator('cds-select[formcontrolname="targetType"]'),
          patch.targetType,
          `${prefix}.targetType`
        );
      }
    }
  }

  // -------------------------------------------------------- process migration

  async fillProcessMigration(
    pane: Locator,
    instructions: any[],
    addTestId: string,
    prefix: string
  ): Promise<void> {
    this.trace(`fillProcessMigration ${prefix} (${instructions.length})`);
    await this.clearRows(pane, CARD_ROW);

    for (const [index, instruction] of instructions.entries()) {
      await pane.getByTestId(addTestId).first().click({timeout: CLICK_TIMEOUT});
      const card = pane.locator(CARD_ROW).nth(index);

      await this.pickNative(
        card.locator('cds-select[formcontrolname="sourceProcessDefinitionKey"]'),
        instruction.sourceProcessDefinitionKey,
        `${prefix}.sourceProcessKey`
      );
      await this.pickNative(
        card.locator('cds-select[formcontrolname="targetProcessDefinitionKey"]'),
        instruction.targetProcessDefinitionKey,
        `${prefix}.targetProcessKey`
      );

      this.trace(`instruction ${index} mappings`);
      // The editor suggests a mapping the moment both processes are known; start from empty.
      await this.page.waitForTimeout(1_500);
      await this.clearRows(card, '.migration-tab__mapping-row');

      for (const [source, activityTarget] of Object.entries(instruction.mapActivities ?? {})) {
        await card
          .getByRole('button', {name: 'Add mapping'})
          .first()
          .click({timeout: CLICK_TIMEOUT});
        const row = card.locator('.migration-tab__mapping-row').last();
        await this.setActivity(row, 'source', source, `${prefix}.mapActivities.source`);
        await this.setActivity(
          row,
          'target',
          String(activityTarget),
          `${prefix}.mapActivities.target`
        );
      }

      for (const variable of instruction.setProcessVariables ?? []) {
        await card
          .getByRole('button', {name: 'Add variable'})
          .first()
          .click({timeout: CLICK_TIMEOUT});
        const row = card.locator('.migration-tab__patches > .migration-tab__patch').last();
        const mode = variable.source ? 'path' : variable.value !== undefined ? 'value' : 'null';
        await this.pickNative(
          row.locator('cds-select[formcontrolname="mode"]'),
          mode,
          `${prefix}.setProcessVariables.mode`
        );
        if (mode === 'path') {
          await this.setValuePath(
            row.locator('.migration-tab__patch-side--from valtimo-value-path-selector'),
            variable.source,
            `${prefix}.setProcessVariables.source`
          );
        } else if (mode === 'value') {
          await this.fillText(
            row.locator('.migration-tab__patch-side--from input'),
            String(variable.value)
          );
        }
        await this.fillText(
          row.locator('.migration-tab__patch-side--to input').first(),
          variable.target
        );
        if (variable.targetType) {
          await this.pickNative(
            row.locator('cds-select[formcontrolname="targetType"]'),
            variable.targetType,
            `${prefix}.setProcessVariables.targetType`
          );
        }
      }

      if (instruction.skipCustomListeners) {
        await setChecked(card.locator('input[type="checkbox"]').first(), true);
      }
      if (instruction.skipIoMappings) {
        await setChecked(card.locator('input[type="checkbox"]').nth(1), true);
      }
    }
  }

  // ---------------------------------------------------------- building blocks

  /** The `.migration-tab` root of the first [component] under [scope] — rows hang directly off it. */
  static rootOf(scope: Locator, component: string): Locator {
    return scope.locator(component).first().locator('.migration-tab').first();
  }

  async fillBuildingBlocks(
    mode: 'addBuildingBlock' | 'removeBuildingBlock',
    entries: any[]
  ): Promise<void> {
    const pane = PlanEditorPage.rootOf(this.tabPane(mode), 'valtimo-migration-building-block-tab');
    const addTestId = this.testId(
      mode === 'addBuildingBlock' ? 'AddBuildingBlockButton' : 'RemoveBuildingBlockButton'
    );
    await this.clearRows(pane, CARD_ROW);

    for (const [index, entry] of entries.entries()) {
      await pane.getByTestId(addTestId).first().click({timeout: CLICK_TIMEOUT});
      const card = pane.locator(CARD_ROW).nth(index);

      await this.pickVSelect(
        card.locator('v-select[formcontrolname="buildingBlockKey"]'),
        entry.buildingBlockKey,
        `${mode}.buildingBlockKey`
      );
      await this.pickVSelect(
        card.locator('v-select[formcontrolname="buildingBlockVersionTag"]'),
        entry.buildingBlockVersionTag,
        `${mode}.buildingBlockVersion`
      );

      // Picking a block re-suggests the entry, which remounts both nested editors.
      await this.page.waitForTimeout(2_500);

      await this.fillDataMigration(
        PlanEditorPage.rootOf(card, 'valtimo-migration-data-migration-tab'),
        entry.dataMigration ?? [],
        addTestIdOf(this.testId('AddPatchButton')),
        `${mode}.dataMigration`
      );
      await this.fillProcessMigration(
        PlanEditorPage.rootOf(card, 'valtimo-migration-process-migration-tab'),
        entry.processMigration ?? [],
        addTestIdOf(this.testId('AddInstructionButton')),
        `${mode}.processMigration`
      );
    }
  }
}

/** The nested tabs are handed the host's own ids, so a nested add button carries the same one. */
function addTestIdOf(testId: string): string {
  return testId;
}

/** Carbon's checkbox input is visually hidden behind its label, so it never becomes actionable. */
async function setChecked(input: Locator, checked: boolean): Promise<void> {
  if ((await input.isChecked()) === checked) return;
  if (checked) await input.check({force: true, timeout: CLICK_TIMEOUT});
  else await input.uncheck({force: true, timeout: CLICK_TIMEOUT});
}

/** As the server reads `scheduledAtDate`: an offset is honoured, none means UTC. */
function toServerInstant(value: string): string {
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);

  return `${new Date(hasOffset ? value : `${value}Z`).toISOString().slice(0, 19)}Z`;
}

let _api: APIRequestContext | undefined;

/** Its own admin context: the shared e2e token is the QA user, which migration management answers 403 for. */
async function migrationApi(): Promise<APIRequestContext> {
  if (_api) return _api;

  const keycloak = process.env.KEYCLOAK_URL ?? 'http://localhost:8081';
  const realm = process.env.KEYCLOAK_REALM ?? 'valtimo';
  const anonymous = await request.newContext();
  const response = await anonymous.post(
    `${keycloak}/auth/realms/${realm}/protocol/openid-connect/token`,
    {
      form: {
        client_id: 'valtimo-console',
        grant_type: 'password',
        username: process.env.MIGRATION_UI_REPLAY_USER ?? 'admin',
        password: process.env.MIGRATION_UI_REPLAY_PASSWORD ?? 'admin',
      },
    }
  );
  const token = (await response.json()).access_token as string;
  await anonymous.dispose();

  _api = await request.newContext({
    baseURL: process.env.qa_url ?? 'http://localhost:4200',
    extraHTTPHeaders: {Authorization: `Bearer ${token}`, Accept: 'application/json'},
  });
  return _api;
}
