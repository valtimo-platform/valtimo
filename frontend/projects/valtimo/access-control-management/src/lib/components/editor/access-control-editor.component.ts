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
import {AccessControlService} from '../../services/access-control.service';
import {BehaviorSubject, filter, finalize, map, Subscription, switchMap, take, tap} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {EditorModel, PageHeaderService, PageTitleService} from '@valtimo/components';
import {Role} from '../../models';
import {NotificationService} from 'carbon-components-angular';
import {TranslateService} from '@ngx-translate/core';
import {AccessControlExportService} from '../../services/access-control-export.service';

@Component({
  templateUrl: './access-control-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./access-control-editor.component.scss'],
  providers: [NotificationService],
})
export class AccessControlEditorComponent implements OnInit, OnDestroy {
  public readonly model$ = new BehaviorSubject<EditorModel | null>(null);
  public readonly saveDisabled$ = new BehaviorSubject<boolean>(true);
  public readonly editorDisabled$ = new BehaviorSubject<boolean>(false);
  public readonly moreDisabled$ = new BehaviorSubject<boolean>(true);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly showEditModal$ = new BehaviorSubject<boolean>(false);
  public readonly selectedRowKeys$ = new BehaviorSubject<Array<string> | null>(null);
  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  private _roleKeySubscription!: Subscription;
  private _roleKey!: string;
  private readonly _updatedModelValue$ = new BehaviorSubject<string>('');

  constructor(
    private readonly accessControlService: AccessControlService,
    private readonly route: ActivatedRoute,
    private readonly pageTitleService: PageTitleService,
    private readonly router: Router,
    private readonly notificationService: NotificationService,
    private readonly translateService: TranslateService,
    private readonly accessControlExportService: AccessControlExportService,
    private readonly pageHeaderService: PageHeaderService
  ) {}

  public ngOnInit(): void {
    this.getPermissions();
    this.openRoleKeySubscription();
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
    this._roleKeySubscription?.unsubscribe();
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
          this.accessControlService.updateRolePermissions(
            this._roleKey,
            JSON.parse(updatedModelValue)
          )
        )
      )
      .subscribe({
        next: result => {
          this.enableMore();
          this.enableSave();
          this.enableEditor();
          this.showSuccessMessage(this._roleKey);
          this.setModel(result);
        },
        error: () => {
          this.enableMore();
          this.enableSave();
          this.enableEditor();
        },
      });
  }

  public onDelete(roles: Array<string>): void {
    this.disableEditor();
    this.disableSave();
    this.disableMore();

    this.accessControlService.dispatchAction(
      this.accessControlService.deleteRoles({roles}).pipe(
        finalize(() => {
          this.router.navigate(['/access-control']);
        })
      )
    );
  }

  public showDeleteModal(): void {
    this.showDeleteModal$.next(true);
  }

  public showEditModal(): void {
    this.showEditModal$.next(true);
  }

  public onEdit(currentRoleKey: string, data: Role | null): void {
    this.showEditModal$.next(false);

    if (!data) {
      return;
    }

    this.disableEditor();
    this.disableSave();
    this.disableMore();

    this.accessControlService.updateRole(currentRoleKey, data).subscribe(() => {
      this.router.navigate([`/access-control/${data.roleKey}`]);
      this.showSuccessMessage(data.roleKey);
    });
  }

  public exportPermissions(): void {
    this.accessControlExportService.exportRoles({type: 'separate', roleKeys: [this._roleKey]}).subscribe()
  }

  private openRoleKeySubscription(): void {
    this._roleKeySubscription = this.route.params
      .pipe(
        filter(params => params?.id),
        map(params => params.id),
        tap(roleKey => {
          this._roleKey = roleKey;
          this.pageTitleService.setCustomPageTitle(roleKey, true);
          this.selectedRowKeys$.next([roleKey]);
        }),
        switchMap(roleKey => this.accessControlService.getRolePermissions(roleKey)),
        tap(permissions => {
          this.enableMore();
          this.enableSave();
          this.enableEditor();
          this.setModel(permissions);
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
        switchMap(params => this.accessControlService.getRolePermissions(params.id))
      )
      .subscribe(permissions => {
        this.enableMore();
        this.enableSave();
        this.enableEditor();
        this.setModel(permissions);
      });
  }

  private setModel(permissions: object): void {
    this.model$.next({
      value: JSON.stringify(permissions),
      language: 'json',
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

  private showSuccessMessage(roleKey: string): void {
    this.notificationService.showToast({
      caption: this.translateService.instant('accessControl.roles.savedSuccessTitleMessage', {
        roleKey,
      }),
      type: 'success',
      duration: 4000,
      showClose: true,
      title: this.translateService.instant('accessControl.roles.savedSuccessTitle'),
    });
  }
}
