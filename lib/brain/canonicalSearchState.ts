import type { ProfileLead } from "../tina/profile-lead-types";
import type { TinaMvpMessage } from "../tina-mvp/types";

export type CanonicalRoleFamily =
  | "engineering"
  | "product"
  | "design"
  | "gtm"
  | "operations"
  | "manufacturing operations"
  | "recruiting"
  | "people"
  | "finance"
  | "legal"
  | "other";

export type CanonicalSearchState = {
  roleTitle: string;
  roleFamily: CanonicalRoleFamily;
  seniority: string;
  location: string;
  mustHaveSignals: string[];
  niceToHaveSignals: string[];
  exclusions: string[];
  sourceCompanyLanes: string[];
  compensation: string;
  talentPoolSize: "Broad" | "Moderate" | "Narrow" | "Forming";
  timeToFill: string;
  candidateProfiles: ProfileLead[];
  calibrationStatus: "forming" | "calibrated" | "ready_to_source";
  evidenceLevel: "none" | "conversation" | "public_unverified" | "synthetic";
  lastUpdatedReason: string;
};

export function buildCanonicalSearchState(input: {
  messages: TinaMvpMessage[];
  profileLeads?: ProfileLead[];
}): CanonicalSearchState {
  const messages = input.messages || [];
  const founderText = messages.filter((message) => message.role === "founder").map((message) => message.content).join(" ");
  const latestRoleSignal = [...messages]
    .reverse()
    .filter((message) => message.role === "founder")
    .map((message) => message.content)
    .find(hasExplicitRoleSignal) || founderText;
  const allText = messages.map((message) => message.content).join(" ");
  const latestFounder = [...messages].reverse().find((message) => message.role === "founder")?.content || "";
  const text = allText.toLowerCase();
  const latestText = latestFounder.toLowerCase();
  const roleFamily = classifyRoleFamily(latestRoleSignal);
  const roleTitle = inferCanonicalRoleTitle(founderText, latestRoleSignal, roleFamily);
  const location = inferCanonicalLocation(`${latestRoleSignal} ${latestFounder}`);
  const seniority = inferCanonicalSeniority(`${latestRoleSignal} ${latestFounder}`, roleTitle);
  const candidateProfiles = (input.profileLeads || [])
    .map((lead) => ({
      ...lead,
      evidenceLevel: lead.evidenceLevel || (lead.url ? "unverified_lead" : "synthetic")
    }))
    .filter((lead) => leadMatchesCanonicalState(lead, roleFamily, location));
  const mustHaveSignals = inferMustHaveSignals(text, roleFamily).slice(0, 3);
  const niceToHaveSignals = inferNiceToHaveSignals(text, roleFamily).slice(0, 3);
  const exclusions = inferExclusions(text, roleFamily).slice(0, 4);
  const sourceCompanyLanes = inferSourceCompanyLanes(text, roleFamily, location).slice(0, 4);
  const compensation = inferCanonicalCompensation(text, roleFamily, seniority);
  const talentPoolSize = inferCanonicalPoolSize(text, roleFamily, location, candidateProfiles);
  const timeToFill = inferCanonicalTimeToFill(text, talentPoolSize);
  const evidenceLevel = candidateProfiles.some((lead) => lead.evidenceLevel === "synthetic")
    ? "synthetic"
    : candidateProfiles.length
      ? "public_unverified"
      : founderText.trim()
        ? "conversation"
        : "none";
  const calibrationStatus = candidateProfiles.length || /\b(source|candidate|profile|ready|asap|urgent)\b/i.test(text)
    ? "ready_to_source"
    : founderText.trim()
      ? "calibrated"
      : "forming";

  return {
    roleTitle,
    roleFamily,
    seniority,
    location,
    mustHaveSignals,
    niceToHaveSignals,
    exclusions,
    sourceCompanyLanes,
    compensation,
    talentPoolSize,
    timeToFill,
    candidateProfiles,
    calibrationStatus,
    evidenceLevel,
    lastUpdatedReason: latestText ? `Latest user signal: ${compact(latestFounder, 90)}` : "No role signal yet."
  };
}

function hasExplicitRoleSignal(value: string) {
  return classifyRoleFamily(value) !== "other" || /\b(head of eng|head of engineering|vp engineering|vp of engineering|engineering manager|eng manager|engineering leadership|engineering leader|director of engineering|engineering director|plant manager|software engineer|infrastructure engineer|smart contract engineer|solidity engineer|product eng|product engineer|product manager|founding pm|founding engineer|designer|account executive|recruiter|finance|legal)\b/i.test(value);
}

export function formatCanonicalSearchStateForPrompt(state: CanonicalSearchState) {
  const lines = [
    `Canonical role title: ${state.roleTitle}`,
    `Canonical role family: ${state.roleFamily}`,
    state.seniority !== "Seniority forming" ? `Seniority: ${state.seniority}` : "Seniority: unknown; infer a reasonable first-pass level if useful",
    state.location !== "Location forming" ? `Location: ${state.location}` : "Location: unknown; do not ask unless it blocks sourcing",
    state.mustHaveSignals.length ? `Must-have signals: ${state.mustHaveSignals.join(", ")}` : "Must-have signals: unknown; infer reasonable proof signals if useful",
    state.niceToHaveSignals.length ? `Nice-to-have signals: ${state.niceToHaveSignals.join(", ")}` : "",
    state.exclusions.length ? `Exclusions: ${state.exclusions.join(", ")}` : "Exclusions: unknown; do not ask unless a wrong lane is likely",
    state.sourceCompanyLanes.length ? `Source company lanes: ${state.sourceCompanyLanes.join(", ")}` : "Source company lanes: unknown; infer reasonable lanes if useful",
    state.compensation !== "Comp forming" ? `Compensation: ${state.compensation}` : "",
    `Talent pool size: ${state.talentPoolSize}`,
    state.timeToFill !== "TTF forming" ? `Time to fill: ${state.timeToFill}` : "",
    `Evidence level: ${state.evidenceLevel}`,
    `Last updated reason: ${state.lastUpdatedReason}`
  ];

  return lines.filter(Boolean).join("\n");
}

function classifyRoleFamily(value: string): CanonicalRoleFamily {
  const text = value.toLowerCase();
  if (/\bnot people hire\b/.test(text) && /\b(sales|gtm|account executive|ae\b|revenue)\b/.test(text)) return "gtm";
  if (/\b(people-ish|peopleish|people who feel|people.*right shape|show me.*people|people.*examples?|react to something)\b/.test(text)) return "other";
  if (/\b(plant manager|plant|factory|manufacturing|production manager|quality operations|fda|iso|medical device|pharma|regulated manufacturing)\b/.test(text)) return "manufacturing operations";
  if (isEngineeringLeadershipText(text)) return "engineering";
  if (/\b(engineer|eng\b|software|developer|backend|frontend|full[-\s]?stack|infrastructure|platform|devops|sre|ml engineer|ai engineer|product eng|founding engineer)\b/.test(text)) return "engineering";
  if (/\b(vp product|vp of product|chief product|cpo\b|product manager|founding pm|pm\b|head of product|product lead|product operator)\b/.test(text)) return "product";
  if (/\b(designer|design|ux|ui)\b/.test(text)) return "design";
  if (/\b(account executive|ae\b|sales|gtm|growth|revenue|business development|bd\b)\b/.test(text)) return "gtm";
  if (/\b(chief of staff|founder office|operator|operations|bizops|business operations)\b/.test(text)) return "operations";
  if (/\b(recruiter|sourcer|talent acquisition|recruiting)\b/.test(text)) return "recruiting";
  if (/\b(people|hr|human resources|people ops|head of people)\b/.test(text)) return "people";
  if (/\b(finance|controller|fp&a|cfo|accounting)\b/.test(text)) return "finance";
  if (/\b(legal|counsel|lawyer|attorney|compliance counsel)\b/.test(text)) return "legal";
  return "other";
}

function leadMatchesCanonicalState(lead: ProfileLead, family: CanonicalRoleFamily, location: string) {
  if (family === "other") return true;
  const text = `${lead.title} ${lead.snippet} ${lead.fitReason} ${lead.tags.join(" ")} ${lead.calibration?.scope || ""} ${lead.calibration?.roleTitle || ""} ${lead.calibration?.location || ""}`.toLowerCase();
  const leadFamily = classifyRoleFamily(text);
  const roleMatches = family === "manufacturing operations"
    ? leadFamily === "manufacturing operations" || /\b(plant|manufacturing|factory|production|quality|fda|iso)\b/.test(text)
    : leadFamily === family || (family === "engineering" && /\b(engineer|software|developer|infrastructure|platform|github|built|shipped)\b/.test(text));
  const locationMatches = !location || /forming/i.test(location) || locationMatchesLead(text, location);

  return roleMatches && locationMatches;
}

function locationMatchesLead(text: string, location: string) {
  if (/remote us \/ bay area plus/i.test(location)) return /\b(remote|distributed|united states|u\.s\.|usa|sf|san francisco|bay area|palo alto|menlo park|mountain view|san jose)\b/.test(text);
  if (/san francisco|sf bay area/i.test(location)) return /\b(sf|san francisco|bay area|palo alto|menlo park|mountain view|san jose)\b/.test(text);
  if (/peoria/i.test(location)) return /\bpeoria|illinois|midwest\b/.test(text);
  if (/remote/i.test(location)) return /\bremote|distributed\b/.test(text);
  if (/new york/i.test(location)) return /\bnew york|nyc|brooklyn|manhattan\b/.test(text);
  if (/chicago/i.test(location)) return /\bchicago\b/.test(text);
  return true;
}

function inferCanonicalRoleTitle(founderText: string, latestFounder: string, family: CanonicalRoleFamily) {
  const latestTitle = inferExplicitRoleTitle(latestFounder);
  if (latestTitle) return latestTitle;

  const text = `${latestFounder} ${founderText}`;
  const explicitTitle = inferExplicitRoleTitle(text);
  if (explicitTitle) return explicitTitle;
  if (family === "engineering" && isEngineeringLeadershipText(text)) return "Engineering Leadership";

  const fallback: Record<CanonicalRoleFamily, string> = {
    engineering: "Software Engineer",
    product: "Product Manager",
    design: "Product Designer",
    gtm: "GTM Hire",
    operations: "Operations Hire",
    "manufacturing operations": "Manufacturing Operations Leader",
    recruiting: "Recruiting Hire",
    people: "People Hire",
    finance: "Finance Hire",
    legal: "Legal Hire",
    other: "Role forming"
  };
  return fallback[family];
}

function inferExplicitRoleTitle(value: string) {
  const text = value;
  const lower = text.toLowerCase();
  if (/\b(vp sales|vp of sales)\b/.test(lower)) return "VP Sales";
  if (/\b(head of sales)\b/.test(lower)) return "Head of Sales";
  if (/\b(sales person|salesperson|sales hire)\b/.test(lower)) return "Sales Hire";
  if (/\b(first gtm hire|first sales hire)\b/.test(lower)) return "First GTM Hire";
  if (/\bfounding ae|founding account executive\b/.test(lower)) return "Founding AE";
  if (/\b(head of eng|head of engineering)\b/.test(lower)) return "Head of Engineering";
  if (/\b(vp engineering|vp of engineering)\b/.test(lower)) return "VP Engineering";
  if (/\b(engineering manager|eng manager)\b/.test(lower)) return "Engineering Manager";
  if (/\b(director of engineering|engineering director)\b/.test(lower)) return "Director of Engineering";
  if (/\b(engineering leadership|engineering leader)\b/.test(lower)) return "Engineering Leadership";
  if (/\b(senior|sr\b).*\b(ai infrastructure engineer|infrastructure engineer)\b/.test(lower) || /\b(ai infrastructure engineer|infrastructure engineer).*\b(senior|sr\b)\b/.test(lower)) return "Senior AI Infrastructure Engineer";
  if (/\b(senior software engineer|sr software engineer)\b/.test(lower)) return "Senior Software Engineer";
  if (/\bsmart contract engineer\b/.test(lower)) return "Smart Contract Engineer";
  if (/\bsolidity engineer\b/.test(lower)) return "Solidity Engineer";
  if (/\b(ai infrastructure engineer|infrastructure engineer)\b/.test(lower)) return "AI Infrastructure Engineer";
  if (/\bfounding engineer\b/.test(lower)) return "Founding Engineer";
  if (/\bplant manager\b/.test(lower)) return "Plant Manager";
  if (/\boperations director\b/.test(lower)) return "Operations Director";
  if (/\bmanufacturing manager\b/.test(lower)) return "Manufacturing Manager";
  if (/\bai product engineer\b/.test(lower)) return "AI Product Engineer";
  if (/\bproduct\s+eng(?:ineer)?s?\b/.test(lower)) return "Product Engineer";
  if (/\b(vp product|vp of product)\b/.test(lower)) return "VP Product";
  if (/\b(chief product officer|cpo)\b/.test(lower)) return "Chief Product Officer";
  if (/\bhead of product\b/.test(lower)) return "Head of Product";
  if (/\bfounding pm\b/.test(lower)) return "Founding PM";
  if (/\bproduct manager\b/.test(lower)) return "Product Manager";
  return "";
}

function inferCanonicalLocation(value: string) {
  const text = value.toLowerCase();
  if (/\b(sf|san francisco|bay area)\b/.test(text) && /\b(remote|anywhere|distributed)\b/.test(text)) return "Remote US / Bay Area plus";
  if (/\bremote\s+(us|u\.s\.|united states)|\bus\s+remote\b/.test(text)) return "Remote US";
  if (/\bpeoria\b/.test(text)) return "Peoria, IL";
  if (/\bsf|san francisco|bay area\b/.test(text)) return "San Francisco";
  if (/\bnyc|new york\b/.test(text)) return "New York";
  if (/\bchicago\b/.test(text)) return "Chicago";
  if (/\bindianapolis\b/.test(text)) return "Indianapolis";
  if (/\bus|u\.s\.|usa|united states\b/.test(text)) return "United States";
  if (/\b(no location constraint|location flexible|anywhere|global|distributed)\b/.test(text)) return "Flexible / remote";
  if (/\bremote\b/.test(text) && !/\b(don't want remote|dont want remote|not remote|no remote|strictly local)\b/.test(text)) return "Remote";
  return "Location forming";
}

function inferCanonicalSeniority(value: string, roleTitle: string) {
  const text = `${value} ${roleTitle}`.toLowerCase();
  if (/\b(exec|vp|c-level|chief|head of)\b/.test(text)) return "Executive";
  if (/\b(founding|principal|staff)\b/.test(text)) return "Founding / Principal";
  if (/\b(senior|sr\b|lead)\b/.test(text)) return "Senior";
  if (/\b(junior|associate|entry)\b/.test(text)) return "Junior";
  return "Seniority forming";
}

function inferMustHaveSignals(text: string, family: CanonicalRoleFamily) {
  const signals: string[] = [];
  if (family === "manufacturing operations") {
    if (/\bfloor|plant floor|shop floor|line leadership\b/.test(text)) signals.push("floor leadership");
    if (/\bquality|fda|iso|regulated\b/.test(text)) signals.push("quality ownership");
    if (/\bpeople|team|headcount|shift|labor\b/.test(text)) signals.push("people accountability");
  }
  if (family === "engineering") {
    if (isEngineeringLeadershipText(text)) {
      signals.push("engineering leadership", "technical judgment", "team operating cadence");
    } else {
      if (/\binfrastructure|platform|sre|distributed systems?\b/.test(text)) signals.push("infrastructure depth");
      if (/\b(shipped|built|owned|delivered|production|mainnet)\b/.test(text)) signals.push("shipping proof");
      if (/\btechnical ownership|ownership|end-to-end|end to end\b/.test(text)) signals.push("technical ownership");
    }
  }
  if (family === "product") {
    if (/\bproduct judgment|judgment|prioritization|tradeoff|trade-off\b/.test(text)) signals.push("product judgment");
    if (/\bcustomer|user|activation|onboarding|conversion\b/.test(text)) signals.push("customer signal");
  }
  if (family === "gtm") {
    if (/\bfounder.*clos|founder-led sales|founder led sales|vision|demo\b/.test(text)) signals.push("founder-led selling");
    if (/\brepeatable|not predictable|predictable|sales motion|motion\b/.test(text)) signals.push("repeatable sales motion");
    if (/\bcall|deal|pipeline|customer\b/.test(text)) signals.push("customer-facing sales proof");
  }
  if (/\bhealthcare|medical device|fda|iso|regulated\b/.test(text)) signals.push("regulated environment");
  if (/\brapid|scale|asap|urgent\b/.test(text)) signals.push("scale-up pace");
  return unique(signals);
}

function inferNiceToHaveSignals(text: string, family: CanonicalRoleFamily) {
  const signals: string[] = [];
  if (family === "manufacturing operations") signals.push("nearby hub access", "FDA/ISO familiarity");
  if (family === "engineering" && isEngineeringLeadershipText(text)) signals.push("founder-facing leadership", "scaling engineering teams");
  if (family === "engineering" && /\bai|ml|llm\b/.test(text)) signals.push("AI systems exposure");
  if (/\bstartup|founding\b/.test(text)) signals.push("startup pace");
  return unique(signals);
}

function inferExclusions(text: string, family: CanonicalRoleFamily) {
  const exclusions: string[] = [];
  exclusions.push(...inferNegatedRoleExclusions(text));
  if (family === "manufacturing operations") exclusions.push("generic startup operator", "pure GTM", "finance-only profile");
  if (family === "engineering" && isEngineeringLeadershipText(text)) exclusions.push("IC-only software engineer", "manager without technical judgment", "GTM-only profile");
  else if (family === "engineering") exclusions.push("founder office without building proof", "GTM-only profile");
  if (family === "gtm") {
    if (/\bnot people hire|not.*people\b/.test(text)) exclusions.push("people/recruiting profile");
    if (/\bbig company|corporate|whole machine|machine already working|late-stage|late stage\b/.test(text)) exclusions.push("late-stage VP who needs a mature machine");
    exclusions.push("founder office / generic operator");
  }
  if (/\bnot pm|not product\b/.test(text)) exclusions.push("product-only profile");
  return unique(exclusions);
}

function inferNegatedRoleExclusions(text: string) {
  const exclusions: string[] = [];
  const negated = (pattern: RegExp) => pattern.test(text);

  if (negated(/\b(not|no|isn['’]?t|is not|don['’]?t want|do not want)\b.{0,28}\b(people|recruiter|recruiting|hr|people ops)\b/i)) {
    exclusions.push("people/recruiting profile");
  }
  if (negated(/\b(not|no|isn['’]?t|is not|don['’]?t want|do not want)\b.{0,28}\b(pm|product manager|product)\b/i)) {
    exclusions.push("product-only profile");
  }
  if (negated(/\b(not|no|isn['’]?t|is not|don['’]?t want|do not want)\b.{0,28}\b(engineer|engineering|technical|developer)\b/i)) {
    exclusions.push("engineering-only profile");
  }
  if (negated(/\b(not|no|isn['’]?t|is not|don['’]?t want|do not want)\b.{0,28}\b(sales|gtm|ae|account executive|revenue)\b/i)) {
    exclusions.push("sales/GTM profile");
  }
  if (negated(/\b(not|no|isn['’]?t|is not|don['’]?t want|do not want)\b.{0,28}\b(chief of staff|founder.?s office|operator|ops generalist)\b/i)) {
    exclusions.push("founder-office / generic operator");
  }
  if (negated(/\b(not|no|isn['’]?t|is not|don['’]?t want|do not want)\b.{0,28}\b(big company|corporate|late[-\s]?stage|enterprise)\b/i)) {
    exclusions.push("corporate / late-stage profile");
  }

  return exclusions;
}

function inferSourceCompanyLanes(text: string, family: CanonicalRoleFamily, location: string) {
  if (family === "manufacturing operations") {
    return unique([
      /peoria/i.test(location) ? "Peoria / nearby Midwest plants" : "nearby manufacturing hubs",
      /\bhealthcare|medical device|medtech\b/.test(text) ? "medical-device manufacturing" : "regulated manufacturing",
      "quality-led operations teams",
      "scaled production environments"
    ]);
  }
  if (family === "engineering" && isEngineeringLeadershipText(text)) return ["startup engineering leadership", "scaled engineering teams", "founder-facing technical leaders", "architecture-heavy teams"];
  if (family === "engineering") return ["startup engineering teams", "infrastructure/platform teams", "builders with public proof"];
  if (family === "product") return ["founder-led product teams", "customer-facing product orgs"];
  if (family === "gtm") return ["first GTM hires", "founding AEs", "early sales leads", "founder-led sales builders"];
  return [];
}

function inferCanonicalCompensation(text: string, family: CanonicalRoleFamily, seniority: string) {
  if (/\b(market comp is fine|comp is fine|budget is fine|pay market|competitive comp|can pay market)\b/.test(text)) return "Market comp OK";
  if (family === "manufacturing operations") return "Comp forming";
  if (/senior|founding|principal|executive/i.test(seniority)) return "$220k-$300k+ directional";
  return "Comp forming";
}

function inferCanonicalPoolSize(text: string, family: CanonicalRoleFamily, location: string, leads: ProfileLead[]): CanonicalSearchState["talentPoolSize"] {
  if (!text.trim() && !leads.length) return "Forming";
  if (family === "manufacturing operations" && /peoria/i.test(location)) return "Narrow";
  if (leads.length >= 8) return "Moderate";
  if (leads.length > 0 && leads.length < 5) return "Narrow";
  return "Moderate";
}

function inferCanonicalTimeToFill(text: string, poolSize: CanonicalSearchState["talentPoolSize"]) {
  if (poolSize === "Forming") return "TTF forming";
  if (/\b(asap|urgent|rapid|quick|fast|immediately)\b/.test(text)) return "ASAP search · directional";
  if (poolSize === "Narrow") return "10-16 wks directional";
  return "8-12 wks directional";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isEngineeringLeadershipText(value: string) {
  return /\b(head of eng|head of engineering|vp engineering|vp of engineering|engineering manager|eng manager|engineering leadership|engineering leader|director of engineering|engineering director)\b/i.test(value);
}

function compact(value: string, max = 80) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
