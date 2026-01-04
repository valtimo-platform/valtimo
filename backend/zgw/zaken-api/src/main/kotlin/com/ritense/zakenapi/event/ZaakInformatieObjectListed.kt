package com.ritense.zakenapi.event

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.outbox.domain.BaseEvent

class ZaakInformatieObjectListed (zaakInformatieObject: ObjectNode) : BaseEvent(
    type = "com.ritense.gzac.zrc.zaakinformatieobject.listed",
    resultType = "com.ritense.zakenapi.domain.ZaakInformatieObject",
    resultId = null,
    result = zaakInformatieObject
)