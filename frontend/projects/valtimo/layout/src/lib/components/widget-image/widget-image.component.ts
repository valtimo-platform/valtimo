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
  HostBinding,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {Download16, Launch16} from '@carbon/icons';
import {MdiIconViewerComponent} from '@valtimo/components';
import {
  ButtonModule,
  IconModule,
  IconService,
  SkeletonModule,
  TilesModule,
} from 'carbon-components-angular';
import {BehaviorSubject} from 'rxjs';
import {ImageWidget, WidgetImageResolved} from '../../models';

@Component({
  selector: 'valtimo-widget-image',
  templateUrl: './widget-image.component.html',
  styleUrls: ['./widget-image.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MdiIconViewerComponent,
    ButtonModule,
    IconModule,
    SkeletonModule,
    TilesModule,
  ],
})
export class WidgetImageComponent {
  @HostBinding('class') public readonly hostClasses = 'valtimo-widget-image';

  @Input() public set widgetConfiguration(value: ImageWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }

  @Input() public set images(value: WidgetImageResolved[] | null) {
    this.images$.next(value);
  }

  @Output() public readonly download = new EventEmitter<WidgetImageResolved>();
  @Output() public readonly openInNewTab = new EventEmitter<WidgetImageResolved>();

  public readonly widgetConfiguration$ = new BehaviorSubject<ImageWidget | null>(null);
  public readonly images$ = new BehaviorSubject<WidgetImageResolved[] | null>(null);

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([Launch16, Download16]);
  }

  public onDownload(image: WidgetImageResolved): void {
    this.download.emit(image);
  }

  public onOpenInNewTab(image: WidgetImageResolved): void {
    this.openInNewTab.emit(image);
  }
}
