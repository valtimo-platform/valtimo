/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule, EllipsisPipe} from '@valtimo/components';
import {ButtonModule, InputModule, SkeletonModule} from 'carbon-components-angular';
import {BehaviorSubject} from 'rxjs';
import {MapWidget, MapData} from '../../models';
import {WidgetActionButtonComponent} from '../widget-action-button/widget-action-button.component';
import TileLayer from 'ol/layer/Tile';
import {OSM} from 'ol/source';
import {GeoJSON} from 'ol/format';
import {Map, View} from 'ol';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {FullScreen, defaults, Zoom} from 'ol/control';
import {Icon, Fill, Stroke, Style} from 'ol/style';

@Component({
  selector: 'valtimo-widget-map',
  templateUrl: './widget-map.component.html',
  styleUrls: ['./widget-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    InputModule,
    TranslateModule,
    CarbonListModule,
    EllipsisPipe,
    ButtonModule,
    WidgetActionButtonComponent,
    SkeletonModule,
  ],
})
export class WidgetMapComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class') public readonly class = 'widget-map';

  @ViewChild('widgetMap') private _widgetMapRef: ElementRef<HTMLDivElement>;

  @Input() public set widgetConfiguration(value: MapWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }

  public readonly isEmptyWidgetData$ = new BehaviorSubject<boolean>(false);
  public readonly noVisibleMap$ = new BehaviorSubject<boolean>(true);

  @Input() public set widgetData(value: object | null) {
    if (!value) {
      this.widgetData$.next(null);
      return;
    }
    this.widgetData$.next(value as MapData);
    this.isEmptyWidgetData$.next(this.checkEmptyWidgetData(value));
  }

  @Output() public readonly noVisibleMapEvent = new EventEmitter<boolean>();

  public readonly widgetConfiguration$ = new BehaviorSubject<MapWidget | null>(null);
  public readonly widgetData$ = new BehaviorSubject<MapData | null>(null);

  private _observer!: ResizeObserver;
  private map!: Map;
  private vectorLayer!: VectorLayer<VectorSource>;

  public ngAfterViewInit(): void {
    if (this._widgetMapRef) this.openWidthObserver();
    this.subscribeMapData();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
  }

  private openWidthObserver(): void {
    this._observer = new ResizeObserver(() => this.fitMap(this.vectorLayer?.getSource()));
    this._observer.observe(this._widgetMapRef.nativeElement);
  }

  private checkEmptyWidgetData(widgetData: Object): boolean {
    return widgetData && Object.keys(widgetData).length === 0;
  }

  private subscribeMapData(): void {
    const fullscreen = new FullScreen();
    const zoomControl = new Zoom({});
    this.map = new Map({
      target: this._widgetMapRef.nativeElement,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: [0, 0],
        zoom: 2,
      }),
      controls: defaults({zoom: false}).extend([fullscreen]),
    });
    this.map.getInteractions().forEach(i => i.setActive(false));
    fullscreen.on('enterfullscreen', () => {
      this.map.getInteractions().forEach(i => i.setActive(true));
      this.map.addControl(zoomControl);
    });
    fullscreen.on('leavefullscreen', () => {
      this.map.getInteractions().forEach(i => i.setActive(false));
      this.map.removeControl(zoomControl);
    });

    const featureOptions = {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    };

    const vectorStyle = new Style({
      image: new Icon({
        src: 'valtimo-layout/img/marker.svg',
        anchor: [0.5, 0.9],
        scale: 1,
      }),
      fill: new Fill({
        color: 'rgba(255,255,255,0.4)',
      }),
      stroke: new Stroke({
        color: '#3399CC',
        width: 2,
      }),
    });

    this.widgetData$.subscribe(widgetData => {
      if (!widgetData?.geoJsonFeatureCollection?.features) {
        return;
      }

      const featureCollection = {
        ...widgetData?.geoJsonFeatureCollection,
        type: 'FeatureCollection',
      };

      if (this.vectorLayer) {
        this.map.removeLayer(this.vectorLayer);
      }

      const vectorSource = new VectorSource({
        features: new GeoJSON().readFeatures(featureCollection, featureOptions),
      });

      this.vectorLayer = new VectorLayer({
        source: vectorSource,
        style: vectorStyle,
      });

      this.map.addLayer(this.vectorLayer);
      setTimeout(() => this.fitMap(vectorSource));
    });
  }

  private fitMap(vectorSource: VectorSource): void {
    const extent = vectorSource?.getExtent();
    if (extent) {
      this.map.updateSize();
      this.map.getView().fit(extent, {
        padding: [20, 20, 20, 20],
        maxZoom: 18,
      });
    }
  }
}
