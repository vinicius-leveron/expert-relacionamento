// AI Providers
export { AnthropicAdapter, type AnthropicConfig } from './providers/anthropic.adapter.js'
export { MockAIAdapter } from './providers/mock.adapter.js'

// Embeddings
export {
  type EmbeddingPort,
  type EmbeddingResult,
  OpenAIEmbeddingAdapter,
  type OpenAIEmbeddingConfig,
  MockEmbeddingAdapter,
} from './embeddings/index.js'

// RAG
export {
  AttachmentRAGService,
  type AttachmentRAGServiceConfig,
  type AttachmentRAGSearchOptions,
  type AttachmentKnowledgeChunk,
  RAGService,
  type RAGServiceConfig,
  type RAGSearchOptions,
  type KnowledgeChunk,
} from './rag/index.js'

// Transcription
export {
  type TranscriptionPort,
  type TranscriptionResult,
  WhisperAdapter,
  type WhisperConfig,
  MockTranscriptionAdapter,
} from './transcription/index.js'

// Context
export {
  ContextBuilder,
  type ContextBuilderOptions,
  type ConversationHistory,
  type UserContext,
} from './context/index.js'

// Prompts
export {
  ATTACHMENT_CITATION_SYSTEM_ADDITION,
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
  buildDirectionalPlan,
  DAILY_CHECKIN,
  type JourneyDay,
  // Image Analysis
  IMAGE_ANALYSIS_PROMPT,
  IMAGE_ANALYSIS_SYSTEM_ADDITION,
  AGENT_IDS,
  AGENT_PROMPT_REGISTRY,
  agentRequiresStructuredDiagnosis,
  getAgentSystemPrompt,
  isAgentId,
  type AgentId,
  type AgentPromptDefinition,
} from './prompts/index.js'

// Diagnostic Service
export {
  DiagnosticService,
  type DiagnosticAnswer,
  type DiagnosticResult,
  type DiagnosticScores,
  type DiagnosticState,
} from './diagnostic/index.js'
