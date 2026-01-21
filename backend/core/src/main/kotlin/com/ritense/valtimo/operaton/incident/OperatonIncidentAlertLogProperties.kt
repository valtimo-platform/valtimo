package com.ritense.valtimo.operaton.incident

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "operaton.incident.alert-log")
data class OperatonIncidentAlertLogProperties(
    val enabled: Boolean = false,
    val messageTemplate: String =
        "OPERATON_INCIDENT_FAILED_JOB: processInstanceId={processInstanceId} incidentId={incidentId}"
)
