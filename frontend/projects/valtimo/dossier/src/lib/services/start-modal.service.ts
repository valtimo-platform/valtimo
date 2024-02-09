import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StartModalService {

  getStandardStartEventTitle(bpmnXml: string): string | null {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(bpmnXml, "application/xml");

    if (xmlDoc.getElementsByTagName("parsererror").length) {
      console.error("Error parsing XML");
      return null;
    }

    const startEvents = xmlDoc.getElementsByTagName('bpmn:startEvent');
    if (!startEvents) {
      return null;
    }

    const standardStartEvent = Array.from(startEvents).find(event =>
      !event.getElementsByTagName('bpmn:messageEventDefinition').length &&
      !event.getElementsByTagName('bpmn:timerEventDefinition').length
    );

    return standardStartEvent ? standardStartEvent.getAttribute('name') : null;
  }
}
