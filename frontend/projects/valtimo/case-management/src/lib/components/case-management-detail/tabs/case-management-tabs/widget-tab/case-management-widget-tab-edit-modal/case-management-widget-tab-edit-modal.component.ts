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
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import {AbstractControl, FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  CARBON_CONSTANTS,
  SelectItem,
  SelectModule,
  ValtimoCdsModalDirective,
  WIDGET_LAYOUT_TRANSLATION_KEYS,
  WIDGET_LAYOUT_VALUES,
  WidgetLayout,
  WidgetLayoutInfoComponent,
} from '@valtimo/components';
import {IWidgetManagementService, WIDGET_MANAGEMENT_SERVICE} from '@valtimo/layout';
import {CaseManagementParams} from '@valtimo/shared';
import {TabManagementService, CaseWidgetManagementApiService} from '../../../../../../services';
import {ApiTabItem, ApiTabType} from '@valtimo/case';
import {ButtonModule, InputModule, LayerModule, ModalModule} from 'carbon-components-angular';
import {BehaviorSubject, Observable, Subscription, switchMap, take} from 'rxjs';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-case-management-widget-tab-edit-modal',
  templateUrl: './case-management-widget-tab-edit-modal.html',
  styleUrls: ['./case-management-widget-tab-edit-modal.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ValtimoCdsModalDirective,
    ReactiveFormsModule,
    InputModule,
    ButtonModule,
    LayerModule,
    SelectModule,
    WidgetLayoutInfoComponent,
  ],
})
export class CaseManagementWidgetTabEditModalComponent implements OnInit, OnDestroy {
  @Input() public showModal$: Observable<boolean>;
  @Input() public tabItem: ApiTabItem;
  @Output() public saveEvent = new EventEmitter<any>();

  public readonly open$ = new BehaviorSubject<boolean>(false);
  public readonly disabled$ = new BehaviorSubject<boolean>(false);
  public readonly editWidgetTabForm = this.fb.group({
    name: this.fb.control('', [Validators.required]),
    widgetLayout: this.fb.control<WidgetLayout>(WidgetLayout.MUURI_GAP_FREE),
  });

  public readonly widgetLayoutSelectItems: SelectItem[] = WIDGET_LAYOUT_VALUES.map(value => ({
    id: value,
    translationKey: WIDGET_LAYOUT_TRANSLATION_KEYS[value],
  }));

  public get widgetTabName(): AbstractControl<string | null, string | null> | null {
    return this.editWidgetTabForm.get('name');
  }

  private get _widgetService(): CaseWidgetManagementApiService {
    return this.widgetManagementService as CaseWidgetManagementApiService;
  }

  private _openSubscription!: Subscription;

  constructor(
    private readonly fb: FormBuilder,
    private readonly tabManagementService: TabManagementService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private readonly widgetManagementService: IWidgetManagementService<
      CaseManagementParams & {key: string}
    >
  ) {}

  public ngOnInit(): void {
    this.openOpenSubscription();
  }

  public ngOnDestroy(): void {
    this._openSubscription?.unsubscribe();
  }

  public closeModal(): void {
    this.open$.next(false);

    setTimeout(() => {
      this.editWidgetTabForm.reset();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public saveWidgetTab(): void {
    this.disable();

    const widgetLayout =
      this.editWidgetTabForm.get('widgetLayout')?.value ?? WidgetLayout.MUURI_GAP_FREE;

    this.tabManagementService
      .editTab(
        {
          key: this.tabItem.key,
          name: this.widgetTabName?.value,
          contentKey: '-',
          type: ApiTabType.WIDGETS,
        },
        this.tabItem.key
      )
      .pipe(
        // Refresh the cached widgets first so persisting the layout doesn't
        // overwrite the widget tab with a stale widget list.
        switchMap(() => this._widgetService.getWidgetConfiguration().pipe(take(1))),
        switchMap(() => this._widgetService.updateWidgetLayout(widgetLayout).pipe(take(1)))
      )
      .subscribe(() => {
        this.saveEvent.emit();
        this.closeModal();
      });
  }

  private setEditWidgetTabForm(): void {
    if (this.tabItem) {
      this.widgetTabName?.setValue(this.tabItem.name ?? '');
    }

    this.editWidgetTabForm
      .get('widgetLayout')
      ?.setValue(this._widgetService.widgetLayout$.value);

    this.enable();
  }

  private openOpenSubscription(): void {
    this._openSubscription = this.showModal$.subscribe(show => {
      this.setEditWidgetTabForm();
      this.open$.next(show);
    });
  }

  private disable(): void {
    this.disabled$.next(true);
  }

  private enable(): void {
    this.disabled$.next(false);
  }
}
