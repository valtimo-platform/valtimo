import { testCaseDefinition, expect } from './fixture';
import { smartAssert } from '../../../utils/smartAssert';
import { testData } from '../../../utils/dataGenerator';
import {caseManagementApi} from './api';

testCaseDefinition('CaseDefinition - Create: should create a new case definition', async ({ casePage }) => {
  const { name } = testData.caseDefinition.build();
  const cleanup = await testData.caseDefinition.setupWithCleanup(casePage, name);

  await smartAssert('case definition exists via UI', async () => {
    await casePage.assertByTitle(name);
  });

  await cleanup();
});
