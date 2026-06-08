import type { CanonicalSearchState } from "@/lib/brain/canonicalSearchState";
import type { CurrentRead } from "@/lib/tina-mvp/current-read";

export type SignalMap = {
  mustProveSignals: string[];
  weakSignals: string[];
  falsePositives: string[];
  interviewProbes: string[];
  bestCandidateArchetype: string;
  derivedFromThesisTitle: string;
};

const FALLBACK_TITLE = "Unknown / Needs Clarification";

export function buildSignalMap(currentRead?: CurrentRead, canonicalSearchState?: CanonicalSearchState): SignalMap {
  const thesisTitle = currentRead?.likelyArchetype || currentRead?.thesisTitle || FALLBACK_TITLE;
  const statedRole = currentRead?.statedRole || canonicalSearchState?.roleTitle || "this hire";

  switch (thesisTitle) {
    case "Engineering Leadership Bottleneck":
      return {
        derivedFromThesisTitle: thesisTitle,
        mustProveSignals: [
          "Has taken technical and product decision ownership without founder hand-holding.",
          "Has improved engineering execution rhythm in a messy startup environment.",
          "Can rebuild trust and morale while increasing accountability."
        ],
        weakSignals: [
          "Managed a large team in a mature company.",
          "Strong architecture background with no evidence of people leadership.",
          "Uses process language but cannot name decisions they owned."
        ],
        falsePositives: [
          "Process-heavy EM who creates meetings but not speed.",
          "Senior IC who can make technical calls but cannot own team operating cadence.",
          "Big-company engineering leader who needs too much support around ambiguity."
        ],
        interviewProbes: [
          "Tell me about a time you took decision ownership from a founder or exec team.",
          "How did you create clarity when product and engineering disagreed?",
          "What operating rhythm did you change, and what got faster because of it?"
        ],
        bestCandidateArchetype: "Early-stage engineering leader who has moved a team from founder-led decisions to delegated technical and product ownership."
      };
    case "Founder-Led Sales Transition":
      return {
        derivedFromThesisTitle: thesisTitle,
        mustProveSignals: [
          "Has converted founder-only sales motion into a repeatable customer conversation.",
          "Can win without borrowing the founder's credibility every time.",
          "Knows which deals are real market signal versus founder force."
        ],
        weakSignals: [
          "Top AE performance inside a mature sales machine.",
          "Big logo wins where the company brand carried the deal.",
          "Pipeline vocabulary without proof of creating a first sales motion."
        ],
        falsePositives: [
          "Polished seller who needs enablement, brand, and clean collateral.",
          "Revenue leader who wants to manage before proving the motion.",
          "Founder-like storyteller who cannot build repeatability."
        ],
        interviewProbes: [
          "Tell me about the first sales motion you built when the company still had little leverage.",
          "Which founder-led wins did you decide not to repeat?",
          "How did you know a customer objection was product truth versus sales noise?"
        ],
        bestCandidateArchetype: "Early sales builder who can separate founder magic from a repeatable wedge and still close scrappy first customers."
      };
    case "Senior Ownership Gap":
      return {
        derivedFromThesisTitle: thesisTitle,
        mustProveSignals: [
          "Has owned ambiguous work without waiting for founder direction.",
          "Can make judgment calls with incomplete context and explain the tradeoff.",
          "Has reduced founder dependency rather than becoming another escalation path."
        ],
        weakSignals: [
          "Impressive senior title with unclear decision rights.",
          "Strong execution history only when priorities were already clean.",
          "References autonomy but mostly reports status upward."
        ],
        falsePositives: [
          "Senior operator who adds polish but not ownership.",
          "Big-company lead who needs the problem pre-shaped.",
          "High-agency generalist who creates motion but not better decisions."
        ],
        interviewProbes: [
          "Tell me about a time you made a call your founder or manager had been avoiding.",
          "What did you own end-to-end that was not cleanly defined when you started?",
          "Where did you reduce leadership dependency in a previous company?"
        ],
        bestCandidateArchetype: "Senior operator or functional lead who has repeatedly turned messy founder context into owned decisions and forward motion."
      };
    case "Internal Technical Leadership Gap":
      return {
        derivedFromThesisTitle: thesisTitle,
        mustProveSignals: [
          "Can own technical direction with explicit authority.",
          "Has enough peer trust to lead without title theater.",
          "Can turn founder context into technical decisions."
        ],
        weakSignals: [
          "Strong IC output without leadership pull.",
          "Seniority that depends on founder approval.",
          "Architecture depth without team leverage."
        ],
        falsePositives: [
          "External senior hire who creates authority confusion.",
          "Internal lead who needs the founder to make every hard call.",
          "Technical expert who cannot create operating clarity."
        ],
        interviewProbes: [
          "Which decisions could this person own without founder approval?",
          "Where have they already created technical clarity for others?",
          "What authority would make or break their success?"
        ],
        bestCandidateArchetype: "Internal or external technical leader who can convert existing context into delegated technical ownership."
      };
    case "Role Compression / Generalist Hire":
      return {
        derivedFromThesisTitle: thesisTitle,
        mustProveSignals: [
          "Can identify the real primary lane inside an overstuffed role.",
          "Has operated across functions without pretending one person can do three jobs forever.",
          "Knows when to absorb ambiguity and when to force a sharper org decision."
        ],
        weakSignals: [
          "Comfortable wearing many hats but no evidence of prioritizing among them.",
          "Founder-adjacent title with vague ownership.",
          "Generalist energy without proof of durable outcomes."
        ],
        falsePositives: [
          "Chief-of-staff profile who becomes a smart helper, not an owner.",
          "Operator who says yes to everything and leaves the founder as the real decision-maker.",
          "Functional specialist stretched into a generalist role they cannot actually carry."
        ],
        interviewProbes: [
          "Tell me about a role where you had too many lanes. How did you decide what not to own?",
          "What did you push back on because the company was asking one hire to solve too much?",
          "Where did you create clarity without adding process theater?"
        ],
        bestCandidateArchetype: "Founder-adjacent operator who can narrow a compressed role into the one or two lanes that actually change the company."
      };
    case "Urgent Hiring Triage":
      return {
        derivedFromThesisTitle: thesisTitle,
        mustProveSignals: [
          "Can stabilize the immediate gap without distorting the long-term role.",
          "Has stepped into messy urgency and separated coverage from permanent design.",
          "Knows what to fix now versus what to leave for the durable hire."
        ],
        weakSignals: [
          "Available quickly but not proven in the real failure mode.",
          "Strong general background without calm under urgency.",
          "Willing to help but not able to reset the operating system."
        ],
        falsePositives: [
          "Interim profile who soothes the panic but leaves the root issue intact.",
          "Permanent hire rushed into a poorly shaped role.",
          "Senior candidate who needs too much onboarding for an urgent gap."
        ],
        interviewProbes: [
          "Tell me about the messiest gap you stepped into. What did you stabilize first?",
          "How did you avoid turning a short-term emergency into a bad permanent role?",
          "What would you refuse to solve in the first 30 days?"
        ],
        bestCandidateArchetype: "Crisis-capable senior operator who can cover the immediate gap while helping define the permanent role cleanly."
      };
    case "Product/Execution Ownership Gap":
      return {
        derivedFromThesisTitle: thesisTitle,
        mustProveSignals: [
          "Has turned messy founder/customer input into clear product decisions.",
          "Can own prioritization without becoming a roadmap secretary.",
          "Has shipped through ambiguity while keeping engineering moving."
        ],
        weakSignals: [
          "Roadmap ownership in a company where strategy was already clear.",
          "Strong stakeholder management with little evidence of hard tradeoff calls.",
          "Tasteful product language without proof of shipping pressure."
        ],
        falsePositives: [
          "Process-heavy PM who creates rituals but not clarity.",
          "Strategic PM who needs too much founder interpretation.",
          "Execution PM who can move tickets but cannot make the hard calls."
        ],
        interviewProbes: [
          "Tell me about a time you made a product tradeoff the founder or team resisted.",
          "How did you decide what not to build when everyone wanted something different?",
          "Where did you reduce founder involvement in product decisions?"
        ],
        bestCandidateArchetype: "Product leader who can take messy founder context, make product calls, and keep engineering moving without adding process theater."
      };
    case "Support Load Root Cause":
      return {
        derivedFromThesisTitle: thesisTitle,
        mustProveSignals: [
          "Can separate queue volume from product friction.",
          "Has reduced repeat support demand, not just answered tickets.",
          "Can turn customer pain into product or onboarding fixes."
        ],
        weakSignals: [
          "High ticket volume experience without root-cause work.",
          "Friendly support style with no systems-building proof.",
          "Coverage mindset disconnected from product feedback."
        ],
        falsePositives: [
          "Support rep who clears queues but never fixes the loop.",
          "Customer success profile who escalates every product gap.",
          "Ops person who treats symptoms as staffing issues."
        ],
        interviewProbes: [
          "Tell me about a support pattern you made disappear.",
          "How did you decide whether the issue was product, process, or customer fit?",
          "Where did customer support insight change the product or onboarding?"
        ],
        bestCandidateArchetype: "Customer-facing operator who can reduce support demand by fixing the product, onboarding, or implementation loop."
      };
    case "Recruiting System Before Recruiter":
      return {
        derivedFromThesisTitle: thesisTitle,
        mustProveSignals: [
          "Can make founder-led hiring repeatable.",
          "Has tightened roles before scaling sourcing.",
          "Can improve decision speed and interview calibration."
        ],
        weakSignals: [
          "Sourced candidates without fixing decision quality.",
          "Managed recruiting logistics in a mature process.",
          "Strong network but no calibration ownership."
        ],
        falsePositives: [
          "Recruiter who becomes a scheduling layer.",
          "Sourcer who sends volume into an unclear loop.",
          "Talent generalist who cannot push founder decisions."
        ],
        interviewProbes: [
          "How did you fix a messy hiring loop before adding volume?",
          "Where did you push back on a poorly shaped role?",
          "How did you speed up founder decision-making?"
        ],
        bestCandidateArchetype: "Fractional or early recruiting partner who can build the hiring system before scaling candidate volume."
      };
    default:
      return {
        derivedFromThesisTitle: thesisTitle,
        mustProveSignals: [
          `Can explain what problem ${statedRole} actually removes from the founder or team.`,
          "Has solved the underlying ownership gap before, not just held the matching title.",
          "Can name the tradeoffs they would make in the first 30-60 days."
        ],
        weakSignals: [
          "Title match without evidence of the operating problem.",
          "Polished interview language without proof of ownership.",
          "Experience in a cleaner environment than this company actually has."
        ],
        falsePositives: [
          "Candidate who looks right because the title matches.",
          "Smart helper who does not take the hard decisions off the founder.",
          "Specialist who needs the role to be cleaner than it is."
        ],
        interviewProbes: [
          "What was broken when you entered the role, and what changed because of you?",
          "Which decisions did you own that no one else wanted to own?",
          "Where did you create clarity without adding process theater?"
        ],
        bestCandidateArchetype: "High-ownership candidate who has solved the actual operating tension, not just performed the visible function."
      };
  }
}

export function formatSignalMapForPrompt(signalMap?: SignalMap) {
  if (!signalMap) return "";

  return [
    "Signal Map:",
    `Derived from thesis: ${signalMap.derivedFromThesisTitle}`,
    `Must prove: ${signalMap.mustProveSignals.join("; ")}`,
    `Weak signals: ${signalMap.weakSignals.join("; ")}`,
    `False positives: ${signalMap.falsePositives.join("; ")}`,
    `Interview probes: ${signalMap.interviewProbes.join("; ")}`,
    `Best candidate archetype: ${signalMap.bestCandidateArchetype}`
  ].join("\n");
}

export function buildSignalMapResponse(signalMap: SignalMap) {
  return [
    "Yes. I’d use this as the signal map before looking at candidates.",
    "",
    "Must prove:",
    ...signalMap.mustProveSignals.map((signal) => `- ${signal}`),
    "",
    "Weak signals:",
    ...signalMap.weakSignals.slice(0, 2).map((signal) => `- ${signal}`),
    "",
    "False positives:",
    ...signalMap.falsePositives.slice(0, 2).map((signal) => `- ${signal}`),
    "",
    "Interview probes:",
    ...signalMap.interviewProbes.slice(0, 2).map((probe) => `- ${probe}`),
    "",
    `Best archetype: ${signalMap.bestCandidateArchetype}`
  ].join("\n");
}
