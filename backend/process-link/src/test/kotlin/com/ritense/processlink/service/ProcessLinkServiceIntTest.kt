package com.ritense.processlink.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.processlink.BaseIntegrationTest
import com.ritense.processlink.domain.AnotherTestProcessLink
import com.ritense.processlink.domain.AnotherTestProcessLink.Companion.PROCESS_LINK_TYPE
import com.ritense.processlink.domain.AnotherTestProcessLinkUpdateRequestDto
import com.ritense.processlink.domain.TestProcessLink
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

@Transactional
class ProcessLinkServiceIntTest @Autowired constructor(
    private val processLinkService: ProcessLinkService
): BaseIntegrationTest() {

    @Test
    fun `should update existing processLink to new type`(): Unit = runWithoutAuthorization {
        val processLink = processLinkService.getProcessLinksByProcessDefinitionKey("auto-deploy-process-link-with-long-key")
            .filterIsInstance<TestProcessLink>().first()

        processLinkService.updateProcessLink(
            AnotherTestProcessLinkUpdateRequestDto(
                processLink.id,
                "success!"
            )
        )

        val updatedProcessLink = processLinkService.getProcessLink(processLink.id, AnotherTestProcessLink::class.java)
        assertThat(updatedProcessLink.processLinkType).isEqualTo(PROCESS_LINK_TYPE)
        assertThat(updatedProcessLink.anotherValue).isNotEqualTo(processLink.someValue)
        assertThat(updatedProcessLink.anotherValue).isEqualTo("success!")
    }
}