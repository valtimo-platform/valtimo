/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {AbstractControl, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {TranslateService} from '@ngx-translate/core';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {
  PluginConfiguration,
  PluginManagementService,
  PluginTranslationService,
} from '@valtimo/plugin';
import {FileItem, ListItem} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  Observable,
  Subscription,
  take,
} from 'rxjs';
import {
  IMPORT_WARNING,
  STEPS,
  UPLOAD_STATUS,
  UPLOAD_STEP,
} from './case-management-upload.constants';
import {CaseManagementService} from '../../services';
import {CASE_MANAGEMENT_UPLOAD_TEST_IDS} from '../../constants';
import {
  CaseDefinitionImportPreview,
  PluginConfigurationPreview,
} from '../../models/case-deployment.model';

type PluginMappingStatus = 'available' | 'no-configurations' | 'not-installed';

interface PluginMappingRow {
  pluginDefinitionKey: string | null;
  pluginDefinitionTitle: string;
  sourcePluginConfigurationId: string;
  existsInTargetEnvironment: boolean;
  listItems: ListItem[];
  status: PluginMappingStatus;
}

@Component({
  standalone: false,
  selector: 'valtimo-case-management-upload',
  templateUrl: './case-management-upload.component.html',
  styleUrls: ['./case-management-upload.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseManagementUploadComponent implements OnInit, OnDestroy {
  @Input() open = false;
  @Output() closeModal = new EventEmitter<boolean>();

  protected readonly testIds = CASE_MANAGEMENT_UPLOAD_TEST_IDS;

  public acceptedFiles: string[] = ['.zip'];

  public readonly UPLOAD_STEP = UPLOAD_STEP;
  public readonly UPLOAD_STATUS = UPLOAD_STATUS;
  public readonly IMPORT_WARNING = IMPORT_WARNING;

  private readonly _disabled$ = new BehaviorSubject<boolean>(true);

  public readonly activeStep$ = new BehaviorSubject<UPLOAD_STEP>(UPLOAD_STEP.FILE_SELECT);
  public readonly uploadStatus$ = new BehaviorSubject<UPLOAD_STATUS>(UPLOAD_STATUS.ACTIVE);
  public readonly preview$ = new BehaviorSubject<CaseDefinitionImportPreview | null>(null);
  public readonly importWarning$ = new BehaviorSubject<IMPORT_WARNING>(IMPORT_WARNING.NONE);
  public readonly overrideConfirmed$ = new BehaviorSubject<boolean>(false);
  public readonly pluginMappingRows$ = new BehaviorSubject<PluginMappingRow[]>([]);
  public readonly hasUnidentifiablePlugins$ = new BehaviorSubject<boolean>(false);

  public readonly backButtonEnabled$: Observable<boolean> = this.activeStep$.pipe(
    map((activeStep: UPLOAD_STEP) =>
      [
        UPLOAD_STEP.CONFIGURE,
        UPLOAD_STEP.PLUGINS,
        UPLOAD_STEP.ACCESS_CONTROL,
        UPLOAD_STEP.DASHBOARD,
      ].includes(activeStep)
    )
  );

  public readonly isStepAfterUpload$: Observable<boolean> = this.activeStep$.pipe(
    map(
      (activeStep: UPLOAD_STEP) =>
        ![UPLOAD_STEP.FILE_SELECT, UPLOAD_STEP.CONFIGURE, UPLOAD_STEP.PLUGINS].includes(activeStep)
    )
  );

  public readonly showCloseButton$: Observable<boolean> = this.activeStep$.pipe(
    map((activeStep: UPLOAD_STEP) =>
      [
        UPLOAD_STEP.FILE_SELECT,
        UPLOAD_STEP.CONFIGURE,
        UPLOAD_STEP.PLUGINS,
        UPLOAD_STEP.FILE_UPLOAD,
      ].includes(activeStep)
    )
  );

  public readonly nextButtonDisabled$: Observable<boolean> = combineLatest([
    this.activeStep$,
    this._disabled$,
    this.importWarning$,
    this.overrideConfirmed$,
  ]).pipe(
    map(([activeStep, disabled, warning, overrideConfirmed]) => {
      if (activeStep === UPLOAD_STEP.CONFIGURE) {
        if (warning === IMPORT_WARNING.EXISTING_FINAL) return true;
        if (warning === IMPORT_WARNING.EXISTING_DRAFT && !overrideConfirmed) return true;
        return this.configureForm.invalid;
      }
      if (activeStep === UPLOAD_STEP.PLUGINS) return false;
      return disabled;
    })
  );

  public form: FormGroup = this.fb.group({
    file: this.fb.control(new Set<any>(), [Validators.required]),
  });

  public configureForm: FormGroup = this.fb.group({
    name: this.fb.control('', Validators.required),
    caseDefinitionKey: this.fb.control('', Validators.required),
  });

  public pluginMappingForm: FormGroup = this.fb.group({});

  public get nameControl(): AbstractControl {
    return this.configureForm.get('name');
  }

  private readonly _importFile$ = new BehaviorSubject<FormData | null>(null);
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly caseManagementService: CaseManagementService,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly pluginTranslationService: PluginTranslationService
  ) {}

  public ngOnInit(): void {
    const control: AbstractControl | null = this.form.get('file');
    if (!control) {
      return;
    }

    this._subscriptions.add(
      this.form.get('file').valueChanges.subscribe((fileSet: Set<FileItem>) => {
        const [fileItem] = fileSet;
        if (!fileItem) {
          this._disabled$.next(true);
          if (this.activeStep$.value === UPLOAD_STEP.FILE_SELECT) {
            this.preview$.next(null);
          }
          return;
        }

        this.setZipFile(fileItem);
      })
    );

    this._subscriptions.add(
      this.configureForm
        .get('caseDefinitionKey')
        .valueChanges.pipe(debounceTime(400), distinctUntilChanged())
        .subscribe((key: string) => {
          this.checkExistingVersions(key);
        })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.resetModal();
  }

  public onCloseModal(definitionUploaded?: boolean): void {
    this.closeModal.emit(definitionUploaded ?? false);
    this.resetModal();
  }

  public onBackClick(activeStep: UPLOAD_STEP): void {
    const prevIndex: number = STEPS.findIndex((step: UPLOAD_STEP) => step === activeStep) - 1;
    if (prevIndex === -1) {
      return;
    }

    this.activeStep$.next(STEPS[prevIndex]);
  }

  public onNextClick(activeStep: UPLOAD_STEP): void {
    const nextIndex: number = STEPS.findIndex((step: UPLOAD_STEP) => step === activeStep) + 1;
    if (nextIndex === STEPS.length) {
      return;
    }

    this.activeStep$.next(STEPS[nextIndex]);
    if (STEPS[nextIndex] !== UPLOAD_STEP.FILE_UPLOAD) {
      return;
    }

    this.uploadDefinition();
  }

  public trackBySourceId(_index: number, row: PluginMappingRow): string {
    return row.sourcePluginConfigurationId;
  }

  /**
   * Works around a carbon-components-angular bug where clearing a single-select
   * cds-combo-box with itemValueKey set writes `[]` to the FormControl instead
   * of `null` (see combobox.component clearSelected).
   */
  public onPluginMappingClear(sourceId: string): void {
    this.pluginMappingForm.get(sourceId)?.setValue(null);
  }

  private setZipFile(fileItem: FileItem): void {
    const file = fileItem?.file;

    if (!file) {
      this._importFile$.next(null);
      this.preview$.next(null);
      return;
    }

    const blob = new Blob([file], {type: file.type});
    const fd = new FormData();
    fd.append('file', blob, file.name);
    this._importFile$.next(fd);

    this.caseManagementService
      .previewImport(fd)
      .pipe(take(1))
      .subscribe({
        next: preview => {
          this.preview$.next(preview);
          this.configureForm.patchValue({
            name: preview.name,
            caseDefinitionKey: preview.key,
          });
          this._disabled$.next(false);
          this.checkExistingVersions(preview.key);
          this.loadPluginMappingRows(preview.pluginConfigurations || []);
        },
        error: () => {
          this._disabled$.next(true);
          fileItem.invalid = true;
          fileItem.invalidTitle = this.translateService.instant(
            'caseManagement.importDefinition.invalidZipError.title'
          );
          fileItem.invalidText = this.translateService.instant(
            'caseManagement.importDefinition.invalidZipError.text'
          );
        },
      });
  }

  private loadPluginMappingRows(pluginConfigs: PluginConfigurationPreview[]): void {
    const uniqueById = new Map<string, PluginConfigurationPreview>();
    for (const config of pluginConfigs) {
      if (!uniqueById.has(config.pluginConfigurationId)) {
        uniqueById.set(config.pluginConfigurationId, config);
      }
    }

    const allConfigs = Array.from(uniqueById.values());

    // Configs with a known key can be mapped in the UI.
    // Configs without a key but with a matching UUID in the target are fine as-is.
    // Configs without a key and without a matching UUID are unidentifiable.
    const hasUnidentifiable = allConfigs.some(
      c => c.pluginDefinitionKey === null && !c.existsInTargetEnvironment
    );
    this.hasUnidentifiablePlugins$.next(hasUnidentifiable);

    const uniqueConfigs = allConfigs.filter(c => c.pluginDefinitionKey !== null);
    if (uniqueConfigs.length === 0) {
      this.pluginMappingRows$.next([]);
      return;
    }

    // Fetch all installed plugin definitions first, then configs per key
    this.pluginManagementService
      .getPluginDefinitions()
      .pipe(take(1))
      .subscribe(definitions => {
        const installedKeys = new Set(definitions.map(d => d.key));
        this.loadPluginConfigurations(uniqueConfigs, installedKeys);
      });
  }

  private loadPluginConfigurations(
    uniqueConfigs: PluginConfigurationPreview[],
    installedKeys: Set<string>
  ): void {
    const uniqueDefinitionKeys = [
      ...new Set(uniqueConfigs.map(c => c.pluginDefinitionKey).filter(Boolean)),
    ];

    const installableKeys = uniqueDefinitionKeys.filter(k => installedKeys.has(k));

    if (installableKeys.length === 0) {
      this.buildMappingRows(uniqueConfigs, new Map(), installedKeys);
      return;
    }

    const configRequests: Record<string, Observable<PluginConfiguration[]>> = {};
    for (const key of installableKeys) {
      configRequests[key] = this.pluginManagementService
        .getPluginConfigurationsByPluginDefinitionKey(key)
        .pipe(take(1));
    }

    forkJoin(configRequests)
      .pipe(take(1))
      .subscribe(results => {
        const configsByKey = new Map<string, PluginConfiguration[]>(Object.entries(results));
        this.buildMappingRows(uniqueConfigs, configsByKey, installedKeys);
      });
  }

  private buildMappingRows(
    uniqueConfigs: PluginConfigurationPreview[],
    configsByKey: Map<string, PluginConfiguration[]>,
    installedKeys: Set<string>
  ): void {
    this.clearPluginMappingForm();
    const rows: PluginMappingRow[] = uniqueConfigs.map(config => {
      const key = config.pluginDefinitionKey;
      const isInstalled = key ? installedKeys.has(key) : false;
      const available = configsByKey.get(key) || [];
      const defaultSelectionId = config.existsInTargetEnvironment
        ? config.pluginConfigurationId
        : null;

      let status: PluginMappingStatus;
      if (!isInstalled) {
        status = 'not-installed';
      } else if (available.length === 0) {
        status = 'no-configurations';
      } else {
        status = 'available';
      }

      const listItems: ListItem[] = available.map(c => ({
        content: c.title,
        id: c.id,
        selected: c.id === defaultSelectionId,
      }));

      if (status === 'available') {
        this.pluginMappingForm.addControl(
          config.pluginConfigurationId,
          this.fb.control(defaultSelectionId)
        );
      }

      return {
        pluginDefinitionKey: key,
        pluginDefinitionTitle: this.getPluginTitle(key),
        sourcePluginConfigurationId: config.pluginConfigurationId,
        existsInTargetEnvironment: config.existsInTargetEnvironment,
        listItems,
        status,
      };
    });
    this.pluginMappingRows$.next(rows);
  }

  private clearPluginMappingForm(): void {
    for (const key of Object.keys(this.pluginMappingForm.controls)) {
      this.pluginMappingForm.removeControl(key);
    }
  }

  private getPluginTitle(pluginDefinitionKey: string | null): string {
    if (!pluginDefinitionKey) {
      return this.translateService.instant('caseManagement.importDefinition.plugins.unknownPlugin');
    }
    const translated = this.pluginTranslationService.instant('title', pluginDefinitionKey);
    // If translation returns the fallback format "key.title", use the raw key instead
    if (translated === `${pluginDefinitionKey}.title`) {
      return pluginDefinitionKey;
    }
    return translated;
  }

  private checkExistingVersions(key: string): void {
    if (!key) {
      this.importWarning$.next(IMPORT_WARNING.NONE);
      return;
    }

    this.caseManagementService
      .getCaseDefinitionVersions(key)
      .pipe(take(1))
      .subscribe({
        next: versions => this.determineWarning(versions),
        error: () => this.importWarning$.next(IMPORT_WARNING.NONE),
      });
  }

  private determineWarning(versions: any[]): void {
    const preview = this.preview$.value;
    if (!preview || versions.length === 0) {
      this.importWarning$.next(IMPORT_WARNING.NONE);
      return;
    }

    const matchingVersion = versions.find(v => v.versionTag === preview.versionTag);
    if (!matchingVersion) {
      this.importWarning$.next(IMPORT_WARNING.NEW_VERSION);
      return;
    }

    if (matchingVersion.final) {
      this.importWarning$.next(IMPORT_WARNING.EXISTING_FINAL);
      return;
    }

    this.importWarning$.next(IMPORT_WARNING.EXISTING_DRAFT);
    this.overrideConfirmed$.next(false);
  }

  private uploadDefinition(): void {
    this._disabled$.next(true);
    const file = this._importFile$.value;
    if (!file) return;

    const {name, caseDefinitionKey} = this.configureForm.getRawValue();
    const preview = this.preview$.value;

    const keyChanged = caseDefinitionKey !== preview?.key;
    const nameChanged = name !== preview?.name;
    const hasOverrides = keyChanged || nameChanged;

    const mappings = this.buildPluginConfigurationMappings();

    this.caseManagementService
      .importDocumentDefinitionZip(
        file,
        hasOverrides ? caseDefinitionKey : undefined,
        hasOverrides ? name : undefined,
        Object.keys(mappings).length > 0 ? mappings : undefined
      )
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._disabled$.next(false);
          this.uploadStatus$.next(UPLOAD_STATUS.FINISHED);
        },
        error: () => {
          this.uploadStatus$.next(UPLOAD_STATUS.ERROR);
          this._disabled$.next(false);
        },
      });
  }

  private buildPluginConfigurationMappings(): Record<string, string | null> {
    const mappings: Record<string, string | null> = {};
    for (const row of this.pluginMappingRows$.value) {
      if (row.status === 'available') {
        const control = this.pluginMappingForm.get(row.sourcePluginConfigurationId);
        mappings[row.sourcePluginConfigurationId] = control?.value ?? null;
      } else {
        mappings[row.sourcePluginConfigurationId] = null;
      }
    }
    return mappings;
  }

  private resetModal(): void {
    setTimeout(() => {
      this.activeStep$.next(UPLOAD_STEP.FILE_SELECT);
      this.uploadStatus$.next(UPLOAD_STATUS.ACTIVE);
      this.form.reset({file: new Set<any>()});
      this.configureForm.reset();
      this._importFile$.next(null);
      this._disabled$.next(true);
      this.preview$.next(null);
      this.importWarning$.next(IMPORT_WARNING.NONE);
      this.overrideConfirmed$.next(false);
      this.pluginMappingRows$.next([]);
      this.hasUnidentifiablePlugins$.next(false);
      this.clearPluginMappingForm();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
