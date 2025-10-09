package com.ritense.zakenapi.event

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.outbox.domain.BaseEvent

class ZaakNotitiePatched(notitieUrl: String, notitie: ObjectNode) : BaseEvent(
    type = "com.ritense.gzac.zrc.zaaknotitie.patched",
    resultType = "com.ritense.zakenapi.domain.ZaakNotitie",
    resultId = notitieUrl,
    result = notitie
)
