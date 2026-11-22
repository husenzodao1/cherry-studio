/**
 * The AI providers the staff may give Mahliyo (panel → "Маҳлиё AI" → "Моделҳо"), each with its models as
 * boxes. A key saved in a model's box makes that model answer from then on; the lessons, the books and her
 * rules stay with her whichever model answers. A model not listed can be typed in its provider's last box.
 */

export type ProviderId = 'anthropic' | 'openai' | 'deepseek' | 'google' | 'xai' | 'mistral'

export interface ProviderInfo {
  id: ProviderId
  name: string
  /** where its keys are made */
  keysAt: string
  /** OpenAI-compatible chat API (its address), or its own SDK */
  base?: string
  models: { id: string; note: string }[]
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic', name: 'Anthropic (Claude)', keysAt: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-fable-5-2', note: 'Беҳтарин тоҷикӣ ва фаҳмиш' },
      { id: 'claude-opus-5-5', note: 'Хеле боақл, барои масъалаҳои душвор' },
      { id: 'claude-sonnet-5-5', note: 'Тез ва боақл' },
      { id: 'claude-haiku-5-5', note: 'Хеле тез ва арзон' }
    ]
  },
  {
    id: 'openai', name: 'OpenAI (ChatGPT)', keysAt: 'https://platform.openai.com/api-keys', base: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-5', note: 'Модели асосии боақл' },
      { id: 'gpt-5-mini', note: 'Тез ва арзон' },
      { id: 'gpt-4.1', note: 'Устувор, бе фикркунии дароз' }
    ]
  },
  {
    id: 'deepseek', name: 'DeepSeek', keysAt: 'https://platform.deepseek.com/api_keys', base: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', note: 'Тез ва хеле арзон' },
      { id: 'deepseek-reasoner', note: 'Бо фикркунӣ, барои масъалаҳо' }
    ]
  },
  {
    id: 'google', name: 'Google (Gemini)', keysAt: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-3.5-flash', note: 'Тез ва боақл' },
      { id: 'gemini-3.1-flash-lite', note: 'Хеле тез' },
      { id: 'gemini-flash-latest', note: 'Охирин Flash' }
    ]
  },
  {
    id: 'xai', name: 'xAI (Grok)', keysAt: 'https://console.x.ai', base: 'https://api.x.ai/v1',
    models: [
      { id: 'grok-4', note: 'Модели асосии боақл' },
      { id: 'grok-3-mini', note: 'Тез ва арзон' }
    ]
  },
  {
    id: 'mistral', name: 'Mistral', keysAt: 'https://console.mistral.ai/api-keys', base: 'https://api.mistral.ai/v1',
    models: [
      { id: 'mistral-large-latest', note: 'Модели калонтарин' },
      { id: 'mistral-small-latest', note: 'Тез ва арзон' }
    ]
  }
]

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id) as [ProviderId, ...ProviderId[]]
export const providerOf = (id: string) => PROVIDERS.find((p) => p.id === id)
