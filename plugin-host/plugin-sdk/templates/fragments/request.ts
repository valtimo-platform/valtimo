
// JSON this plugin serves to its own iframes, reached from a bundle via
// `sdk.getPluginData("/summary")`. Requires the `frontend_data` capability in manifest.json.
request("/summary", (input: RequestInput) => {
  return {
    status: 200,
    body: {
      message: "Hello from the __PLUGIN_ID__ plugin backend",
      documentId: input.context?.documentId ?? null,
    },
  };
});
