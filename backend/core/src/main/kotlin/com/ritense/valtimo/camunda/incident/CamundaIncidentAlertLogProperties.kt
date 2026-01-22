package com.ritense.valtimo.camunda.incident

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "camunda.incident.alert-log")
data class CamundaIncidentAlertLogProperties(
    val enabled: Boolean = false,
    val messageTemplate: String =
        "CAMUNDA_INCIDENT_FAILED_JOB: processInstanceId={processInstanceId} incidentId={incidentId}"
)
