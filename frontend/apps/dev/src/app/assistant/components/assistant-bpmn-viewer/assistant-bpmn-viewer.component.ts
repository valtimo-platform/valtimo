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
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import {ASSISTANT_TEST_IDS} from '../../constants';

// diagram-js types leave out the 'auto' centre that fit-viewport accepts.
interface FitCanvas {
  zoom(scale: 'fit-viewport', center: 'auto'): number;
}

/*
 * Read-only BPMN diagram with pan and zoom. Re-imports when the xml changes, because the
 * confirmation modal reuses this component when a new action arrives.
 */
@Component({
  standalone: true,
  selector: 'valtimo-assistant-bpmn-viewer',
  templateUrl: './assistant-bpmn-viewer.component.html',
  styleUrls: ['./assistant-bpmn-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule],
})
export class AssistantBpmnViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', {static: true}) private readonly _host!: ElementRef<HTMLDivElement>;

  @Input() public xml = '';

  public failed = false;

  protected readonly testIds = ASSISTANT_TEST_IDS;

  private _viewer: NavigatedViewer | null = null;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  public ngAfterViewInit(): void {
    this._viewer = new NavigatedViewer({container: this._host.nativeElement});
    this.render();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['xml'] && !changes['xml'].firstChange) this.render();
  }

  public ngOnDestroy(): void {
    this._viewer?.destroy();
    this._viewer = null;
  }

  private render(): void {
    const viewer = this._viewer;

    if (!viewer) return;

    viewer
      .importXML(this.xml)
      .then(() => {
        viewer.get<FitCanvas>('canvas').zoom('fit-viewport', 'auto');
        this.failed = false;
        this.cdr.markForCheck();
      })
      .catch(() => {
        this.failed = true;
        this.cdr.markForCheck();
      });
  }
}
