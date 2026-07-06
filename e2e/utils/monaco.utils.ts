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

import {Page, expect} from '@playwright/test';

/**
 * Sets the value of the first Monaco Editor on the page via Monaco's own API.
 *
 * We deliberately avoid clipboard + keyboard (Meta/Control+A, +V) here: that
 * path depends on OS clipboard permissions, editor focus and paste timing, all
 * of which differ between machines and especially between headed and headless
 * runs. A partial paste yields invalid JSON, which makes the JSON editor's
 * onSaveChanges() throw on JSON.parse and leave the editor stuck in edit mode.
 * Writing straight to the model fires the same onDidChangeModelContent event
 * the component listens to, so Angular still sees the change — just reliably.
 */
async function setMonacoEditorValue(page: Page, content: string): Promise<string | null> {
  await page.locator('.monaco-editor').first().waitFor({state: 'visible'});

  return page.evaluate(text => {
    const monaco = (window as any).monaco;
    const editors = monaco?.editor?.getEditors?.() ?? [];

    // Target the editor backing the first *visible* .monaco-editor node.
    // getEditors() also returns editors from other routes that haven't been
    // disposed yet, so picking index 0 blindly can write to a stale, hidden
    // instance — the visible editor then stays unchanged and the save emits the
    // wrong content. Match the DOM node to stay on the editor the user sees.
    const visibleNode = [...document.querySelectorAll('.monaco-editor')].find(
      node => node.getClientRects().length > 0
    );
    const editor =
      editors.find(e => visibleNode && e.getDomNode && visibleNode.contains(e.getDomNode())) ??
      editors[0];

    const model = editor ? editor.getModel() : monaco?.editor?.getModels?.()[0];
    if (!model) return null;

    model.setValue(text);
    return model.getValue();
  }, content);
}

/**
 * True when the editor content matches the requested content. Compares
 * structurally for JSON so formatting differences don't cause false negatives,
 * and falls back to raw string equality for non-JSON payloads.
 */
function contentMatches(actual: string, expected: string): boolean {
  try {
    return JSON.stringify(JSON.parse(actual)) === JSON.stringify(JSON.parse(expected));
  } catch {
    return actual === expected;
  }
}

/**
 * Paste a string directly into a Monaco Editor instance.
 * Assumes the first editor on the page is the target.
 */
export async function pasteToMonacoEditor(page: Page, content: string) {
  await expect(async () => {
    const applied = await setMonacoEditorValue(page, content);
    expect(applied).not.toBeNull();
    expect(contentMatches(applied as string, content)).toBe(true);
  }).toPass({timeout: 15_000});
}

/**
 * Clears the contents of the first Monaco Editor instance.
 */
export async function clearMonacoEditor(page: Page) {
  await expect(async () => {
    const applied = await setMonacoEditorValue(page, '');
    expect(applied).toBe('');
  }).toPass({timeout: 15_000});
}
