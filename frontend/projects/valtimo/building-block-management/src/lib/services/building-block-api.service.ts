import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {BuildingBlock} from '../models/building-block.model';
import {BUILDING_BLOCKS} from '../mocks';

@Injectable({
  providedIn: 'root',
})
export class BuildingBlockApiService {
  public readonly buildingBlocks$ = of(BUILDING_BLOCKS);
}
