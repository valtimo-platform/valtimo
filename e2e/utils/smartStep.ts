// utils/smartStep.ts
import { test } from '@playwright/test';

/**
 * Wraps an action in a structured Playwright test.step with emoji formatting.
 *
 * @param entity - What kind of thing are we acting on? (e.g. "form flow", "dashboard")
 * @param action - What are we doing? ("create", "edit", "delete", "validate", etc.)
 * @param method - How are we doing it? ("UI", "API", "Database", etc.)
 * @param step - The actual step callback (async function)
 */
export async function smartStep(
  entity: string,
  action: string,
  method: string,
  step: () => Promise<void>,
  meta?: Record<string, unknown>
) {
  const emoji = emojiFor(action);
  const label = `${emoji} ${capitalize(action)} ${entity} via ${method}`;
  console.debug('[smartStep]', { entity, action, method, ...meta });
  await test.step(label, step);
}

function emojiFor(action: string): string {
  switch (action.toLowerCase()) {
    case 'create':
      return '🛠';
    case 'edit':
      return '✏️';
    case 'delete':
      return '🧼';
    case 'validate':
      return '✅';
    case 'navigate':
      return '🧭';
    case 'fetch':
    case 'get':
      return '📦';
    case 'setup':
      return '⚙️';
    default:
      return '🔹';
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
