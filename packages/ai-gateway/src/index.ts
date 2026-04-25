// Providers
export { AnthropicAdapter, type AnthropicConfig } from './providers/anthropic.adapter.js'
export { MockAIAdapter } from './providers/mock.adapter.js'

// Context
export {
  ContextBuilder,
  type ContextBuilderOptions,
  type ConversationHistory,
  type UserContext,
} from './context/index.js'

// Prompts
export {
  // Base
  ISABELA_BASE,
  ISABELA_GREETING,
  ISABELA_RETURNING,
  // Diagnosis
  DIAGNOSIS_INTRO,
  DIAGNOSIS_QUESTIONS,
  DIAGNOSIS_COMPLETE,
  ARCHETYPE_INSIGHTS,
  type Archetype,
  // Journey
  getJourneyPrompt,
  DAILY_CHECKIN,
  type JourneyDay,
} from './prompts/index.js'
