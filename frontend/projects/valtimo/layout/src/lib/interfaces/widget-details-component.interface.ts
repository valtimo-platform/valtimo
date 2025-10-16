import {WidgetContext} from '../models';
import {WidgetWizardService} from '../services';

export class ManagementWidgetDetailsComponent {
  protected setContext(context: WidgetContext): void {
    this.widgetWizardService.$widgetContext.set(context);
  }

  constructor(protected readonly widgetWizardService: WidgetWizardService) {}
}
