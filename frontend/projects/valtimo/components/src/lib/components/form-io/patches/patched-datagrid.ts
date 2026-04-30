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

const BuiltInDataGrid = (Components as any).components['datagrid'];

/**
 * Patched DataGrid component that fixes child field conditions breaking
 * after the DataGrid is hidden via a condition and then shown again
 * (with "Clear Value When Hidden" enabled).
 *
 * Root cause: when a DataGrid transitions from hidden to visible, the
 * NestedComponent visible setter iterates old child components and
 * createRows() reuses stale component instances. Nested grandchildren
 * (fields inside Columns, Panels, etc.) retain orphaned data contexts,
 * which breaks condition evaluation and change event propagation.
 *
 * Fix: after the original hide→show logic completes, call setValue()
 * to force the DataGrid to recursively reinitialize all nested component
 * values and data bindings through the entire component tree.
 */
class PatchedDataGrid extends BuiltInDataGrid {
  checkComponentConditions(data: any, flags: any, row: any): boolean {
    const wasVisible = this.visible;

    const result = BuiltInDataGrid.prototype.checkComponentConditions.call(this, data, flags, row);

    if (!wasVisible && this.visible) {
      this.setValue(this.dataValue);
    }

    return result;
  }
}

export function applyDataGridPatch(): void {
  Components.setComponent('datagrid', PatchedDataGrid);
}
