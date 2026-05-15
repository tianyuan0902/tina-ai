export const INTERVIEW_SIGNAL_LIBRARY = {
  // Founder-editable: reusable interview signals Tina can pull into scorecards.
  signalDefinitions: [
    {
      signal: "ambiguity_tolerance",
      strongIndicators: ["operates well without perfect structure", "creates clarity independently", "comfortable evolving scope"],
      weakIndicators: ["needs excessive direction", "struggles in changing environments"]
    },
    {
      signal: "startup_execution",
      strongIndicators: ["ships quickly", "balances speed and quality", "prioritizes pragmatically"],
      weakIndicators: ["over-optimizes for perfection", "slow decision-making"]
    },
    {
      signal: "cross_functional_leadership",
      strongIndicators: ["influences beyond direct authority", "aligns technical and business priorities"],
      weakIndicators: ["operates only within functional silo"]
    }
  ],

  baseSignals: ["scope judgment", "execution under ambiguity", "communication clarity"],

  roleSignals: [
    {
      matchTerms: ["ai", "engineer", "ml", "infrastructure"],
      dimensions: ["technical depth", "product judgment", "evaluation rigor"],
      loop: [
        "Motivation, scope, and compensation reality screen",
        "Hiring manager technical problem deep dive",
        "Work sample tied to the first 90-day outcomes",
        "Cross-functional working style interview",
        "Founder close focused on tradeoffs and ownership"
      ]
    },
    {
      matchTerms: ["designer", "design", "ux"],
      dimensions: ["product taste", "systems thinking", "customer empathy"],
      loop: [
        "Motivation, scope, and compensation reality screen",
        "Portfolio walkthrough focused on decision quality",
        "Workflow critique or product sense exercise",
        "Cross-functional working style interview",
        "Founder close focused on tradeoffs and ownership"
      ]
    },
    {
      matchTerms: ["people", "talent", "operations", "head"],
      dimensions: ["manager partnership", "operating cadence", "trust building"],
      loop: [
        "Motivation, scope, and compensation reality screen",
        "Founder operating partnership conversation",
        "Manager coaching scenario",
        "Systems and rituals design exercise",
        "Founder close focused on tradeoffs and ownership"
      ]
    }
  ],

  sampleQuestions: [
    "Tell me about a role where the definition changed while you were already in motion.",
    "What did you decide not to solve in the first 90 days?",
    "Where do you tend to trade speed for quality, and where do you refuse to?"
  ]
} as const;
