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
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {InputModule} from 'carbon-components-angular';
import {Subscription} from 'rxjs';
import {BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../constants';
import {MigrationPlan} from '../../../models';

interface GeneralValue {
  title: string;
  key: string;
}

@Component({
  standalone: true,
  selector: 'valtimo-bb-migration-general-tab',
  templateUrl: './migration-general-tab.component.html',
  styleUrls: ['./migration-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, InputModule],
})
export class BbMigrationGeneralTabComponent implements OnInit, OnDestroy {
  @Input() public buildingBlockDefinitionKey: string | null = null;
  @Input() public buildingBlockDefinitionVersionTag: string | null = null;

  @Input() public set isEdit(value: boolean) {
    // The key identifies the plan; changing it while editing would create a new one.
    const keyControl = this.form.get('key');
    if (value) keyControl?.disable({emitEvent: false});
    else keyControl?.enable({emitEvent: false});
  }

  @Input() public set plan(value: MigrationPlan | null | undefined) {
    this.writeGeneral(value ?? {});
  }

  @Output() public readonly generalChange = new EventEmitter<Partial<MigrationPlan>>();

  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS;

  public readonly form = this.fb.group({
    title: this.fb.control(''),
    key: this.fb.control(''),
  });

  private _lastEmitted = '';
  private readonly _subscriptions = new Subscription();

  constructor(private readonly fb: FormBuilder) {}

  public ngOnInit(): void {
    this._subscriptions.add(this.form.valueChanges.subscribe(() => this.emit()));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private emit(): void {
    const value = this.serialize();
    this._lastEmitted = JSON.stringify(value);
    this.generalChange.emit(value);
  }

  private serialize(): Partial<MigrationPlan> {
    const {title, key} = this.form.getRawValue();

    return {
      title: title ?? '',
      key: key ?? '',
    };
  }

  private writeGeneral(plan: MigrationPlan): void {
    const incoming: GeneralValue = {
      title: plan.title ?? '',
      key: plan.key ?? '',
    };

    // Ignore the echo of our own emission to avoid rebuilding the form (and losing focus).
    if (JSON.stringify(incoming) === this._lastEmitted) return;

    this.form.patchValue(incoming, {emitEvent: false});

    this._lastEmitted = JSON.stringify(this.serialize());
  }
}
