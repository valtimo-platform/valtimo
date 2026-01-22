package com.ritense.valtimo.camunda.incident

import mu.KotlinLogging
import org.camunda.bpm.engine.impl.incident.DefaultIncidentHandler
import org.camunda.bpm.engine.impl.incident.IncidentContext
import org.camunda.bpm.engine.impl.incident.IncidentHandler
import org.camunda.bpm.engine.impl.persistence.entity.IncidentEntity
import org.camunda.bpm.engine.runtime.Incident

class CamundaIncidentHandlerDecorator(
    private val props: CamundaIncidentAlertLogProperties
): IncidentHandler {

    private val defaultIncidentHandler: DefaultIncidentHandler = DefaultIncidentHandler(IncidentEntity.FAILED_JOB_HANDLER_TYPE)

    override fun getIncidentHandlerType(): String? {
        return defaultIncidentHandler.incidentHandlerType
    }

    override fun handleIncident(
        context: IncidentContext?,
        message: String?
    ): Incident {
        val incident = defaultIncidentHandler.handleIncident(context, message)
        val lineToLog = props.messageTemplate
            .replace("{incidentId}", incident.id ?: "unknown")
            .replace("{processInstanceId}", incident.processInstanceId ?: "unknown")

        logger.error { lineToLog }

        return incident
    }

    override fun resolveIncident(context: IncidentContext?) {
        defaultIncidentHandler.resolveIncident(context)
    }

    override fun deleteIncident(context: IncidentContext?) {
        defaultIncidentHandler.deleteIncident(context)
    }

    companion object {
        val logger = KotlinLogging.logger {}
    }
}
