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
import {ScriptService} from '../../services/script.service';
import {BehaviorSubject, filter, finalize, map, Subscription, switchMap, take, tap} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {EditorModel, PageTitleService} from '@valtimo/components';
import {Script} from '../../models';
import {NotificationService} from 'carbon-components-angular';
import {TranslateService} from '@ngx-translate/core';

@Component({
  templateUrl: './script-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./script-editor.component.scss'],
  providers: [NotificationService],
})
export class ScriptEditorComponent implements OnInit, OnDestroy {
  public readonly model$ = new BehaviorSubject<EditorModel | null>(null);
  public readonly saveDisabled$ = new BehaviorSubject<boolean>(true);
  public readonly editorDisabled$ = new BehaviorSubject<boolean>(false);
  public readonly moreDisabled$ = new BehaviorSubject<boolean>(true);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly showEditModal$ = new BehaviorSubject<boolean>(false);
  public readonly selectedRowKeys$ = new BehaviorSubject<Array<string> | null>(null);

  private _scriptKeySubscription!: Subscription;
  private _scriptKey!: string;
  private readonly _updatedModelValue$ = new BehaviorSubject<string>('');

  constructor(
    private readonly scriptService: ScriptService,
    private readonly route: ActivatedRoute,
    private readonly pageTitleService: PageTitleService,
    private readonly router: Router,
    private readonly notificationService: NotificationService,
    private readonly translateService: TranslateService,
  ) {}

  public ngOnInit(): void {
    this.getPermissions();
    this.openScriptKeySubscription();
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
    this._scriptKeySubscription?.unsubscribe();
  }

  public onValid(valid: boolean): void {
    this.saveDisabled$.next(valid === false);
  }

  public onValueChange(value: string): void {
    this._updatedModelValue$.next(value);
  }

  public updatePermissions(): void {
    this.disableEditor();
    this.disableSave();
    this.disableMore();

    this._updatedModelValue$
      .pipe(
        take(1),
        switchMap(updatedModelValue =>
          this.scriptService.updateScriptContent(
            this._scriptKey,
            updatedModelValue
          )
        )
      )
      .subscribe({
        next: result => {
          this.enableMore();
          this.enableSave();
          this.enableEditor();
          this.showSuccessMessage(this._scriptKey);
          this.setModel(result.content);
        },
        error: () => {
          this.enableMore();
          this.enableSave();
          this.enableEditor();
        },
      });
  }

  public onDelete(scripts: Array<string>): void {
    this.disableEditor();
    this.disableSave();
    this.disableMore();

    this.scriptService.dispatchAction(
      this.scriptService.deleteScripts({scripts}).pipe(
        finalize(() => {
          this.router.navigate(['/script']);
        })
      )
    );
  }

  public showDeleteModal(): void {
    this.showDeleteModal$.next(true);
  }

  private openScriptKeySubscription(): void {
    this._scriptKeySubscription = this.route.params
      .pipe(
        filter(params => params?.id),
        map(params => params.id),
        tap(key => {
          this._scriptKey = key;
          this.pageTitleService.setCustomPageTitle(key, true);
          this.selectedRowKeys$.next([key]);
        }),
        switchMap(key => this.scriptService.getScriptContent(key)),
        tap(result => {
          this.enableMore();
          this.enableSave();
          this.enableEditor();
          this.setModel(result.content);
        })
      )
      .subscribe();
  }

  private getPermissions(): void {
    this.route.params
      .pipe(
        tap(params => {
          this.pageTitleService.setCustomPageTitle(params?.id);
          this.selectedRowKeys$.next([params?.id]);
        }),
        switchMap(params => this.scriptService.getScriptContent(params.id))
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
      language: 'javascript',
    });
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
      caption: this.translateService.instant('script.savedSuccessTitleMessage', {
        key,
      }),
      type: 'success',
      duration: 4000,
      showClose: true,
      title: this.translateService.instant('script.savedSuccessTitle'),
    });
  }
}
