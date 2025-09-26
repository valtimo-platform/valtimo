/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {TemplateService} from '../../services/template.service';
import {BehaviorSubject, filter, finalize, map, Subscription, switchMap, take, tap} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {EditorModel, PageTitleService} from '@valtimo/components';
import {NotificationService} from 'carbon-components-angular';
import {TranslateService} from '@ngx-translate/core';

@Component({
  templateUrl: './template-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./template-editor.component.scss'],
  providers: [NotificationService],
})
export class TemplateEditorComponent implements OnInit, OnDestroy {
  public readonly model$ = new BehaviorSubject<EditorModel | null>(null);
  public readonly saveDisabled$ = new BehaviorSubject<boolean>(true);
  public readonly editorDisabled$ = new BehaviorSubject<boolean>(false);
  public readonly moreDisabled$ = new BehaviorSubject<boolean>(true);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly selectedRowKeys$ = new BehaviorSubject<Array<string> | null>(null);
  public readonly updatedModelValue$ = new BehaviorSubject<string>('');

  private _templateKeySubscription!: Subscription;
  private _templateKey!: string;

  constructor(
    private readonly templateService: TemplateService,
    private readonly route: ActivatedRoute,
    private readonly pageTitleService: PageTitleService,
    private readonly router: Router,
    private readonly notificationService: NotificationService,
    private readonly translateService: TranslateService,
  ) {}

  public ngOnInit(): void {
    this.getTemplates();
    this.openTemplateKeySubscription();
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
    this._templateKeySubscription?.unsubscribe();
  }

  public onValid(valid: boolean): void {
    this.saveDisabled$.next(valid === false);
  }

  public onValueChange(value: string): void {
    this.updatedModelValue$.next(value);
  }

  public updateTemplate(): void {
    this.disableEditor();
    this.disableSave();
    this.disableMore();

    this.updatedModelValue$
      .pipe(
        take(1),
        switchMap(updatedModelValue =>
          this.templateService.updateTemplate(
            this._templateKey,
            updatedModelValue
          )
        )
      )
      .subscribe({
        next: result => {
          this.enableMore();
          this.enableSave();
          this.enableEditor();
          this.showSuccessMessage(this._templateKey);
          this.setModel(result.content);
        },
        error: () => {
          this.enableMore();
          this.enableSave();
          this.enableEditor();
        },
      });
  }

  public onDelete(templates: Array<string>): void {
    this.disableEditor();
    this.disableSave();
    this.disableMore();

    this.templateService.dispatchAction(
      this.templateService.deleteTemplates({templates}).pipe(
        finalize(() => {
          this.router.navigate(['/template']);
        })
      )
    );
  }

  public showDeleteModal(): void {
    this.showDeleteModal$.next(true);
  }

  private openTemplateKeySubscription(): void {
    this._templateKeySubscription = this.route.params
      .pipe(
        filter(params => params?.id),
        map(params => params.id),
        tap(key => {
          this._templateKey = key;
          this.pageTitleService.setCustomPageTitle(key, true);
          this.selectedRowKeys$.next([key]);
        }),
        switchMap(key => this.templateService.getTemplate(key)),
        tap(result => {
          this.enableMore();
          this.enableSave();
          this.enableEditor();
          this.setModel(result.content);
        })
      )
      .subscribe();
  }

  private getTemplates(): void {
    this.route.params
      .pipe(
        tap(params => {
          this.pageTitleService.setCustomPageTitle(params?.id);
          this.selectedRowKeys$.next([params?.id]);
        }),
        switchMap(params => this.templateService.getTemplate(params.id))
      )
      .subscribe(result => {
        this.enableMore();
        this.enableSave();
        this.enableEditor();
        this.setModel(result.content);
      });
  }

  private setModel(content: string): void {
    this.model$.next({
      value: content,
      language: 'freemarker2',
    });
    this.updatedModelValue$.next(content);
  }

  private disableMore(): void {
    this.moreDisabled$.next(true);
  }

  private enableMore(): void {
    this.moreDisabled$.next(false);
  }

  private disableSave(): void {
    this.saveDisabled$.next(true);
  }

  private enableSave(): void {
    this.saveDisabled$.next(false);
  }

  private disableEditor(): void {
    this.editorDisabled$.next(true);
  }

  private enableEditor(): void {
    this.editorDisabled$.next(false);
  }

  private showSuccessMessage(key: string): void {
    this.notificationService.showToast({
      caption: this.translateService.instant('template.savedSuccessTitleMessage', {
        key,
      }),
      type: 'success',
      duration: 4000,
      showClose: true,
      title: this.translateService.instant('template.savedSuccessTitle'),
    });
  }
}
