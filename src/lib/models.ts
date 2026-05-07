export const AVAILABLE_MODELS = [
  { id: "openrouter/auto", name: "OpenRouter Auto" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free" },
  { id: "poolside/laguna-m.1:free" },
  { id: "openai/gpt-oss-120b:free" },
  { id: "z-ai/glm-4.5-air:free" },
  { id: "minimax/minimax-m2.5:free" },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];
