import { TestType, test } from '@playwright/test';

// Global flowStep available inside flows
export async function flowStep(label: string, fn: () => Promise<void>) {
  await test.step(label, fn);
}

// flow() defines a test scenario using provided context from the passed-in test type
export function flow(
  testRunner: TestType<any, any>,
  name: string,
  run: (ctx: Record<string, any>) => Promise<void>
) {
  testRunner(name, async ({ ...context }, testInfo) => {
    await run(context);
  });
}
