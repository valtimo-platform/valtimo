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

import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {Filter16, TrashCan16} from '@carbon/icons';
import {EditorModel, EditorModule, OverflowMenuComponent} from '@valtimo/components';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  IconService,
  ListItem,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, skip, Subscription, take} from 'rxjs';
import {AccessControlFilter, Permission, PermissionSchema} from '../../models';
import {PermissionSchemaMetadataService} from '../../services';
import {formatResourceType} from '../../utils';

@Component({
  standalone: true,
  selector: 'valtimo-access-control-json-editor-tab',
  templateUrl: './access-control-json-editor-tab.component.html',
  styleUrls: ['./access-control-json-editor-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    DropdownModule,
    EditorModule,
    IconModule,
    OverflowMenuComponent,
  ],
})
export class AccessControlJsonEditorTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() public disabled: boolean | null = false;
  @Input() public model!: EditorModel;

  @Output() public validEvent = new EventEmitter<boolean>();
  @Output() public valueChangeEvent = new EventEmitter<string>();

  private readonly _sourceModel$ = new BehaviorSubject<EditorModel | null>(null);
  private readonly _filter$ = new BehaviorSubject<AccessControlFilter>({
    resourceType: null,
    action: null,
  });
  private readonly _subscriptions = new Subscription();

  public readonly isFilterActive$: Observable<boolean> = this._filter$.pipe(
    map(({resourceType, action}) => !!resourceType || !!action)
  );

  public readonly resourceTypeItems$: Observable<ListItem[]> = combineLatest([
    this._sourceModel$,
    this._filter$,
  ]).pipe(
    map(([sourceModel, currentFilter]) => {
      const permissions = this.parsePermissions(sourceModel);
      const resourceTypes = Array.from(
        new Set(permissions.map(p => p.resourceType).filter(Boolean))
      ).sort();

      return resourceTypes.map(resourceType => ({
        content: formatResourceType(this.translateService, resourceType),
        resourceType,
        selected: currentFilter.resourceType === resourceType,
      }));
    })
  );

  public readonly actionItems$: Observable<ListItem[]> = combineLatest([
    this._sourceModel$,
    this._filter$,
  ]).pipe(
    map(([sourceModel, currentFilter]) => {
      const permissions = this.parsePermissions(sourceModel);
      const scoped = currentFilter.resourceType
        ? permissions.filter(p => p.resourceType === currentFilter.resourceType)
        : permissions;
      const actions = Array.from(
        new Set(
          scoped.flatMap(p => [...(p.actions ?? []), ...(p.action ? [p.action] : [])])
        )
      ).sort();

      return actions.map(action => ({
        content: this.translateService.instant(`accessControl.actions.${action}`),
        action,
        selected: currentFilter.action === action,
      }));
    })
  );

  public readonly filteredModel$: Observable<EditorModel | null> = combineLatest([
    this._sourceModel$,
    this._filter$,
  ]).pipe(
    map(([sourceModel, currentFilter]) => {
      if (!sourceModel) return null;
      if (!currentFilter.resourceType && !currentFilter.action) return sourceModel;

      const permissions = this.parsePermissions(sourceModel);
      const filtered = permissions.filter(permission => {
        const resourceMatch =
          !currentFilter.resourceType || permission.resourceType === currentFilter.resourceType;
        const actionMatch =
          !currentFilter.action ||
          (permission.actions ?? []).includes(currentFilter.action) ||
          permission.action === currentFilter.action;
        return resourceMatch && actionMatch;
      });

      return {
        ...sourceModel,
        value: JSON.stringify(filtered, null, 2),
      };
    })
  );

  public readonly editorDisabled$: Observable<boolean> = this._filter$.pipe(
    map(({resourceType, action}) => !!resourceType || !!action)
  );

  public readonly permissionSchema$: Observable<PermissionSchema> = this.metadataService.schema$;

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly iconService: IconService,
    private readonly metadataService: PermissionSchemaMetadataService,
    private readonly router: Router,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([Filter16, TrashCan16]);
  }

  public ngOnInit(): void {
    this.activatedRoute.queryParamMap.pipe(take(1)).subscribe(params => {
      this._filter$.next({
        resourceType: params.get('filterResourceType'),
        action: params.get('filterAction'),
      });
    });

    this._subscriptions.add(
      this._filter$.pipe(skip(1)).subscribe(currentFilter => {
        this.router.navigate([], {
          relativeTo: this.activatedRoute,
          queryParams: {
            filterResourceType: currentFilter.resourceType ?? null,
            filterAction: currentFilter.action ?? null,
          },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      })
    );
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['model']) {
      this._sourceModel$.next(this.model);
    }
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onValid(valid: boolean): void {
    this.validEvent.emit(valid);
  }

  public onValueChange(value: string): void {
    if (this._filter$.getValue().resourceType || this._filter$.getValue().action) return;
    this.valueChangeEvent.emit(value);
  }

  public onResourceTypeSelected(event: {item?: ListItem & {resourceType?: string}}): void {
    const resourceType = event.item?.resourceType ?? null;
    this._filter$.next({...this._filter$.getValue(), resourceType, action: null});
  }

  public onActionSelected(event: {item?: ListItem & {action?: string}}): void {
    const action = event.item?.action ?? null;
    this._filter$.next({...this._filter$.getValue(), action});
  }

  public onClearFilter(): void {
    this._filter$.next({resourceType: null, action: null});
  }

  private parsePermissions(model: EditorModel | null): Permission[] {
    if (!model?.value) return [];
    try {
      const parsed = JSON.parse(model.value);
      return Array.isArray(parsed) ? (parsed as Permission[]) : [];
    } catch {
      return [];
    }
  }
}
