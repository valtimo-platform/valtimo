import {expect, test} from '@playwright/test';
import path from 'path';
import {apiGet, apiPost} from '../../utils/api.utils';
import {BpmnModeler} from '../../shared/bpmn-modeler/bpmn-modeler.utils';

test.use({storageState: undefined});
test.setTimeout(240_000);

const BB_API = '/api/management/v1/building-block';
const BPMN = path.resolve(process.cwd(), 'assets', 'e2e-plugin-steps-process.bpmn');
const PROCESS_KEY = 'e2e-plugin-steps-process';

test.describe('EXPLORE bb plugins 3', () => {
  let context, page;
  let modeler: BpmnModeler;
  const key = `explorep3-bb-${Date.now().toString(36)}`;

  const tabUrl = (k: string, v = '1.0.0') =>
    `/building-block-management/building-block/${k}/version/${v}/process-definition`;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    modeler = new BpmnModeler(page);
    await apiPost(BB_API, {key, name: `ExploreP3 ${key}`, versionTag: '1.0.0', description: 'x'});
    await page.goto('/');
    await page.goto(tabUrl(key));
    await page.waitForSelector('valtimo-building-block-management-processes cds-table');
    await page.waitForTimeout(1500);
    await page.getByTestId('buildingBlockProcessesUploadButton').click();
    await page
      .getByTestId('buildingBlockProcessUploadFileUploader')
      .locator('input[type="file"]')
      .setInputFiles(BPMN);
    await page.getByTestId('buildingBlockProcessUploadSubmitButton').click();
    await page.waitForTimeout(3500);
  });

  test.afterAll(async () => {
    await context.close();
  });

  async function openBuilder() {
    const processes: any = await apiGet(`${BB_API}/${key}/version/1.0.0/process-definition`);
    const target = processes.filter((p: any) => p.key === PROCESS_KEY).pop();
    expect(target, 'uploaded process exists').toBeTruthy();
    await page.goto(`${tabUrl(key)}/${target.id}`);
    await modeler.waitForLoaded();
    await page.waitForTimeout(2000);
    return target;
  }

  async function openLinkWizard(elementId: string) {
    const target = await openBuilder();
    await modeler.selectElement(elementId);
    await modeler.expandGroup('Process link');
    await page.getByTestId('processLinkPanelCreateButton').click();
    await expect(page.getByTestId('processLinkModalHeading')).toBeVisible();
    return target;
  }

  test('action step for Zaken API + configure step + complete', async () => {
    await openLinkWizard('ServiceTask_1');

    await page.getByTestId('selectPluginConfigurationRow-zakenapi').click();
    await page.getByTestId('processLinkModalNextButton').click();
    await expect(page.getByTestId('selectPluginAction')).toBeVisible();

    const tiles = page.locator('[data-test-id^="selectPluginActionTile-"]');
    await expect(tiles.first()).toBeVisible();
    console.log('ACTION TILE COUNT', await tiles.count());
    console.log(
      'ACTION TILES',
      JSON.stringify(
        await tiles.evaluateAll(e =>
          e.map(x => [x.getAttribute('data-test-id'), (x as HTMLElement).innerText.trim()])
        )
      )
    );
    console.log('NEXT disabled before pick', await page.getByTestId('processLinkModalNextButton').isDisabled());
    console.log('BACK count', await page.getByTestId('processLinkModalBackButton').count());

    // pick a simple action if available
    const preferred = ['selectPluginActionTile-create-zaak', 'selectPluginActionTile-set-zaakstatus'];
    let chosen: string | null = null;
    for (const id of preferred) {
      if (await page.getByTestId(id).count()) {
        chosen = id;
        break;
      }
    }
    if (!chosen) chosen = await tiles.first().getAttribute('data-test-id');
    console.log('CHOSEN', chosen);
    await page.getByTestId(chosen!).click();
    await page.getByTestId('processLinkModalNextButton').click();
    await page.waitForTimeout(3000);

    console.log('CONFIG container count', await page.getByTestId('pluginActionConfiguration').count());
    console.log('COMPLETE count', await page.getByTestId('processLinkModalCompleteButton').count());
    if (await page.getByTestId('processLinkModalCompleteButton').count()) {
      console.log('COMPLETE disabled', await page.getByTestId('processLinkModalCompleteButton').isDisabled());
    }
    const modal = page.locator('valtimo-process-link-modal');
    console.log('CONFIG TEXT\n', (await modal.innerText()).slice(0, 1800));
    console.log(
      'CONFIG FIELDS',
      JSON.stringify(
        await modal
          .locator('input, select, textarea')
          .evaluateAll(e => e.map((x: any) => [x.tagName, x.getAttribute('formcontrolname') || x.getAttribute('name') || x.id, x.type]))
      )
    );
    console.log('NOTIFICATIONS', await modal.locator('cds-notification').count());
  });

  test('complete a link, then save the process to persist it', async () => {
    await openLinkWizard('ServiceTask_1');
    await page.getByTestId('selectPluginConfigurationRow-zakenapi').click();
    await page.getByTestId('processLinkModalNextButton').click();
    await expect(page.getByTestId('selectPluginAction')).toBeVisible();
    const tiles = page.locator('[data-test-id^="selectPluginActionTile-"]');
    await expect(tiles.first()).toBeVisible();
    await tiles.first().click();
    await page.getByTestId('processLinkModalNextButton').click();
    await page.waitForTimeout(3000);

    const complete = page.getByTestId('processLinkModalCompleteButton');
    if (!(await complete.count())) {
      console.log('NO COMPLETE BUTTON — cannot finish');
      return;
    }
    console.log('COMPLETE disabled', await complete.isDisabled());

    // Fill every visible text input with a dummy value, then re-check Complete
    const modal = page.locator('valtimo-process-link-modal');
    const inputs = modal.locator('input[type="text"]:visible, textarea:visible');
    console.log('VISIBLE TEXT INPUTS', await inputs.count());
    for (let i = 0; i < (await inputs.count()); i++) {
      await inputs.nth(i).fill('e2e').catch(() => {});
    }
    await page.waitForTimeout(1000);
    console.log('COMPLETE disabled after fill', await complete.isDisabled());

    if (!(await complete.isDisabled())) {
      await complete.click();
      await page.waitForTimeout(2500);
      console.log('MODAL still open?', await page.getByTestId('processLinkModalHeading').count());
      const links = await page.evaluate(
        () => (window as any).processManagementEditorService?.processLinksForSelectedDefinition || []
      );
      console.log('IN-MEMORY LINKS', JSON.stringify(links));

      // Panel should now offer Unlink / Edit
      console.log('PANEL edit btn', await page.getByTestId('processLinkPanelEditButton').count());
      console.log('PANEL unlink btn', await page.getByTestId('processLinkPanelUnlinkButton').count());

      // Save the process (draft) to persist the link
      const draft = page.getByTestId('processManagementBuilderDraftToggle');
      await draft.click();
      await page.waitForTimeout(500);
      const responses: string[] = [];
      page.on('response', r => {
        if (r.url().includes('process-definition')) {
          responses.push(`${r.request().method()} ${new URL(r.url()).pathname} -> ${r.status()}`);
        }
      });
      await page.getByTestId('processManagementBuilderDeployButton').click();
      await page.waitForTimeout(6000);
      console.log('SAVE RESPONSES\n', responses.join('\n'));

      // read back the persisted process links
      const processes: any = await apiGet(`${BB_API}/${key}/version/1.0.0/process-definition`);
      const target = processes.filter((p: any) => p.key === PROCESS_KEY).pop();
      console.log('NEW PROCESS DEF', JSON.stringify(target));
      const links2 = await apiGet(
        `/api/v1/process-link?processDefinitionId=${encodeURIComponent(target.id)}`
      ).catch(e => `ERR ${e}`);
      console.log('PERSISTED LINKS', JSON.stringify(links2));
    }
  });
});
