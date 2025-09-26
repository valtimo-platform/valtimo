import {Injectable} from '@angular/core';
import {AbstractControl, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {TranslateService} from '@ngx-translate/core';
import {CaseWidgetDisplayTypeKey} from '@valtimo/dossier';
import {ListItem} from 'carbon-components-angular';

@Injectable({
  providedIn: 'root',
})
export class WidgetFieldsService {

  public readonly displayTypeItems: ListItem[] = [
    {
      content: this.translateService.instant(
        `widgetTabManagement.content.displayType.${CaseWidgetDisplayTypeKey.TEXT}`
      ),
      id: CaseWidgetDisplayTypeKey.TEXT,
      selected: true,
    },
    {
      content: this.translateService.instant(
        `widgetTabManagement.content.displayType.${CaseWidgetDisplayTypeKey.BOOLEAN}`
      ),
      id: CaseWidgetDisplayTypeKey.BOOLEAN,
      selected: false,
    },
    {
      content: this.translateService.instant(
        `widgetTabManagement.content.displayType.${CaseWidgetDisplayTypeKey.CODE_LIST}`
      ),
      id: CaseWidgetDisplayTypeKey.CODE_LIST,
      selected: false,
    },    {
      content: this.translateService.instant(
        `widgetTabManagement.content.displayType.${CaseWidgetDisplayTypeKey.CURRENCY}`
      ),
      id: CaseWidgetDisplayTypeKey.CURRENCY,
      selected: false,
    },
    {
      content: this.translateService.instant(
        `widgetTabManagement.content.displayType.${CaseWidgetDisplayTypeKey.DATE}`
      ),
      id: CaseWidgetDisplayTypeKey.DATE,
      selected: false,
    },
    {
      content: this.translateService.instant(
        `widgetTabManagement.content.displayType.${CaseWidgetDisplayTypeKey.DATE_TIME}`
      ),
      id: CaseWidgetDisplayTypeKey.DATE_TIME,
      selected: false,
    },
    {
      content: this.translateService.instant(
        `widgetTabManagement.content.displayType.${CaseWidgetDisplayTypeKey.ENUM}`
      ),
      id: CaseWidgetDisplayTypeKey.ENUM,
      selected: false,
    },
    {
      content: this.translateService.instant(
        `widgetTabManagement.content.displayType.${CaseWidgetDisplayTypeKey.NUMBER}`
      ),
      id: CaseWidgetDisplayTypeKey.NUMBER,
      selected: false,
    },
    {
      content: this.translateService.instant(
        `widgetTabManagement.content.displayType.${CaseWidgetDisplayTypeKey.PERCENT}`
      ),
      id: CaseWidgetDisplayTypeKey.PERCENT,
      selected: false,
    },
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService
  ) {}

  public getDisplayItemsSelected(control: AbstractControl): ListItem[] {
    const typeControlValue: ListItem = control.get('type')?.value;

    if (!typeControlValue) return this.displayTypeItems;

    return this.displayTypeItems.map((item: ListItem) => ({
      ...item,
      selected: typeControlValue.id === item.id && typeControlValue.selected,
    }));
  }

  public onDisplayTypeSelected(
    mainKeysArray: string[],
    formGroup: FormGroup,
    event: {item: ListItem}
  ): void {
    const extraControlKeys = Object.keys(formGroup.controls).filter(
      (key: string) => !mainKeysArray.includes(key)
    );

    extraControlKeys.forEach((controlKey: string) => formGroup.removeControl(controlKey));

    switch (event.item.id) {
      case CaseWidgetDisplayTypeKey.BOOLEAN:
        break;
      case CaseWidgetDisplayTypeKey.TEXT:
        break;
      case CaseWidgetDisplayTypeKey.CODE_LIST:
        formGroup.addControl('providerName', this.fb.control('', Validators.required));
        break;
      case CaseWidgetDisplayTypeKey.CURRENCY:
        formGroup.addControl('currencyCode', this.fb.control(''));
        formGroup.addControl('display', this.fb.control(''));
        formGroup.addControl('digitsInfo', this.fb.control(''));
        break;
      case CaseWidgetDisplayTypeKey.DATE:
        formGroup.addControl('format', this.fb.control(''));
        break;
      case CaseWidgetDisplayTypeKey.DATE_TIME:
        formGroup.addControl('format', this.fb.control(''));
        break;
      case CaseWidgetDisplayTypeKey.ENUM:
        formGroup.addControl(
          'values',
          this.fb.array(
            [
              this.fb.group({
                key: this.fb.control('', Validators.required),
                value: this.fb.control('', Validators.required),
              }),
            ],
            Validators.required
          )
        );
        break;
      default:
        formGroup.addControl('digitsInfo', this.fb.control(''));
        break;
    }
  }
}
