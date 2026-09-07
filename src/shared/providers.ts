import type { Agent, OAuthProvider, Protocol, Provider } from "./types.ts";

export const oauthProviders: Array<{
  id: OAuthProvider;
  name: string;
  detail: string;
}> = [
  {
    id: "claude",
    name: "Claude",
    detail:
      "Personal or organization seats · the same email can connect more than once",
  },
  {
    id: "codex",
    name: "ChatGPT / Codex",
    detail: "Plus, Pro, Business, or Enterprise",
  },
  {
    id: "antigravity",
    name: "Antigravity",
    detail: "Google account via CLIProxyAPI",
  },
  { id: "kimi", name: "Kimi Code", detail: "Kimi coding subscription" },
  { id: "xai", name: "Grok", detail: "Grok Build subscription" },
];
// Claude Code and Codex default to their own vendor's models; other
// providers are opt-in because CLIProxyAPI has to translate between them.
const nativeOwners: Partial<Record<Agent, string[]>> = {
  claude: ["anthropic", "claude"],
  codex: ["openai", "codex"],
};
export function modelsFor<T extends { owned_by?: string }>(
  agent: Agent,
  models: T[],
  otherProviders: boolean,
): T[] {
  const owners = nativeOwners[agent];
  if (!owners || otherProviders) return models;
  // owned_by is the vendor for OAuth models and "<provider>-<hash>" for
  // API-key accounts registered as compatible providers.
  return models.filter(({ owned_by }) =>
    owners.some(
      (owner) => owned_by === owner || owned_by?.startsWith(`${owner}-`),
    ),
  );
}
const providerNames = new Map<string, string>([
  ["claude", "Claude"],
  ["codex", "Codex"],
  ["antigravity", "Antigravity"],
  ["kimi", "Kimi Code"],
  ["xai", "Grok"],
  ["opencode-go", "OpenCode Go"],
  ["openai", "OpenAI"],
  ["anthropic", "Anthropic API"],
  ["gemini", "Gemini"],
  ["custom", "Compatible API"],
]);
// The core names generated compatible providers "openai-compatible-<hash>".
export function providerLabel(provider: string): string {
  return (
    providerNames.get(provider) ??
    (provider.startsWith("openai-compatible-") ? "Compatible API" : provider)
  );
}
interface ProviderPreset {
  id: Provider;
  name: string;
  baseUrl: string;
  prefix: string;
  protocol: Protocol;
  models: string;
  detail: string;
}
export const apiPresets: ProviderPreset[] = [
  {
    id: "opencode-go",
    name: "OpenCode Go",
    baseUrl: "https://opencode.ai/zen/go/v1",
    prefix: "go",
    protocol: "openai",
    models: "",
    detail: "Models are discovered from your subscription.",
  },
  {
    id: "anthropic",
    name: "Anthropic API",
    baseUrl: "https://api.anthropic.com/v1",
    prefix: "anthropic",
    protocol: "anthropic",
    models: "",
    detail: "Enter model IDs enabled for your API key.",
  },
  {
    id: "openai",
    name: "OpenAI API",
    baseUrl: "https://api.openai.com/v1",
    prefix: "openai",
    protocol: "openai",
    models: "",
    detail: "Discover models or enter the ones you want to expose.",
  },
  {
    id: "custom",
    name: "Other compatible API",
    baseUrl: "",
    prefix: "",
    protocol: "openai",
    models: "",
    detail: "OpenAI, Anthropic, or Responses compatible endpoints.",
  },
];
// OpenCode Go publishes different wire protocols per model. Prefer live endpoint metadata.
export function goModelProtocol(id: string, endpoint?: string): Protocol {
  if (endpoint?.includes("/messages")) return "anthropic";
  if (endpoint?.includes("/responses")) return "responses";
  if (endpoint?.includes("/chat/completions")) return "openai";
  if (/^(gpt-|grok-|muse-)/.test(id)) return "responses";
  if (/^(minimax-|qwen)/.test(id)) return "anthropic";
  return "openai";
}
