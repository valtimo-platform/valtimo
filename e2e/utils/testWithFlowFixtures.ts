import { expect, test as base, type Fixtures, type TestType } from '@playwright/test';

/**
 * Utility to compose multiple fixture maps into a single test runner.
 * Accepts fixture objects (not TestType) from domain/group files.
 */
export function withFlowFixtures(
  domains: Fixtures[]
): TestType<any, any> {
  const merged = domains.reduce(
    (acc, domain) => ({ ...acc, ...domain }),
    {}
  );
  return base.extend(merged);
}

/**
 * Default flowTest with no domain fixtures, ready to be extended.
 */
export const flowTest = withFlowFixtures([]);

export { expect };
