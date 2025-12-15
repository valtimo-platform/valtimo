import {test} from "@playwright/test";
import {CaseManagementPage} from "./page";
import {pluginTestConfiguration} from "../plugins/plugin-config";

test.use({storageState: undefined});

test.describe('Case management', () => {
    let context;
    let page;
    let caseManagementPage;
    let request;

    // Arrange
    test.beforeAll(async ({browser, baseURL}) => {
        // Create shared context & page
        console.log({baseURL});
        context = await browser.newContext({baseURL});
        page = await context.newPage();
        request = context.request;

        caseManagementPage = new CaseManagementPage(page, request);

        await page.goto('/');
        await caseManagementPage.goToCaseManagement();
    });

    test.describe('Success test', () => {
        test('Add a case', async () => {
            // Act
            await caseManagementPage.addCase();
            await caseManagementPage.saveConfiguration();

            // Assert
            await caseManagementPage.assertCaseExists('Test case');
        });

        test('Upload a case', async () => {
            // Act
            await caseManagementPage.uploadCase();
            await caseManagementPage.saveConfiguration();
            await caseManagementPage.assertCaseUploaded();

            // Assert
            await caseManagementPage.assertCaseExists('Test case');
        });
    });
});