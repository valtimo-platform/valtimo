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

import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {FormFlowService} from '../../services/form-flow.service';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  finalize,
  map,
  Observable,
  of,
  startWith,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {EditorModel, PageHeaderService, PageTitleService} from '@valtimo/components';
import {FormFlowDefinition, FormFlowDefinitionId, LoadedValue} from '../../models';
import {NotificationService} from 'carbon-components-angular';
import {TranslateService} from '@ngx-translate/core';
import {FormFlowDownloadService} from '../../services/form-flow-download.service';
import {ListItem} from 'carbon-components-angular/dropdown';
import formFlowSchemaJson from './formflow.schema.json';

@Component({
  templateUrl: './form-flow-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./form-flow-editor.component.scss'],
  providers: [NotificationService],
})
export class FormFlowEditorComponent implements OnInit, OnDestroy {
  public readonly model$ = new BehaviorSubject<EditorModel | null>(null);
  public readonly readOnly$ = new BehaviorSubject<boolean>(false);
  public readonly valid$ = new BehaviorSubject<boolean>(false);
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly formFlowDefinitionVersions$ = new BehaviorSubject<Array<number>>([1]);
  public readonly formFlowDefinitionId$ = new BehaviorSubject<FormFlowDefinitionId | null>(null);
  private _idSubscription!: Subscription;
  private _definitionSubscription!: Subscription;
  public readonly CARBON_THEME = 'g10';

  public readonly formFlowSchemaJson = formFlowSchemaJson;

  private readonly _updatedModelValue$ = new BehaviorSubject<string>('');

  public readonly formFlowDefinitionVersionItems$: Observable<LoadedValue<Array<ListItem>>> =
    combineLatest([this.formFlowDefinitionVersions$, this.formFlowDefinitionId$]).pipe(
      filter(([versions, formFlowDefinitionId]) => !!versions && !!formFlowDefinitionId),
      map(([versions, formFlowDefinitionId]) =>
        versions.map(
          version =>
            ({
              formFlowDefinitionId: {
                key: formFlowDefinitionId.key,
                version,
              } as FormFlowDefinitionId,
              content: `${this.translateService.instant('formFlow.version')}: ${version}`,
              selected: version === formFlowDefinitionId.version,
            }) as ListItem
        )
      ),
      map(formFlowDefinitionVersionItems => ({
        value: formFlowDefinitionVersionItems,
        isLoading: false,
      })),
      startWith({isLoading: true})
    );
  public readonly formFlowDefinition$: Observable<FormFlowDefinition> =
    this.formFlowDefinitionId$.pipe(
      filter(id => !!id),
      switchMap(id => this.formFlowService.getFormFlowDefinition(id))
    );

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  constructor(
    private readonly formFlowService: FormFlowService,
    private readonly route: ActivatedRoute,
    private readonly pageTitleService: PageTitleService,
    private readonly router: Router,
    private readonly notificationService: NotificationService,
    private readonly translateService: TranslateService,
    private readonly formFlowDownloadService: FormFlowDownloadService,
    private readonly pageHeaderService: PageHeaderService
  ) {}

  public ngOnInit(): void {
    this.formFlowService.loadFormFlows();
    this.openFormFlowDefinitionSubscription();
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
    this._idSubscription?.unsubscribe();
    this._definitionSubscription?.unsubscribe();
  }

  public onValid(valid: boolean): void {
    this.valid$.next(valid !== false);
  }

  public onValueChange(value: string): void {
    this._updatedModelValue$.next(value);
  }

  public updateFormFlowDefinition(): void {
    this.loading$.next(true);

    combineLatest([this._updatedModelValue$, this.formFlowDefinitionId$])
      .pipe(
        take(1),
        map(([updatedModelValue, formFlowDefinitionId]) => ({
          ...(JSON.parse(updatedModelValue) as FormFlowDefinition),
          key: formFlowDefinitionId.key,
          version: this.formFlowDefinitionVersions$.value[0] + 1,
        })),
        switchMap(updatedFormFlowDefinition =>
          this.formFlowService.updateFormFlowDefinition(
            updatedFormFlowDefinition.key,
            updatedFormFlowDefinition
          )
        )
      )
      .subscribe({
        next: result => {
          const id = {key: result.key, version: result.version};
          this.showSuccessMessage(result.key);
          this.formFlowDefinitionId$.next(id);
          this.formFlowDefinitionVersions$.next(
            [id.version].concat(this.formFlowDefinitionVersions$.value)
          );
        },
        error: () => {
          this.loading$.next(false);
        },
      });
  }

  public onDelete(formFlowDefinitionKey: string): void {
    this.loading$.next(true);
    this.formFlowService.dispatchAction(
      this.formFlowService.deleteFormFlowDefinition(formFlowDefinitionKey).pipe(
        finalize(() => {
          this.router.navigate(['/form-flow-management']);
        })
      )
    );
  }

  public showDeleteModal(): void {
    this.showDeleteModal$.next(true);
  }

  public downloadFormFlowDefinition(model: EditorModel): void {
    this.formFlowDefinitionId$.subscribe(formFlowDefinitionId =>
      this.formFlowDownloadService.downloadJson(JSON.parse(model.value), formFlowDefinitionId)
    );
  }

  public loadFormFlowDefinitionId(formFlowDefinitionId?: FormFlowDefinitionId) {
    if (!!formFlowDefinitionId) {
      this.formFlowDefinitionId$.next(formFlowDefinitionId);
    }
  }

  private openFormFlowDefinitionSubscription(): void {
    this.loading$.next(true);

    this._idSubscription = this.route.params
      .pipe(
        filter(params => params?.key),
        map(params => params.key),
        switchMap(key =>
          combineLatest([
            of(key),
            this.formFlowService.formFlows$.pipe(
              map(
                formFlowDefinitions =>
                  formFlowDefinitions.find(definition => definition.key === key)?.versions
              ),
              filter(versions => !!versions),
              take(1),
              tap(versions => this.formFlowDefinitionVersions$.next(versions))
            ),
          ])
        ),
        map(([key, versions]) => ({key, version: versions[0]}) as FormFlowDefinitionId)
      )
      .subscribe(formFlowDefinitionId => {
        this.pageTitleService.setCustomPageTitle(formFlowDefinitionId.key);
        this.formFlowDefinitionId$.next(formFlowDefinitionId);
      });

    this._definitionSubscription = this.formFlowDefinition$.pipe().subscribe(formFlowDefinition => {
      this.readOnly$.next(formFlowDefinition.readOnly === true);
      this.setModel(formFlowDefinition);
    });
  }

  private setModel(formFlowDefinition: FormFlowDefinition): void {
    const clone = {...formFlowDefinition};
    delete clone.version;
    delete clone.readOnly;
    this.model$.next({
      value: JSON.stringify(clone),
      language: 'json',
      uri: formFlowDefinition.key + '-' + formFlowDefinition.version + '.formflow.json',
    });
    this.loading$.next(false);
  }

  private showSuccessMessage(key: string): void {
    this.notificationService.showToast({
      caption: this.translateService.instant('formFlow.savedSuccessTitleMessage', {
        key,
      }),
      type: 'success',
      duration: 4000,
      showClose: true,
      title: this.translateService.instant('formFlow.savedSuccessTitle'),
    });
  }
}
