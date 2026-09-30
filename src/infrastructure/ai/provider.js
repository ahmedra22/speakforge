export class AiConfigurationError extends Error {
  constructor(message = "AI Practice is not configured yet.") { super(message); this.name = "AiConfigurationError"; }
}
export class AiProviderError extends Error {
  constructor(message, status = 502) { super(message); this.name = "AiProviderError"; this.status = status; }
}

export function createAiProvider({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const apiKey = env.AI_API_KEY?.trim();
  const model = env.AI_MODEL?.trim();
  const baseUrl = (env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const provider = env.AI_PROVIDER?.trim() || "openai-compatible";
  let configurationError = "";
  if (provider !== "openai-compatible") configurationError = `Unsupported AI_PROVIDER: ${provider}`;
  let parsed;
  try { parsed = new URL(baseUrl); } catch { configurationError = "AI_BASE_URL must be a valid HTTP(S) URL."; }
  if (parsed && !["http:", "https:"].includes(parsed.protocol)) configurationError = "AI_BASE_URL must use HTTP or HTTPS.";
  if (configurationError) return { configured: false, provider, async generateResponse() { throw new AiConfigurationError(configurationError); } };
  const timeoutMs = Math.min(60000, Math.max(1000, Number(env.AI_TIMEOUT_MS) || 25000));
  return {
    configured: Boolean(apiKey && model), provider,
    async generateResponse({ instruction, messages, signal }) {
      if (!apiKey || !model) throw new AiConfigurationError();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
      const abort = () => controller.abort(signal.reason);
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, temperature: 0.4, max_tokens: 700, response_format: { type: "json_object" }, messages: [{ role: "system", content: instruction }, ...messages] }),
          signal: controller.signal,
        });
        if (!response.ok) throw new AiProviderError(response.status === 401 ? "AI provider credentials were rejected. Check server configuration." : `AI provider request failed (${response.status}).`, 502);
        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) throw new AiProviderError("AI provider returned an empty response.");
        try { return JSON.parse(content); } catch { throw new AiProviderError("AI provider returned an unreadable response."); }
      } catch (error) {
        if (error instanceof AiProviderError || error instanceof AiConfigurationError) throw error;
        if (controller.signal.aborted) throw new AiProviderError(controller.signal.reason?.message === "timeout" ? "AI Practice took too long. Please try again." : "AI Practice request was cancelled.", 504);
        throw new AiProviderError("Could not reach the AI provider. Please try again.");
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
      }
    },
  };
}
