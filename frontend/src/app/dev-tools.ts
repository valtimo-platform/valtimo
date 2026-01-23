/*
 * Dev/demo utilities and routes.
 * Production builds swap this file with no-dev-tools.ts via angular.json fileReplacements.
 */

import {Routes} from '@angular/router';
import {AuthGuardService} from '@valtimo/security';
import {CustomFormExampleComponent} from './custom-form-example/custom-form-example.component';
import {StartProcessCustomFormComponent} from './start-process-custom-form/start-process-custom-form.component';
import {FormioComponent} from './form-io/form-io.component';
import {UploadShowcaseComponent} from './upload-showcase/upload-showcase.component';
import {CustomCaseTabComponent} from './custom-case-tab/custom-case-tab.component';
import {CustomMapsTabComponent} from './custom-maps-tab/custom-maps-tab.component';
import {NotificationTestComponent} from './notification-test/notification-test.component';
import {
  ProcessLinkModule,
  FORM_CUSTOM_COMPONENT_TOKEN,
  FORM_FLOW_COMPONENT_TOKEN,
} from '@valtimo/process-link';
import {CustomFormFlowComponent} from './custom-form-flow-component/custom-form-flow.component';
import {CustomFormComponent} from './custom-form-component/custom-form.component';
import {CASE_TAB_TOKEN} from '@valtimo/case';
import {CaseDetailTabZaakobjectenComponent} from '@valtimo/zgw';
import {CUSTOM_WIDGET_TOKEN} from '@valtimo/layout';

export const devDeclarations = [
  CustomFormExampleComponent,
  StartProcessCustomFormComponent,
  FormioComponent,
  UploadShowcaseComponent,
  CustomCaseTabComponent,
  CustomMapsTabComponent,
  NotificationTestComponent,
];

export const devImports = [ProcessLinkModule, CustomFormFlowComponent];

export const devProviders = [
  FormioComponent,
  {
    provide: CASE_TAB_TOKEN,
    useValue: {
      'custom-dossier-tab': CustomCaseTabComponent,
      zaakobjecten: CaseDetailTabZaakobjectenComponent,
    },
  },
  {
    provide: FORM_FLOW_COMPONENT_TOKEN,
    useValue: [
      {
        id: 'test-component',
        component: CustomFormFlowComponent,
      },
    ],
  },
  {
    provide: CUSTOM_WIDGET_TOKEN,
    useValue: {
      caseWidgetComponent: CustomCaseTabComponent,
    },
  },
  {
    provide: FORM_CUSTOM_COMPONENT_TOKEN,
    useValue: {
      dummy: CustomFormComponent,
    },
  },
];

export const devTabs: Array<[string, object]> = [
  ['custom-maps', CustomMapsTabComponent],
  ['custom-dossier', CustomCaseTabComponent],
];

export const devToolRoutes: Routes = [
  {
    path: 'form-io',
    canActivate: [AuthGuardService],
    data: {title: 'Valtimo - Form.io V.3.27.1'},
    loadComponent: () =>
      import('./form-io/form-io.component').then(module => module.FormioComponent),
  },
  {
    path: 'upload-showcase',
    canActivate: [AuthGuardService],
    data: {title: 'Upload - Showcase'},
    loadComponent: () =>
      import('./upload-showcase/upload-showcase.component').then(
        module => module.UploadShowcaseComponent
      ),
  },
  {
    path: 'notification-test',
    canActivate: [AuthGuardService],
    data: {title: 'Notification test'},
    loadComponent: () =>
      import('./notification-test/notification-test.component').then(
        module => module.NotificationTestComponent
      ),
  },
];
