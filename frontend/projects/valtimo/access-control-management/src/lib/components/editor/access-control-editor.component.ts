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

import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal} from '@angular/core';
import {AccessControlService} from '../../services/access-control.service';
import {BehaviorSubject, filter, finalize, map, Subscription, switchMap, take, tap} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {
  EditorModel,
  PageHeaderService,
  PageTitleService,
  PendingChangesComponent,
} from '@valtimo/components';
import {AccessControlEditorTab, Permission, Role} from '../../models';
import {TranslateService} from '@ngx-translate/core';
import {AccessControlExportService} from '../../services/access-control-export.service';
import {GlobalNotificationService} from '@valtimo/shared';

@Component({
  standalone: false,
  templateUrl: './access-control-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./access-control-editor.component.scss'],
})
export class AccessControlEditorComponent
  extends PendingChangesComponent
  implements OnInit, OnDestroy
{
  public readonly model$ = new BehaviorSubject<EditorModel | null>(null);
  public readonly permissions$ = new BehaviorSubject<Permission[] | null>(null);
  public readonly roleKey$ = new BehaviorSubject<string | null>(null);
  public readonly saveDisabled$ = new BehaviorSubject<boolean>(true);
  public readonly editorDisabled$ = new BehaviorSubject<boolean>(false);
  public readonly moreDisabled$ = new BehaviorSubject<boolean>(true);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly showEditModal$ = new BehaviorSubject<boolean>(false);
  public readonly selectedRowKeys$ = new BehaviorSubject<Array<string> | null>(null);
  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  public readonly $activeTab = signal<AccessControlEditorTab>(AccessControlEditorTab.SUMMARY);

  protected readonly AccessControlEditorTab = AccessControlEditorTab;

  private _roleKeySubscription!: Subscription;
  private _roleKey!: string;
  private readonly _updatedModelValue$ = new BehaviorSubject<string>('');
  // The form's serialized value captured on (re)load. Edits that differ from it mark the editor
  // dirty so the leave-page guard can warn about unsaved changes.
  private _pendingBaseline: string | null = null;

  constructor(
    private readonly accessControlService: AccessControlService,
    private readonly route: ActivatedRoute,
    private readonly pageTitleService: PageTitleService,
    private readonly router: Router,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly translateService: TranslateService,
    private readonly accessControlExportService: AccessControlExportService,
    private readonly pageHeaderService: PageHeaderService
  ) {
    super();
  }

  public ngOnInit(): void {
    this.restoreActiveTabFromUrl();
    this.getPermissions();
    this.openRoleKeySubscription();
  }

  public ngOnDestroy(): void {
    this.pendingChanges = false;
    this.pageTitleService.enableReset();
    this._roleKeySubscription?.unsubscribe();
  }

  public onValid(valid: boolean): void {
    this.saveDisabled$.next(valid === false);
  }

  public onValueChange(value: string): void {
    // The first emission after a (re)load is the form's serialized baseline; only later emissions
    // that differ from it are genuine unsaved edits.
    if (this._pendingBaseline === null) {
      this._pendingBaseline = value;
      this.pendingChanges = false;
    } else {
      this.pendingChanges = value !== this._pendingBaseline;
    }

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

  public setActiveTab(tab: AccessControlEditorTab): void {
    if (this.$activeTab() === tab) return;

    const roleKey = this.route.snapshot.paramMap.get('id');
    if (!roleKey) {
      this.$activeTab.set(tab);
      return;
    }

    this.router.navigate(this.segmentsForTab(tab, roleKey));
  }

  private segmentsForTab(tab: AccessControlEditorTab, roleKey: string): string[] {
    switch (tab) {
      case AccessControlEditorTab.EDITOR:
        return ['/access-control', roleKey, 'editor'];
      case AccessControlEditorTab.JSON_EDITOR:
        return ['/access-control', roleKey, 'json-editor'];
      default:
        return ['/access-control', roleKey];
    }
  }

  private restoreActiveTabFromUrl(): void {
    const url = this.route.snapshot.url;
    const lastSegment = url[url.length - 1]?.path;
    if (lastSegment === 'editor') {
      this.$activeTab.set(AccessControlEditorTab.EDITOR);
      return;
    }
    if (lastSegment === 'json-editor') {
      this.$activeTab.set(AccessControlEditorTab.JSON_EDITOR);
      return;
    }

    const params = this.route.snapshot.queryParamMap;
    if (params.get('filterResourceType') || params.get('filterAction')) {
      this.$activeTab.set(AccessControlEditorTab.JSON_EDITOR);
    }
  }

  public exportPermissions(): void {
    this.accessControlExportService
      .exportRoles({type: 'separate', roleKeys: [this._roleKey]})
      .subscribe();
  }

  private openRoleKeySubscription(): void {
    this._roleKeySubscription = this.route.params
      .pipe(
        filter(params => params?.id),
        map(params => params.id),
        tap(roleKey => {
          this._roleKey = roleKey;
          this.roleKey$.next(roleKey);
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
          this.roleKey$.next(params?.id ?? null);
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
    // A freshly loaded or saved model is the new clean baseline; the next value emission recaptures
    // it and any prior unsaved-changes flag is cleared.
    this._pendingBaseline = null;
    this.pendingChanges = false;

    const roleKey = this.roleKey$.value ?? 'unknown';
    this.model$.next({
      value: JSON.stringify(permissions),
      language: 'json',
      uri: `inmemory://access-control/role-${roleKey}.access-control-permissions.json`,
    });
    this.permissions$.next(Array.isArray(permissions) ? (permissions as Permission[]) : null);
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
    this.globalNotificationService.showToast({
      title: this.translateService.instant('accessControl.roles.savedSuccessTitle'),
      caption: this.translateService.instant('accessControl.roles.savedSuccessTitleMessage', {
        roleKey,
      }),
      type: 'success',
    });
  }
}
