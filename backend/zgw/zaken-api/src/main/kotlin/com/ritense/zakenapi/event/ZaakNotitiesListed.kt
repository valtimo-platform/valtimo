package com.ritense.zakenapi.event

import com.fasterxml.jackson.databind.node.ArrayNode
import com.ritense.outbox.domain.BaseEvent

class ZaakNotitiesListed(notities: ArrayNode) : BaseEvent(
    type = "com.ritense.gzac.zrc.zaaknotitie.listed",
    resultType = "List<com.ritense.zakenapi.domain.ZaakNotitie>",
    resultId = null,
    result = notities
)
