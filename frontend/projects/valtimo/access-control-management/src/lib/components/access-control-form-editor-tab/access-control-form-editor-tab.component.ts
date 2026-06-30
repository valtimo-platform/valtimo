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
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import {AbstractControl, FormArray, FormGroup} from '@angular/forms';
import {TranslateService} from '@ngx-translate/core';
import {Add16} from '@carbon/icons';
import {EditorModel} from '@valtimo/components';
import {IconService} from 'carbon-components-angular';
import {combineLatest, Subscription, take} from 'rxjs';
import {ACCESS_CONTROL_EDITOR_TEST_IDS} from '../../constants';
import {Permission} from '../../models';
import {AccessControlFormEditorService, PermissionSchemaMetadataService} from '../../services';

@Component({
  standalone: false,
  selector: 'valtimo-access-control-form-editor-tab',
  templateUrl: './access-control-form-editor-tab.component.html',
  styleUrls: ['./access-control-form-editor-tab.component.scss'],
  providers: [AccessControlFormEditorService],
})
export class AccessControlFormEditorTabComponent implements OnChanges, OnDestroy {
  @Input() public model: EditorModel | null = null;
  @Input() public disabled: boolean | null = false;

  @Output() public validEvent = new EventEmitter<boolean>();
  @Output() public valueChangeEvent = new EventEmitter<string>();

  public permissionsArray: FormArray | null = null;
  public ready = false;

  protected readonly testIds = ACCESS_CONTROL_EDITOR_TEST_IDS;

  // Offset (px) to keep a scrolled-into-view permission clear of the fixed top bar (48px) plus a
  // small gap.
  private readonly TOP_BAR_OFFSET = 120;

  private readonly _expanded = new Set<AbstractControl>();
  private _valueChangesSubscription?: Subscription;

  constructor(
    private readonly formEditorService: AccessControlFormEditorService,
    private readonly metadataService: PermissionSchemaMetadataService,
    private readonly translateService: TranslateService,
    private readonly iconService: IconService,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {
    this.iconService.registerAll([Add16]);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['model']) {
      this.rebuild();
    } else if (changes['disabled']) {
      this.applyDisabled();
    }
  }

  public ngOnDestroy(): void {
    this._valueChangesSubscription?.unsubscribe();
  }

  public permissionTitle(control: AbstractControl): string {
    const group = control as FormGroup;
    const resourceType = group.get('resourceType')!.value as string;
    const actions = (group.get('actions')!.value as string[]) ?? [];

    if (!resourceType) {
      return this.translateService.instant('accessControl.editor.newPermission');
    }

    // The technical resource type and action keys are shown verbatim, matching the rest of the
    // editor, rather than translated display names.
    if (!actions.length) return resourceType;

    return `${resourceType} · ${actions.join(', ')}`;
  }

  public isExpanded(control: AbstractControl): boolean {
    return this._expanded.has(control);
  }

  public onAccordionToggle(
    control: AbstractControl,
    event: {id?: string; expanded?: boolean}
  ): void {
    // Only one permission is expanded at a time: opening one collapses the others.
    this._expanded.clear();
    if (event?.expanded) {
      this._expanded.add(control);
      this.scrollIntoView(event.id);
    }
  }

  private scrollIntoView(accordionItemId?: string): void {
    if (!accordionItemId) return;
    // The accordion open/collapse is animated: the collapse of the previously-open item keeps
    // shifting the layout for a while, so scrolling immediately overshoots. Wait (frame by frame)
    // until the target's position stops changing — i.e. the animation has settled — and only then
    // scroll it into view. The scroll-margin-top set in CSS keeps it clear of the fixed top bar.
    let previousTop = Number.NaN;
    let stableFrames = 0;
    let frames = 0;
    let shifted = false;
    const settleAndScroll = (): void => {
      const element = document.getElementById(accordionItemId);
      if (!element) return;

      const top = element.getBoundingClientRect().top;
      if (!Number.isNaN(previousTop)) {
        if (Math.abs(top - previousTop) >= 1) {
          // The collapse of the previously-open item has started shifting the layout.
          shifted = true;
          stableFrames = 0;
        } else {
          stableFrames++;
        }
      }
      previousTop = top;
      frames++;

      // Once a shift has been observed, scroll when it settles. If no shift occurs within a short
      // window (e.g. nothing was open above), scroll anyway. A frame cap guards against edge cases.
      const settled = shifted ? stableFrames >= 3 : frames >= 12;
      if (settled || frames > 120) {
        // A small residual settle can still follow, so wait briefly and then scroll the permission's
        // start just below the fixed top bar. A manual scrollTo (rather than scrollIntoView) applies
        // the top-bar offset reliably, and an instant scroll avoids the drift a smooth scroll picks
        // up from concurrent layout changes. The target is recomputed from the final position.
        setTimeout(() => {
          const settledElement = document.getElementById(accordionItemId);
          if (!settledElement) return;
          const target = Math.max(
            0,
            window.scrollY + settledElement.getBoundingClientRect().top - this.TOP_BAR_OFFSET
          );
          window.scrollTo({top: target, behavior: 'auto'});
        }, 150);
      } else {
        requestAnimationFrame(settleAndScroll);
      }
    };
    requestAnimationFrame(settleAndScroll);
  }

  public addPermission(): void {
    if (!this.permissionsArray) return;

    const group = this.formEditorService.createPermissionGroup();
    this.permissionsArray.push(group);
    this._expanded.clear();
    this._expanded.add(group);
    this.changeDetectorRef.markForCheck();
  }

  public removePermission(index: number): void {
    if (!this.permissionsArray) return;

    this._expanded.delete(this.permissionsArray.at(index));
    this.permissionsArray.removeAt(index);
  }

  private rebuild(): void {
    combineLatest([this.metadataService.registry$, this.metadataService.actionsByResourceType$])
      .pipe(take(1))
      .subscribe(([registry, actionsByResourceType]) => {
        this.formEditorService.setRegistry(registry);
        this.formEditorService.setActionsByResourceType(actionsByResourceType);
        this.buildForm();
      });
  }

  private buildForm(): void {
    this.permissionsArray = this.formEditorService.buildPermissionsArray(this.parsePermissions());
    this._expanded.clear();
    if (this.permissionsArray.length) this._expanded.add(this.permissionsArray.at(0));
    this.applyDisabled();

    this._valueChangesSubscription?.unsubscribe();
    this._valueChangesSubscription = this.permissionsArray.valueChanges.subscribe(() =>
      this.emitState()
    );

    this.ready = true;
    this.emitState();
    this.changeDetectorRef.markForCheck();
  }

  private applyDisabled(): void {
    if (!this.permissionsArray) return;

    if (this.disabled && this.permissionsArray.enabled) {
      this.permissionsArray.disable({emitEvent: false});
    } else if (!this.disabled && this.permissionsArray.disabled) {
      this.permissionsArray.enable({emitEvent: false});
    }
  }

  private emitState(): void {
    if (!this.permissionsArray) return;

    this.valueChangeEvent.emit(
      JSON.stringify(this.formEditorService.serialize(this.permissionsArray))
    );
    this.validEvent.emit(this.permissionsArray.valid);
  }

  private parsePermissions(): Permission[] {
    if (!this.model?.value) return [];
    try {
      const parsed = JSON.parse(this.model.value);
      return Array.isArray(parsed) ? (parsed as Permission[]) : [];
    } catch {
      return [];
    }
  }
}
