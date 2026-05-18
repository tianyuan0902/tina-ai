export type TinaMvpRole = "founder" | "tina";

export type TinaMvpMessage = {
  id: string;
  role: TinaMvpRole;
  content: string;
};

export type TinaCandidateArchetype = {
  id: string;
  name: string;
  bestFor: string;
  signals: string[];
  tradeoffs: string[];
};

export type TinaReasoningResult = {
  reply: string;
  archetypes: TinaCandidateArchetype[];
};

export type TinaChatApiResponse = {
  message: TinaMvpMessage;
  source: "openai";
  responseId?: string;
};
