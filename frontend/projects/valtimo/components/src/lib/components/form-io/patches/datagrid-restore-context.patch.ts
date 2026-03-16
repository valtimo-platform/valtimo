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

import {Components} from 'formiojs';
import {get, has, set} from 'lodash';

/*
 * Patches the FormIO DataGrid's dataValue getter to fix orphaned data references
 * after a hide/show cycle (clearOnHide).
 *
 * Root cause: Component's dataValue getter returns a fresh emptyValue ([{}] for
 * DataGrid) when the component is hidden, even when data exists in _data. After
 * deleteValue() removes the data during hide, every subsequent dataValue access
 * returns a NEW throwaway object. Nested components end up with _data pointing
 * to these orphans, so customConditional expressions using row.* fail because
 * NestedComponent.checkConditions passes comp.data (an orphaned reference) as row.
 *
 * Fix: Override dataValue on DataGrid with two changes:
 *
 * Getter: When data EXISTS in _data, always return it (regardless of visibility).
 * When no data exists and the component is hidden, return a throwaway emptyValue
 * WITHOUT storing it — this prevents auto-initialization while hidden so that
 * deleteValue()/unset() actually clears the data.
 *
 * Setter: Remove the visibility guard entirely. This allows NestedComponent's
 * clearOnHide to re-store defaultValue after deleteValue, keeping data references
 * intact. The clearOnHide flow still works because deleteValue() calls unset()
 * which removes the key, then NestedComponent re-stores it with correct refs.
 *
 * See: formiojs 4.19.5 — Component.js:2389-2420, DataGrid.js:147-150, 823-831
 */

const DataGridComponent = Components.components.datagrid as any;

if (DataGridComponent) {
  Object.defineProperty(DataGridComponent.prototype, 'dataValue', {
    get: function () {
      if (!this.key) {
        return this.emptyValue;
      }
      // If data exists in _data, always return it — this is the core fix.
      // The original visibility guard returned a throwaway emptyValue here,
      // causing orphaned data references after a hide/show cycle.
      if (has(this._data, this.key)) {
        return get(this._data, this.key);
      }
      // If no data exists and component is hidden with clearOnHide, return
      // a throwaway emptyValue WITHOUT storing it. This preserves the original
      // clearOnHide flow: hasValue() stays false so that when the component
      // becomes visible again, setValue(defaultValue) is called to properly
      // initialize rows.
      if (!this.visible && this.component.clearOnHide && !this.rootPristine) {
        return this.emptyValue;
      }
      if (this.shouldAddDefaultValue) {
        const empty = this.component.multiple ? [] : this.emptyValue;
        if (!this.rootPristine) {
          set(this._data, this.key, empty);
        }
        return empty;
      }
      return get(this._data, this.key);
    },
    set: function (value: any) {
      if (!this.allowData || !this.key) {
        return;
      }
      if (value !== null && value !== undefined) {
        value = this.hook('setDataValue', value, this.key, this._data);
      }
      if (value === null || value === undefined) {
        this.unset();
        return;
      }
      set(this._data, this.key, value);
    },
    configurable: true,
  });
}
