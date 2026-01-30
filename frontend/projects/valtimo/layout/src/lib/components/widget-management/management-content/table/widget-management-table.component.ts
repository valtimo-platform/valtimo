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
  HostBinding,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  signal,
  ViewEncapsulation,
  WritableSignal,
} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CARBON_THEME,
  CdsThemeService,
  CurrentCarbonTheme,
  InputLabelModule,
  MdiIconSelectorComponent,
  ValuePathItem,
  ValuePathSelectorComponent,
  ValuePathSelectorPrefix,
  ValuePathType,
} from '@valtimo/components';
import {ButtonModule, InputModule, LayerModule, ToggleModule} from 'carbon-components-angular';
import {BehaviorSubject, debounceTime, map, Observable, Subscription, switchMap} from 'rxjs';
import {WIDGET_MANAGEMENT_SERVICE} from '../../../../constants';
import {IWidgetManagementService} from '../../../../interfaces';
import {FieldsWidgetValue, WidgetContentProperties, WidgetTableContent} from '../../../../models';
import {WidgetWizardService} from '../../../../services';
import {WidgetManagementFieldsColumnComponent} from '../fields/column/widget-management-fields-column.component';
import {toObservable} from '@angular/core/rxjs-interop';

@Component({
  selector: 'valtimo-widget-management-table',
  templateUrl: './widget-management-table.component.html',
  styleUrl: './widget-management-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    TranslateModule,
    WidgetManagementFieldsColumnComponent,
    ReactiveFormsModule,
    InputModule,
    ToggleModule,
    ButtonModule,
    InputLabelModule,
    LayerModule,
    ValuePathSelectorComponent,
    MdiIconSelectorComponent,
  ],
})
export class WidgetManagementTableComponent implements OnInit, OnDestroy {
  @HostBinding('class') public readonly class = 'valtimo-widget-management-table';
  @Input() public showFirstColumnOption = true;
  @Input() public sortableColumns = false;

  public readonly form: FormGroup = this.fb.group({
    title: this.fb.control<string>(
      this.widgetWizardService.$widgetTitle() ?? '',
      Validators.required
    ),
    widgetIcon: this.fb.control(this.widgetWizardService.$widgetIcon()),
    collection: this.fb.control<string>(
      (this.widgetWizardService.$widgetContent() as WidgetTableContent)?.collection ?? '',
      Validators.required
    ),
    defaultPageSize: this.fb.control<number>(
      (this.widgetWizardService.$widgetContent() as WidgetTableContent)?.defaultPageSize ?? 5,
      Validators.required
    ),
  });

  public readonly theme$: Observable<CARBON_THEME> = this.cdsThemeService.currentTheme$.pipe(
    map((currentTheme: CurrentCarbonTheme) =>
      currentTheme === CurrentCarbonTheme.G10 ? CARBON_THEME.WHITE : CARBON_THEME.G90
    )
  );
  public readonly params$ = this.widgetManagementService.params$;

  public readonly $widgetContext = this.widgetWizardService.$widgetContext;
  public readonly $content = this.widgetWizardService
    .$widgetContent as WritableSignal<WidgetTableContent>;
  public readonly $checked = computed(
    () =>
      (this.widgetWizardService.$widgetContent() as WidgetTableContent)?.firstColumnAsTitle || false
  );

  public readonly selectedCollection$ = new BehaviorSubject<ValuePathItem | null>(null);

  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;
  public readonly ValuePathType = ValuePathType;

  public readonly collectionDataTooltip$ = toObservable(
    this.widgetWizardService.$widgetContext
  ).pipe(
    switchMap((context: 'case' | 'iko' | null) =>
      this.translateService.stream(
        context === 'iko'
          ? 'ikoManagement.collectionPathTooltip'
          : 'widgetTabManagement.content.table.collectionTooltip'
      )
    )
  );

  private readonly _$contentValid = signal<boolean>(this.widgetWizardService.$editMode());
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly widgetWizardService: WidgetWizardService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private widgetManagementService: IWidgetManagementService<any>
  ) {}

  public ngOnInit(): void {
   this.widgetWizardService.$widgetContentValid.set(false);
    this._subscriptions.add(
      this.form.valueChanges.pipe(debounceTime(500)).subscribe(value => {
        this.widgetWizardService.$widgetTitle.set(value?.title ?? '');
        this.widgetWizardService.$widgetIcon.set(value?.widgetIcon ?? '');

        this.widgetWizardService.$widgetContent.update(
          (content: WidgetContentProperties | null) =>
            ({
              ...content,
              collection: value?.collection || '',
              defaultPageSize: value?.defaultPageSize || 5,
            }) as WidgetTableContent
        );

        this.widgetWizardService.$widgetContentValid.set(this.form.valid && this._$contentValid());
      })
    );
  }

  public ngOnDestroy(): void {
    this._$contentValid.set(false);
    this._subscriptions.unsubscribe();
    this.form.reset();
  }

  public onColumnUpdateEvent(event: {data: FieldsWidgetValue[]; valid: boolean}): void {
    const {data, valid} = event;
    this.widgetWizardService.$widgetContent.update(
      (content: WidgetContentProperties | null) =>
        ({...content, columns: data}) as WidgetTableContent
    );
    this._$contentValid.set(valid);
    this.widgetWizardService.$widgetContentValid.set(valid && this.form.valid);
  }

  public onCheckedChange(firstColumnAsTitle: boolean): void {
    this.widgetWizardService.$widgetContent.update(
      (content: WidgetContentProperties | null) =>
        ({...content, firstColumnAsTitle}) as WidgetTableContent
    );
  }

  public onCollectionSelected(item: ValuePathItem): void {
    this.selectedCollection$.next(item);
  }
}
