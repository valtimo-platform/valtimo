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

import {expect, type Locator, type Page} from '@playwright/test';

/**
 * Wrapper for the BPMN modeler used by `valtimo-process-management-builder` —
 * the canvas (bpmn-js) and the properties panel (bpmn-js-properties-panel).
 *
 * Both are third-party libraries that render their own DOM, so this is the one
 * place in the suite that has to rely on their class names and `data-*`
 * contracts instead of `data-test-id`. The Valtimo-owned parts of the panel (the
 * "Process link" group) *do* carry test ids — see `PROCESS_LINK_PANEL_TEST_IDS`.
 */
export class BpmnModeler {
  constructor(private readonly page: Page) {}

  // ─── Canvas ───────────────────────────────────────────────────────

  get container(): Locator {
    return this.page.locator('.bpmn__container');
  }

  get palette(): Locator {
    return this.page.locator('.djs-palette:visible');
  }

  /**
   * Both the editable modeler and the read-only viewer render
   * `.bpmn__modeler-canvas`; the inactive one sits inside a `display: none`
   * parent, so `:visible` resolves to whichever is currently in use.
   */
  get activeCanvas(): Locator {
    return this.page.locator('.bpmn__modeler-canvas:visible');
  }

  elementShape(elementId: string): Locator {
    return this.activeCanvas.locator(`g[data-element-id="${elementId}"]`);
  }

  get taskShapes(): Locator {
    return this.activeCanvas.locator('g.djs-shape[data-element-id^="Activity_"]');
  }

  get appendTaskContextPadAction(): Locator {
    return this.page.locator('.djs-context-pad [data-action="append.append-task"]');
  }

  /** Wait until the diagram is rendered and interactive. */
  async waitForLoaded() {
    await expect(this.container).toBeVisible();
    await expect(this.palette).toBeVisible();
    await this.waitForDiagramSettled();
  }

  async waitForDiagramSettled(quietWindowMs = 1_000, maxImports = 10) {
    for (let imports = 0; imports <= maxImports; imports++) {
      const reimported = await this.page
        .waitForResponse(res => /\/v1\/process\/definition\/[^/]+\/xml/.test(res.url()), {
          timeout: quietWindowMs,
        })
        .then(() => true)
        .catch(() => false);

      if (!reimported) return;
    }

    throw new Error(
      `[bpmn-modeler] The diagram was re-imported more than ${maxImports} times and never settled.`
    );
  }

  /**
   * Select an element so the properties panel switches to it.
   *
   * Confirmed through the panel's ID entry, which always holds the id of the
   * selected element. The panel *header* cannot be used: it renders the element's
   * name and falls back to the id only while the element is unnamed. The click is
   * retried because a first click right after the diagram loads is sometimes only
   * registered as a hover, leaving the selection unchanged.
   */
  async selectElement(elementId: string, timeout = 20_000) {
    const shape = this.elementShape(elementId);
    await expect(shape).toBeVisible();

    await expect(async () => {
      await shape.click();
      await expect(this.idInput).toHaveValue(elementId, {timeout: 2_000});
    }).toPass({timeout});
  }

  async openContextPad(elementId: string, timeout = 20_000) {
    const shape = this.elementShape(elementId);
    await expect(shape).toBeVisible();

    await expect(async () => {
      await shape.click();
      await expect(this.appendTaskContextPadAction).toBeVisible({timeout: 2_000});
    }).toPass({timeout});
  }

  /** Append a task to an element through its context pad. */
  async appendTaskTo(elementId: string): Promise<string> {
    const before = await this.taskShapes.count();
    await this.openContextPad(elementId);
    await this.appendTaskContextPadAction.click();
    // The new shape enters direct-editing mode; leave it to commit the change.
    await this.page.keyboard.press('Escape');
    await expect(this.taskShapes).toHaveCount(before + 1);
    return (await this.taskShapes.last().getAttribute('data-element-id')) ?? '';
  }

  // ─── Properties panel ─────────────────────────────────────────────

  /** Panel of the active (editable or read-only) modeler. */
  get panel(): Locator {
    return this.page.locator('.bpmn__modeler-panel:visible').first();
  }

  /**
   * The element type shown in the panel header, e.g. "Start Event".
   *
   * Read through the `title` attribute: the rendered text is uppercased by CSS,
   * so `innerText` would return "START EVENT".
   */
  get panelHeaderType(): Locator {
    return this.panel.locator('.bio-properties-panel-header-type');
  }

  /** The element name — or its id while the element is still unnamed. */
  get panelHeaderLabel(): Locator {
    return this.panel.locator('.bio-properties-panel-header-label');
  }

  /** A collapsible group of the panel, located by its group title. */
  group(title: string): Locator {
    return this.panel
      .locator('.bio-properties-panel-group')
      .filter({has: this.page.locator(`[data-title="${title}"]`)});
  }

  /** Titles of the groups the panel currently offers, in render order. */
  async groupTitles(): Promise<string[]> {
    return this.panel
      .locator('.bio-properties-panel-group-header-title')
      .evaluateAll(headers => headers.map(header => header.getAttribute('title') ?? ''));
  }

  /**
   * Expand a group. Every group starts collapsed, and a collapsed group keeps its
   * entries in the DOM but hidden, so they have to be expanded before they can be
   * read or filled.
   */
  async expandGroup(title: string, timeout = 20_000) {
    const group = this.group(title);
    await expect(group).toBeVisible({timeout: Math.min(timeout, 10_000)});

    const header = group.locator('.bio-properties-panel-group-header');
    const entries = group.locator('.bio-properties-panel-group-entries');

    await expect(async () => {
      if (!(await entries.isVisible())) {
        await header.click({timeout: 5_000});
      }
      await expect(entries).toBeVisible({timeout: 2_000});
    }).toPass({timeout});
  }

  async selectElementAndExpandGroup(elementId: string, groupTitle: string) {
    await this.withSelectedElement(elementId, () => this.expandGroup(groupTitle, 5_000));
  }

  async withSelectedElement(
    elementId: string,
    action: () => Promise<unknown>,
    timeout = 25_000
  ): Promise<void> {
    await expect(async () => {
      await this.selectElement(elementId, 5_000);
      await action();
    }).toPass({timeout});
  }

  /** An entry of the (expanded) panel, located by its bpmn-js entry id. */
  entryInput(entryId: string): Locator {
    return this.panel.locator(`#bio-properties-panel-${entryId}`);
  }

  get nameInput(): Locator {
    return this.entryInput('name');
  }

  get idInput(): Locator {
    return this.entryInput('id');
  }

  async renameElement(elementId: string, name: string) {
    await expect(async () => {
      await this.withSelectedElement(elementId, async () => {
        await this.expandGroup('General', 5_000);
        await this.nameInput.fill(name);
        await expect(this.panelHeaderLabel).toHaveAttribute('title', name, {timeout: 3_000});
      });

      await this.waitForDiagramSettled();
      await expect(this.panelHeaderLabel).toHaveAttribute('title', name, {timeout: 3_000});
    }).toPass({timeout: 40_000});
  }
}
