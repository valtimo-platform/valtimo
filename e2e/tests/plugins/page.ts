import {smartStep} from "../../utils/smartStep";
import {Page} from "@playwright/test";

export class PluginPage {
    private readonly addButton;
    private readonly table;

    constructor(private readonly page: Page) {
        this.addButton = page.getByRole('button', {name: 'Create'});
        this.table = page.locator('table');
    }

    /** Navigate to Admin ▸ Plugins */
    async goToPluginManagement() {
        return smartStep('plugin management', 'navigate', 'UI', async () => {
            console.log("Navigate to Plugin management...");
            await this.page.getByRole('button', { name: 'Admin' }).click();
            await this.page.getByRole('link', { name: 'Plugins' }).click();
            await this.page.waitForSelector("valtimo-carbon-list");
        });
    }
}