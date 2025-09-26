/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {CommonModule} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  HostBinding,
  OnDestroy,
  OnInit,
  Output,
  signal,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  CARBON_THEME,
  CdsThemeService,
  CurrentCarbonTheme,
  InputLabelModule,
} from '@valtimo/components';
import {FieldsCaseWidgetValue, WidgetFieldsContent} from '@valtimo/dossier';
import {ButtonModule, IconModule, InputModule, Tab, TabsModule} from 'carbon-components-angular';
import {debounceTime, map, Subscription} from 'rxjs';
import {WidgetContentComponent} from '../../../models';
import {WidgetWizardService} from '../../../services';
import {DossierManagementWidgetFieldsColumnComponent} from './column/dossier-management-widget-fields-column.component';

@Component({
  templateUrl: './dossier-management-widget-fields.component.html',
  styleUrls: ['./dossier-management-widget-fields.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    InputModule,
    TabsModule,
    IconModule,
    ReactiveFormsModule,
    ButtonModule,
    DossierManagementWidgetFieldsColumnComponent,
    InputLabelModule,
  ],
})
export class DossierManagementWidgetFieldsComponent
  implements WidgetContentComponent, OnDestroy, OnInit, AfterViewInit
{
  @HostBinding('class') public readonly class = 'valtimo-dossier-management-widget-field';
  @Output() public readonly changeValidEvent = new EventEmitter<boolean>();
  @ViewChild(Tab) private readonly _tab: Tab;

  public form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.widgetTitle(), Validators.required),
  });

  public readonly columns = signal<null[]>([null]);
  public readonly widgetWidth = this.widgetWizardService.widgetWidth();
  public readonly selectedTabIndex = -1;
  public readonly theme$ = this.cdsThemeService.currentTheme$.pipe(
    map((theme: CurrentCarbonTheme) =>
      theme === CurrentCarbonTheme.G10 ? CARBON_THEME.WHITE : CARBON_THEME.G90
    )
  );
  public readonly selectedWidgetContent = computed(() =>
    (this.widgetWizardService.widgetContent() as WidgetFieldsContent)?.columns.reduce(
      (acc, curr, index) => ({
        ...acc,
        [index]: curr,
      }),
      {}
    )
  );
  public readonly activeTab = signal<number>(0);

  private readonly _subscriptions = new Subscription();
  private readonly _contentValid = signal<boolean>(false);

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.form.valueChanges.pipe(debounceTime(100)).subscribe(formValue => {
        this.widgetWizardService.widgetTitle.set(formValue.widgetTitle ?? '');
        this.changeValidEvent.emit(this.form.valid && this._contentValid());
      })
    );
    const widgetContent = (this.widgetWizardService.widgetContent() as WidgetFieldsContent)
      ?.columns;
    if (!widgetContent) return;

    this.columns.set(Object.keys(widgetContent).map(() => null));
  }

  public ngAfterViewInit(): void {
    this._tab.tabIndex = -1;
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.changeValidEvent.emit(false);
    this.form.reset();
    this._contentValid.set(false);
  }

  public onAddColumnClick(): void {
    this.columns.update(value => [...value, null]);
    this.activeTab.set(this.columns().length - 1);
    this.changeValidEvent.emit(false);
  }

  public onTabSelected(index: number): void {
    this.activeTab.set(index);
  }

  public onDeleteColumnClick(index: number): void {
    this.widgetWizardService.widgetContent.update(content => {
      if (!content) return null;

      const widgetContent = content as WidgetFieldsContent;

      let tempIndex = index;
      let tempContent = {...widgetContent};
      while (tempIndex < this.columns().length - 1) {
        tempContent.columns[tempIndex] = tempContent.columns[tempIndex + 1];
        tempIndex++;
      }
      tempContent.columns.splice(tempIndex, 1);

      return tempContent;
    });

    this.columns.update((columns: null[]) => {
      const temp = columns;
      temp.splice(index, 1);

      return temp;
    });

    if (this.activeTab() !== index) return;

    this.activeTab.set(-1);
  }

  public onColumnUpdateEvent(
    event: {
      data: FieldsCaseWidgetValue[];
      valid: boolean;
    },
    columnIndex: number
  ): void {
    this.widgetWizardService.widgetContent.update(content => {
      if (!content) return {columns: [event.data]};

      const columns = (content as WidgetFieldsContent)?.columns.map((column, index) =>
        index === columnIndex ? event.data : column
      );
      return {
        columns: columnIndex > columns.length - 1 ? [...columns, event.data] : columns,
      };
    });
    this._contentValid.set(event.valid);
    this.changeValidEvent.emit(event.valid && this.form.valid);
  }
}
