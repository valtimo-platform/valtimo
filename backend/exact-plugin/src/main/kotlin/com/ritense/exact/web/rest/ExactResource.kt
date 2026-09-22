package com.ritense.exact.web.rest

import com.ritense.exact.service.ExactService
import com.ritense.exact.service.request.ExactExchangeRequest
import com.ritense.exact.service.response.ExactExchangeResponse
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
@RestController
@SkipComponentScan
class ExactResource(
    val exactService: ExactService
) {

    @EndpointDescription(
        en = "Exchange an Exact authorization code",
        nl = "Exact-autorisatiecode uitwisselen",
    )
    @PostMapping("/v1/plugin/exact/exchange")
    fun exchange(@Valid @RequestBody request: ExactExchangeRequest): ExactExchangeResponse {
        return exactService.exchange(request)
    }

}
