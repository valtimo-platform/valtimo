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
  Input,
  Output,
  Signal,
  signal,
  ViewChild,
} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {Edit16, Save16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CARBON_CONSTANTS,
  ConfirmationModalComponent,
  ConfirmationModalModule,
  EditorModel,
  EditorModule,
} from '@valtimo/components';
import {BasicCaseWidget, CaseWidgetsRes} from '@valtimo/dossier';
import {
  ButtonModule,
  IconModule,
  IconService,
  NotificationService,
} from 'carbon-components-angular';
import {BehaviorSubject, Observable, take} from 'rxjs';
import {WidgetJsonEditorService, WidgetTabManagementService} from '../../../services';

@Component({
  selector: 'valtimo-dossier-management-widgets-json-editor',
  templateUrl: './dossier-management-widgets-json-editor.component.html',
  styleUrl: './dossier-management-widgets-json-editor.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    EditorModule,
    ButtonModule,
    IconModule,
    ConfirmationModalModule,
  ],
  providers: [NotificationService],
})
export class DossierManagementWidgetsJsonEditorComponent implements AfterViewInit {
  @ViewChild('pendingChangesModal') public pendingChangesModal: ConfirmationModalComponent;

  private _currentWidgetTab: CaseWidgetsRes;
  @Input() public set currentWidgetTab(value: CaseWidgetsRes) {
    if (!value) return;
    this._currentWidgetTab = value;
    this.jsonModel.set({
      value: JSON.stringify(value),
      language: 'json',
    });
  }

  @Output() public readonly customModalLoaded = new EventEmitter<ConfirmationModalComponent>();
  @Output() public readonly canDeactivate = new EventEmitter<boolean>();
  @Output() public readonly pendingChangesUpdate = new EventEmitter<boolean>();
  @Output() public readonly changeSaved = new EventEmitter();

  public readonly jsonModel = signal<EditorModel | null>(null);
  public readonly editActive = signal<boolean>(false);

  public readonly showPendingModal$: Observable<boolean> = toObservable(
    this.widgetJsonEditorService.showPendingModal
  );
  public readonly showSaveConfirmation$ = new BehaviorSubject<boolean>(false);

  private readonly _widgetConfig = signal<CaseWidgetsRes | null>(null);

  private _editorInit = false;
  private _pendingChanges = false;
  private readonly _jsonValid = signal<boolean>(false);
  private readonly _jsonSchemaInvalid = signal<boolean>(false);
  public readonly saveButtonDisabled: Signal<boolean> = computed(
    () => !this._jsonValid() || this._jsonSchemaInvalid() || !this._widgetConfig()
  );

  constructor(
    private readonly iconService: IconService,
    private readonly notificationService: NotificationService,
    private readonly translateService: TranslateService,
    private readonly widgetJsonEditorService: WidgetJsonEditorService,
    private readonly widgetTabManagementService: WidgetTabManagementService
  ) {
    this.iconService.registerAll([Edit16, Save16]);
  }

  public ngAfterViewInit(): void {
    this.customModalLoaded.emit(this.pendingChangesModal);
  }

  public downloadConfig(): void {
    const dataString =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(this._currentWidgetTab, null, 2));
    const downloadAnchorElement = document.getElementById('downloadAnchorElement');
    if (!downloadAnchorElement) {
      return;
    }

    downloadAnchorElement.setAttribute('href', dataString);
    downloadAnchorElement.setAttribute(
      'download',
      `${this._currentWidgetTab.caseDefinitionName}-widgets.json`
    );
    downloadAnchorElement.click();
  }

  public keepEditing(): void {
    this.widgetJsonEditorService.showPendingModal.set(false);
    this.showSaveConfirmation$.next(false);
    this.canDeactivate.emit(false);
  }

  public discardChanges(): void {
    this.editActive.set(false);
    this.jsonModel.update((model: EditorModel | null) => ({
      ...model,
      value: JSON.stringify(this._currentWidgetTab),
    }));
    this.widgetJsonEditorService.showPendingModal.set(false);
    this.setPendingChanges(false);
    this.canDeactivate.emit(true);
  }

  public save(): void {
    const config: CaseWidgetsRes | null = this._widgetConfig();

    if (!config) return;

    this.widgetTabManagementService
      .updateWidgets(config)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant('interface.success'),
            message: this.translateService.instant('widgetTabManagement.notification.success'),
            showClose: true,
            duration: CARBON_CONSTANTS.notificationDuration,
          });
          this.widgetJsonEditorService.showPendingModal.set(false);
          this.editActive.set(false);
          this.setPendingChanges(false);
          this.changeSaved.emit();
          this.canDeactivate.emit(true);
        },
        error: () => {
          this.notificationService.showNotification({
            type: 'error',
            title: this.translateService.instant('interface.error'),
            message: this.translateService.instant('widgetTabManagement.notification.error'),
            showClose: true,
            duration: CARBON_CONSTANTS.notificationDuration,
          });
        },
      });
  }

  public onCancelClick(): void {
    if (!this._widgetConfig() || !this._pendingChanges) {
      this.editActive.set(false);
      return;
    }

    this.widgetJsonEditorService.showPendingModal.set(true);
  }

  public onEditClick(): void {
    this.editActive.set(true);
  }

  public onSaveClick(): void {
    this.showSaveConfirmation$.next(true);
  }

  public onValidEvent(valid: boolean) {
    this._jsonValid.set(valid);
  }

  public onValueChangeEvent(value: string) {
    if (!this._editorInit) {
      this._editorInit = true;
      return;
    }

    this.setPendingChanges(true);

    const widgetConfig: CaseWidgetsRes = JSON.parse(value);
    const editedWidgetKeys: string[] = widgetConfig.widgets.map(
      (widget: BasicCaseWidget) => widget.key
    );

    this._jsonSchemaInvalid.set(
      widgetConfig.key !== this._currentWidgetTab.key ||
        widgetConfig.caseDefinitionName !== this._currentWidgetTab.caseDefinitionName ||
        new Set(editedWidgetKeys).size !== editedWidgetKeys.length
    );

    if (!this._jsonValid() || !this.editActive()) return;

    this._widgetConfig.set(JSON.parse(value));
  }

  private setPendingChanges(changes: boolean): void {
    this._pendingChanges = changes;
    this.pendingChangesUpdate.emit(changes);

    if (changes) return;

    this._widgetConfig.set(null);
    this._editorInit = false;
  }
}
