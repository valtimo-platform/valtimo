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

import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {Milestone, MilestoneSet} from './models';
import {ConfigService} from '@valtimo/config';

@Injectable({
  providedIn: 'root',
})
export class MilestoneService {
  private valtimoApiConfig: any;

  constructor(
    private configService: ConfigService,
    private http: HttpClient
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
  }

  getMilestones(): Observable<Milestone[]> {
    return this.http.get<Milestone[]>(`${this.valtimoApiConfig.endpointUri}v1/milestones`);
  }

  getMilestone(milestoneId: number): Observable<Milestone> {
    return this.http.get<Milestone>(
      `${this.valtimoApiConfig.endpointUri}v1/milestones/${milestoneId}`
    );
  }

  createMilestone(milestone: Milestone): Observable<Milestone> {
    return this.http.post<Milestone>(
      `${this.valtimoApiConfig.endpointUri}v1/milestones`,
      milestone
    );
  }

  updateMilestone(milestone: Milestone): Observable<Milestone> {
    return this.http.post<Milestone>(
      `${this.valtimoApiConfig.endpointUri}v1/milestones`,
      milestone
    );
  }

  deleteMilestone(milestoneId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.valtimoApiConfig.endpointUri}v1/milestones/${milestoneId}`
    );
  }

  getMilestoneSets(): Observable<MilestoneSet[]> {
    return this.http.get<MilestoneSet[]>(`${this.valtimoApiConfig.endpointUri}v1/milestone-sets`);
  }

  getMilestoneSet(milestoneSetId: number): Observable<MilestoneSet> {
    return this.http.get<MilestoneSet>(
      `${this.valtimoApiConfig.endpointUri}v1/milestone-sets/${milestoneSetId}`
    );
  }

  createMilestoneSet(milestoneSet: MilestoneSet): Observable<MilestoneSet> {
    return this.http.post<MilestoneSet>(
      `${this.valtimoApiConfig.endpointUri}v1/milestone-sets`,
      milestoneSet
    );
  }

  updateMilestoneSet(milestoneSet: MilestoneSet): Observable<MilestoneSet> {
    return this.http.post<MilestoneSet>(
      `${this.valtimoApiConfig.endpointUri}v1/milestone-sets`,
      milestoneSet
    );
  }

  deleteMilestoneSet(milestoneSetId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.valtimoApiConfig.endpointUri}v1/milestone-sets/${milestoneSetId}`
    );
  }

  getFlownodes(processDefinitionId: string) {
    return this.http.get(
      `${this.valtimoApiConfig.endpointUri}v1/milestones/${processDefinitionId}/flownodes`
    );
  }
}
