
// Platform events this plugin subscribes to via `eventSubscriptions` in manifest.json. The host
// routes each matching CloudEvent here. Return `{status: "ignored"}` for events you don't handle.
onEvent((event: EventInput) => {
  log.info("Event received", {type: event.type, resultId: event.resultId});
  return {status: "completed" as const};
});
