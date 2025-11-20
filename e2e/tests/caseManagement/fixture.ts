import { test as base } from '@playwright/test';
import { CaseDefinitionPage } from './page';

type Fixtures = {
  casePage: CaseDefinitionPage;
};

/**
 * testCaseDefinition
 * Adds:
 *  - CaseDefinitionPage instance scoped per-test
 */
export const testCaseDefinition = base.extend<Fixtures>({
  casePage: async ({ page }, use) => {
    const casePage = new CaseDefinitionPage(page);
    await casePage.goto();
    await use(casePage);
  },
});

export { expect } from '@playwright/test';
