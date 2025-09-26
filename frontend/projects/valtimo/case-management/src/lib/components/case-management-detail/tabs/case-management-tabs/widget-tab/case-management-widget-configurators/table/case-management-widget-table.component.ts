/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  HostBinding,
  OnDestroy,
  OnInit,
  Output,
  signal,
  ViewEncapsulation,
  WritableSignal,
} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {FieldsCaseWidgetValue, WidgetContentProperties, WidgetTableContent} from '@valtimo/case';
import {
  CARBON_THEME,
  CdsThemeService,
  CurrentCarbonTheme,
  InputLabelModule,
  ValuePathItem,
  ValuePathSelectorComponent,
  ValuePathSelectorPrefix,
  ValuePathType,
} from '@valtimo/components';
import {getCaseManagementRouteParams} from '@valtimo/shared';
import {ButtonModule, InputModule, ToggleModule} from 'carbon-components-angular';
import {BehaviorSubject, debounceTime, map, Observable, Subscription} from 'rxjs';
import {WidgetContentComponent} from '../../../../../../../models';
import {WidgetWizardService} from '../../../../../../../services';
import {CaseManagementWidgetFieldsColumnComponent} from '../fields/column/case-management-widget-fields-column.component';
import {CaseManagementWidgetProcessSelectorComponent} from '../process-selector/case-management-widget-process-selector.component';

@Component({
  templateUrl: './case-management-widget-table.component.html',
  styleUrl: './case-management-widget-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    TranslateModule,
    CaseManagementWidgetFieldsColumnComponent,
    ReactiveFormsModule,
    InputModule,
    ToggleModule,
    ButtonModule,
    InputLabelModule,
    CaseManagementWidgetProcessSelectorComponent,
    ValuePathSelectorComponent,
  ],
})
export class CaseManagementWidgetTableComponent
  implements WidgetContentComponent, OnInit, OnDestroy
{
  @HostBinding('class') public readonly class = 'valtimo-case-management-widget-table';
  @Output() public readonly changeValidEvent = new EventEmitter<boolean>();

  public readonly form: FormGroup = this.fb.group({
    title: this.fb.control<string>(
      this.widgetWizardService.widgetTitle() ?? '',
      Validators.required
    ),
    collection: this.fb.control<string>(
      (this.widgetWizardService.widgetContent() as WidgetTableContent)?.collection ?? '',
      Validators.required
    ),
    defaultPageSize: this.fb.control<number>(
      (this.widgetWizardService.widgetContent() as WidgetTableContent)?.defaultPageSize ?? 5,
      Validators.required
    ),
  });

  public readonly theme$: Observable<CARBON_THEME> = this.cdsThemeService.currentTheme$.pipe(
    map((currentTheme: CurrentCarbonTheme) =>
      currentTheme === CurrentCarbonTheme.G10 ? CARBON_THEME.WHITE : CARBON_THEME.G90
    )
  );
  public readonly params$ = getCaseManagementRouteParams(this.route);

  public readonly content = this.widgetWizardService
    .widgetContent as WritableSignal<WidgetTableContent>;
  public readonly checked = computed(
    () =>
      (this.widgetWizardService.widgetContent() as WidgetTableContent)?.firstColumnAsTitle || false
  );

  public readonly selectedCollection$ = new BehaviorSubject<ValuePathItem | null>(null);

  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;
  public readonly ValuePathType = ValuePathType;

  private readonly _contentValid = signal<boolean>(this.widgetWizardService.editMode());
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService,
    private readonly route: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.form.valueChanges.pipe(debounceTime(500)).subscribe(value => {
        this.widgetWizardService.widgetTitle.set(value?.title ?? '');

        this.widgetWizardService.widgetContent.update(
          (content: WidgetContentProperties | null) =>
            ({
              ...content,
              collection: value?.collection || '',
              defaultPageSize: value?.defaultPageSize || 5,
            }) as WidgetTableContent
        );

        this.changeValidEvent.emit(this.form.valid && this._contentValid());
      })
    );
  }

  public ngOnDestroy(): void {
    this._contentValid.set(false);
    this._subscriptions.unsubscribe();
    this.changeValidEvent.emit(false);
    this.form.reset();
  }

  public onColumnUpdateEvent(event: {data: FieldsCaseWidgetValue[]; valid: boolean}): void {
    const {data, valid} = event;
    this.widgetWizardService.widgetContent.update(
      (content: WidgetContentProperties | null) =>
        ({...content, columns: data}) as WidgetTableContent
    );
    this._contentValid.set(valid);
    this.changeValidEvent.emit(valid && this.form.valid);
  }

  public onCheckedChange(firstColumnAsTitle: boolean): void {
    this.widgetWizardService.widgetContent.update(
      (content: WidgetContentProperties | null) =>
        ({...content, firstColumnAsTitle}) as WidgetTableContent
    );
  }

  public onCollectionSelected(item: ValuePathItem): void {
    this.selectedCollection$.next(item);
  }
}
