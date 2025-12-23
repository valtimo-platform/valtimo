// utils/smartAssert.ts
import { test } from '@playwright/test';

type SmartAssertMeta = {
  severity?: 'low' | 'medium' | 'high' | 'critical';
  testId?: string;
  tags?: string[];
};

export async function smartAssert(
  description: string,
  fn: () => Promise<void>,
  meta: SmartAssertMeta = {}
): Promise<void> {
  const label = `🧪 Assert: ${description}`;

  await test.step(label, async () => {
    try {
      await fn();
    } catch (error) {
      console.error('[smartAssert] ❌ Assertion failed:', {
        description,
        meta,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
    }

    // Optional: could write to file or telemetry service here
    console.debug('[smartAssert] ✅ Assertion passed:', { description, meta });
  });
}
