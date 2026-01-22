package com.ritense.valtimo.operaton.incident

import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.impl.incident.DefaultIncidentHandler
import org.operaton.bpm.engine.impl.incident.IncidentContext
import org.operaton.bpm.engine.impl.incident.IncidentHandler
import org.operaton.bpm.engine.impl.persistence.entity.IncidentEntity
import org.operaton.bpm.engine.runtime.Incident


class OperatonIncidentHandlerDecorator(
    private val props: OperatonIncidentAlertLogProperties
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
