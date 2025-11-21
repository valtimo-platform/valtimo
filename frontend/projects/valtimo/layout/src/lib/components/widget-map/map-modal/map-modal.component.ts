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
import {Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {MapData} from '../../../models';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import {OSM} from 'ol/source';
import {Fill, Icon, Stroke, Style} from 'ol/style';
import VectorSource from 'ol/source/Vector';
import {GeoJSON} from 'ol/format';
import VectorLayer from 'ol/layer/Vector';
import {ModalModule} from 'carbon-components-angular';
import {AsyncPipe} from '@angular/common';
import {TranslatePipe} from '@ngx-translate/core';
import {RenderPageHeaderDirective, ValtimoCdsModalDirective} from '@valtimo/components';

@Component({
  selector: 'valtimo-map-modal',
  templateUrl: './map-modal.component.html',
  styleUrls: ['./map-modal.component.scss'],
  standalone: true,
  imports: [
    ModalModule,
    AsyncPipe,
    TranslatePipe,
    ValtimoCdsModalDirective,
    RenderPageHeaderDirective,
  ],
})
export class MapModalComponent implements OnInit, OnDestroy {
  @ViewChild('widgetMap') private _widgetMapRef: ElementRef<HTMLDivElement>;

  @Input() public showModalSubject$: Observable<boolean>;
  @Input() public mapData$: Observable<MapData>;

  public readonly modalOpen$ = new BehaviorSubject<boolean>(false);

  private map!: Map;
  private vectorLayer!: VectorLayer<VectorSource>;
  private _showModalSubscription!: Subscription;

  public ngOnInit(): void {
    if (this.showModalSubject$) {
      this._showModalSubscription = this.showModalSubject$.subscribe(showModal => {
        this.modalOpen$.next(showModal);
        if (showModal) {
          this.renderMap();
        }
      });
    }
  }

  public ngOnDestroy(): void {
    this._showModalSubscription?.unsubscribe();
  }

  public closeModal(): void {
    this.modalOpen$.next(false);
  }

  private renderMap(): void {
    if (!this._widgetMapRef?.nativeElement) {
      return;
    }

    if (!this.map) {
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
      });
    }

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

    this.mapData$.subscribe(mapData => {
      if (!mapData?.geoJsonFeatureCollection) {
        return;
      }

      const featureCollection = {
        ...mapData?.geoJsonFeatureCollection,
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
      const extent = vectorSource.getExtent();
      if (extent) {
        this.map.getView().fit(extent, {
          padding: [20, 20, 20, 20],
        });
      }
    });
  }
}
