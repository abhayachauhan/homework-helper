export function assertNoApiKey(env: NodeJS.ProcessEnv | Record<string, string | undefined>): void {
  if (env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is set — refusing to start. This app must bill the Max " +
        "subscription via the Agent SDK; an API key would silently switch to pay-as-you-go. " +
        "Unset it (and ensure docker-compose does not forward it)."
    );
  }
}
