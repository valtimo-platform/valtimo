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

import {Component, OnInit} from '@angular/core';
import {MilestoneService} from '../milestone.service';
import {Milestone, MilestoneSet} from '../models';
import {Router} from '@angular/router';
import {combineLatest} from 'rxjs';

@Component({
  selector: 'valtimo-milestone-list',
  templateUrl: './milestone-list.component.html',
  styleUrls: ['./milestone-list.component.scss'],
})
export class MilestoneListComponent implements OnInit {
  public milestones: Array<Array<string | MilestoneSet | Array<Milestone>>> = [];
  public milestoneFields = [
    {key: 'id', label: 'ID'},
    {key: 'title', label: 'Title'},
    {key: 'processDefinitionKey', label: 'Process'},
    {key: 'taskDefinitionKey', label: 'Task'},
    {key: 'plannedIntervalInDays', label: 'Interval (in days)'},
    {key: 'color', label: 'Color'},
  ];

  constructor(
    private milestoneService: MilestoneService,
    private router: Router
  ) {}

  editMilestoneSet(milestoneSetId: number) {
    this.router.navigate(['milestones/sets/set', milestoneSetId]);
  }

  editMilestone(milestone: Milestone) {
    this.router.navigate(['milestones/milestone', milestone.id]);
  }

  ngOnInit() {
    combineLatest([
      this.milestoneService.getMilestones(),
      this.milestoneService.getMilestoneSets(),
    ]).subscribe(([milestones, milestoneSets]) =>
      this.handleMilestoneResult(milestones, milestoneSets)
    );
  }

  private handleMilestoneResult(
    milestones: Array<Milestone>,
    milestoneSets: Array<MilestoneSet>
  ): void {
    const milestoneSetsMap = this.getMilestoneSetsMap(milestones, milestoneSets);

    this.setMilestones(milestoneSetsMap);
  }

  private setMilestones(milestoneSetsMap: Map<string, Milestone[]>): void {
    this.milestones = Array.from(milestoneSetsMap.entries()).map(entry => {
      entry[0] = JSON.parse(entry[0]);
      return entry;
    });
  }

  private getMilestoneSetsMap(
    milestones: Array<Milestone>,
    milestoneSets: Array<MilestoneSet>
  ): Map<string, Milestone[]> {
    const mapWithSets = this.addMilestoneSetsToMap(milestoneSets, this.getEmptyMap());

    return this.addMilestonesToMap(milestones, mapWithSets);
  }

  private getEmptyMap(): Map<string, Milestone[]> {
    return new Map<string, Milestone[]>();
  }

  private addMilestoneSetsToMap(
    milestoneSets: Array<MilestoneSet>,
    map: Map<string, Milestone[]>
  ): Map<string, Milestone[]> {
    milestoneSets.forEach(milestoneSet => {
      map.set(JSON.stringify(milestoneSet), []);
    });

    return map;
  }

  private addMilestonesToMap(
    milestones: Array<Milestone>,
    map: Map<string, Milestone[]>
  ): Map<string, Milestone[]> {
    milestones.forEach(milestone => {
      const milestoneSetString = JSON.stringify(milestone.milestoneSet);
      const arr = map.get(milestoneSetString);
      arr.push(milestone);
      map.set(milestoneSetString, arr);
    });

    return map;
  }
}
