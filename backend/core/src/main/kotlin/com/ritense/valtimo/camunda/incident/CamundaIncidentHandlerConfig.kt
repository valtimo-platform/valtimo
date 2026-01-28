package com.ritense.valtimo.camunda.incident

import org.camunda.bpm.engine.impl.cfg.ProcessEngineConfigurationImpl
import org.camunda.bpm.spring.boot.starter.configuration.CamundaProcessEngineConfiguration

class CamundaIncidentHandlerConfig(
    private val props: CamundaIncidentAlertLogProperties
): CamundaProcessEngineConfiguration {

    override fun postInit(processEngineConfiguration: ProcessEngineConfigurationImpl) {
        processEngineConfiguration.addIncidentHandler(CamundaIncidentHandlerDecorator(props))
    }
}
