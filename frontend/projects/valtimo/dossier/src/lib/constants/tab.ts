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

import {InjectionToken} from '@angular/core';
import {DossierDetailTabSummaryComponent} from '../components/dossier-detail/tab/summary/summary.component';
import {DossierDetailTabProgressComponent} from '../components/dossier-detail/tab/progress/progress.component';
import {DossierDetailTabAuditComponent} from '../components/dossier-detail/tab/audit/audit.component';
import {DossierDetailTabDocumentsComponent} from '../components/dossier-detail/tab/documents/documents.component';
import {DefaultTabComponents, DefaultTabs} from '../models';
import {DossierDetailTabNotesComponent} from '../components/dossier-detail/tab/notes/notes.component';

const TAB_MAP = new InjectionToken<Map<string, object>>('TabMap');

const DEFAULT_TABS = new Map<string, object>([
  [DefaultTabs.summary, DossierDetailTabSummaryComponent],
  [DefaultTabs.progress, DossierDetailTabProgressComponent],
  [DefaultTabs.audit, DossierDetailTabAuditComponent],
  [DefaultTabs.documents, DossierDetailTabDocumentsComponent],
]);

const DEFAULT_TAB_COMPONENTS: DefaultTabComponents = {
  [DefaultTabs.summary]: DossierDetailTabSummaryComponent,
  [DefaultTabs.progress]: DossierDetailTabProgressComponent,
  [DefaultTabs.audit]: DossierDetailTabAuditComponent,
  [DefaultTabs.documents]: DossierDetailTabDocumentsComponent,
  [DefaultTabs.notes]: DossierDetailTabNotesComponent,
};

export {TAB_MAP, DEFAULT_TABS, DEFAULT_TAB_COMPONENTS};
