# ✉️ Outbox

Valtimo emits [CloudEvents](https://cloudevents.io/) to a broker using the [outbox module](../../fundamentals/getting-started/modules/core/outbox/). The main purpose of these events is to create an audit log, but it could be used in other ways as well.

The emitted events are documented as an AsyncAPI spec which can be found [here](https://github.com/valtimo-platform/valtimo-events). A more browser-friendly version of this spec can be found [here](https://valtimo-platform.github.io/valtimo-events/).
