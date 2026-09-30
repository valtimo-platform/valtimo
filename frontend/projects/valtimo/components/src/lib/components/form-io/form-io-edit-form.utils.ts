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

import {Components} from '@formio/js';

// Display holds the curated settings; conditional and logic drive visibility.
const CUSTOM_COMPONENT_TABS = ['display', 'conditional', 'logic'];

const buildCustomComponentEditForm = (displayComponents: any[]): any => {
  const editForm = Components.components.textfield.editForm();
  editForm.components.unshift({key: 'type', type: 'hidden'});

  const tabsComponent = editForm.components.find(component => component?.key === 'tabs');
  const displayTab = tabsComponent?.components?.find(tab => tab?.key === 'display');

  if (!tabsComponent || !displayTab) {
    console.warn(
      'buildCustomComponentEditForm: no "tabs"/"display" in the textfield edit form,',
      'custom settings were not applied. Form.io may have changed its edit form structure.'
    );

    return editForm;
  }

  displayTab.components = displayComponents;
  tabsComponent.components = tabsComponent.components.filter(tab =>
    CUSTOM_COMPONENT_TABS.includes(tab?.key)
  );

  return editForm;
};

export {buildCustomComponentEditForm, CUSTOM_COMPONENT_TABS};
