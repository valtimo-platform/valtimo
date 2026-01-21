package com.ritense.valtimo.operaton.incident

import org.operaton.bpm.engine.impl.cfg.ProcessEngineConfigurationImpl
import org.operaton.bpm.spring.boot.starter.configuration.OperatonProcessEngineConfiguration

class OperatonIncidentHandlerConfig(
    private val props: OperatonIncidentAlertLogProperties
): OperatonProcessEngineConfiguration {

    override fun postInit(processEngineConfiguration: ProcessEngineConfigurationImpl) {
        processEngineConfiguration.addIncidentHandler(OperatonIncidentHandlerDecorator(props))
    }
}
