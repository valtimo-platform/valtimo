import {WidgetContext} from '../models';
import {WidgetWizardService} from '../services';

export class ManagementWidgetDetailsComponent {
  protected setContext(context: WidgetContext): void {
    this.widgetWizardService.$widgetContext.set(context);
  }
  protected setTitleDisabled(disabled: boolean): void {
    this.widgetWizardService.$disableTitleInput.set(disabled);
  }

  constructor(protected readonly widgetWizardService: WidgetWizardService) {}
}
