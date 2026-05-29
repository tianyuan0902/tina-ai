const SEARCH_TERMS = {
  ai: ["AI product engineer", "founding engineer", "machine learning engineer", "software engineer"],
  aiInfra: [
    "AI Infrastructure Engineer",
    "ML Infrastructure Engineer",
    "ML Platform Engineer",
    "AI Platform Engineer",
    "Senior Backend Engineer",
    "Staff Software Engineer",
    "Founding Infrastructure Engineer"
  ],
  product: ["product manager", "founding product manager", "head of product", "product lead"],
  backend: ["senior backend engineer", "distributed systems engineer"],
  operator: ["startup operator", "founder office operator"],
  design: ["founding product designer", "product designer"],
  gtm: ["founding account executive", "startup gtm", "sales leader", "growth operator"],
  web3: ["Solidity engineer", "smart contract engineer", "DeFi engineer", "protocol engineer"],
  plant: ["plant manager", "manufacturing operations manager", "operations director", "quality operations leader"]
};

export type PublicTalentSearchRefinement = {
  positivePatterns?: string[];
  negativePatterns?: string[];
  updatedSearchThesis?: string;
  updatedQueries?: string[];
};

export function buildPublicTalentSearchQueries(hiringContext: string, refinement?: PublicTalentSearchRefinement) {
  if (refinement?.updatedQueries?.length) return refinement.updatedQueries.slice(0, 5);

  const text = hiringContext.toLowerCase();
  const canonicalFamily = inferCanonicalRoleFamily(text);
  const roleTerms = inferRoleTerms(text);
  const environment = text.includes("startup") || text.includes("founding") ? "startup" : "early stage";
  const positiveTerm = compactPatternTerm(refinement?.positivePatterns?.[0] || refinement?.updatedSearchThesis || "");
  const domainTerm = inferDomainTerm(text);
  const location = inferLocationTerm(text);
  const qualifier = positiveTerm || domainTerm;
  const engineeringSearch = isEngineeringSearch(text);

  if (canonicalFamily === "manufacturing operations" || isPlantSearch(text)) {
    const domain = inferPlantDomainTerm(text);
    const terms = roleTerms.length ? roleTerms : SEARCH_TERMS.plant;

    return [
      `site:linkedin.com/in "${terms[0]}" "${location || domain || "manufacturing"}"`,
      `site:linkedin.com/in "${terms[1] || "manufacturing operations manager"}" "${domain || "regulated manufacturing"}"`,
      `site:linkedin.com/in "${terms[2] || "operations director"}" "${location || "Midwest"}" "${domain || "manufacturing"}"`,
      `site:linkedin.com/in "${terms[3] || "quality operations leader"}" "FDA" "ISO"`,
      `site:linkedin.com/in "plant manager" "scale-up" "${domain || "manufacturing"}"`
    ].slice(0, 5);
  }

  if ((canonicalFamily === "engineering" || engineeringSearch) && isAiInfrastructureSearch(text)) {
    return buildAiInfrastructureQueries(text);
  }

  if (canonicalFamily === "engineering" || engineeringSearch) {
    const engineeringTerms = roleTerms.some((term) => /\bengineer|developer\b/i.test(term))
      ? roleTerms
      : ["software engineer", "founding engineer", "product engineer", "full-stack engineer", "ML engineer"];

    return [
      `site:linkedin.com/in "${engineeringTerms[0]}" "${environment}" "built" -sales -\"account executive\" -gtm`,
      `site:linkedin.com/in "${engineeringTerms[1] || "software engineer"}" "${domainTerm || "startup"}" "shipped" -sales -revenue`,
      `site:linkedin.com/in "${engineeringTerms[2] || "product engineer"}" "GitHub" "technical founder" -\"business development\"`,
      buildPublicPortfolioQuery(engineeringTerms[0], text),
      `site:github.com "${engineeringTerms[3] || "full-stack engineer"}" "${domainTerm || "startup"}" "built"`
    ].slice(0, 5);
  }

  return [
    `site:linkedin.com/in "${roleTerms[0]}" "${location || environment}"${qualifier ? ` "${qualifier}"` : ""}`,
    `site:linkedin.com/in "${roleTerms[1] || roleTerms[0]}" "${location || environment}"${qualifier ? ` "${qualifier}"` : ""}`,
    `site:linkedin.com/in "${roleTerms[2] || roleTerms[0]}" "customer-facing" "${location || domainTerm || "startup"}"`,
    buildPublicPortfolioQuery(roleTerms[0], text),
    `site:linkedin.com/in "${roleTerms[3] || roleTerms[0]}" "${location || "startup"}"`
  ].slice(0, 5);
}

export function buildExpandedPublicTalentSearchQueries(hiringContext: string, pass: "adjacent" | "domain") {
  const text = hiringContext.toLowerCase();

  if (isAiInfrastructureSearch(text)) {
    const location = inferLocationTerm(text) || "San Francisco";
    const domain = inferDomainTerm(text);

    if (pass === "adjacent") {
      return [
        `site:linkedin.com/in "ML Infrastructure Engineer" "${location}"`,
        `site:linkedin.com/in "ML Platform Engineer" "${location}"`,
        `site:linkedin.com/in "AI Platform Engineer" "${location}"`,
        `site:linkedin.com/in "Backend Infrastructure Engineer" "${location}"`,
        `site:linkedin.com/in "Staff Software Engineer" "ML Platform" "${location}"`
      ];
    }

    return [
      `"AI infrastructure" "Stripe" "engineer" "${location}"`,
      `"ML platform" "${domain || "fintech"}" "engineer" "${location}"`,
      `site:github.com "ML infrastructure" "${location}" engineer`,
      `site:linkedin.com/in "Senior Software Engineer" "AI infrastructure" "${location}"`,
      `site:linkedin.com/in "Founding Infrastructure Engineer" "AI" "${location}"`
    ];
  }

  return [];
}

function buildAiInfrastructureQueries(text: string) {
  const location = inferLocationTerm(text) || "San Francisco";
  const domain = inferDomainTerm(text);

  return [
    `site:linkedin.com/in "AI Infrastructure Engineer" "${location}"`,
    `site:linkedin.com/in "ML Infrastructure Engineer" "${location}"`,
    `site:linkedin.com/in "ML Platform Engineer" "${location}"${domain ? ` ${domain}` : ""}`,
    `site:linkedin.com/in "AI Platform Engineer" "${location}"`,
    `"Senior Backend Engineer" "ML infrastructure" "${location}"`,
    `"Staff Software Engineer" "AI infrastructure" "${location}"`,
    `site:github.com "ML infrastructure" "${location}" engineer`,
    `"AI infrastructure" "Stripe" "engineer" "${location}"`,
    `"ML platform" "${domain || "fintech"}" "engineer" "${location}"`
  ];
}

function isEngineeringSearch(text: string) {
  if (inferCanonicalRoleFamily(text) === "engineering") return true;
  if (/\b(pm|product manager|founding pm|head of product|product lead|account executive|sales|gtm|chief of staff|operator)\b/.test(text)) return false;
  return /\b(engineer|developer|software|full-stack|full stack|backend|frontend|ml engineer|ai engineer|product engineer|founding engineer|solidity|smart contract|technical founder)\b/.test(text);
}

function isPlantSearch(text: string) {
  if (inferCanonicalRoleFamily(text) === "manufacturing operations") return true;
  return /\b(plant manager|plant|factory|manufacturing|production manager|operations director|quality operations|fda|iso|medical device|pharma)\b/.test(text);
}

function inferCanonicalRoleFamily(text: string) {
  const match = text.match(/canonical role family:\s*([a-z ]+)/i);
  return match?.[1]?.trim() || "";
}

function isAiInfrastructureSearch(text: string) {
  if (/canonical role title:\s*product engineer/i.test(text)) return false;
  return /\b(ai infrastructure|ml infrastructure|machine learning infrastructure|ml platform|ai platform|platform engineer|infrastructure engineer|backend infra|backend infrastructure)\b/.test(text) ||
    (/canonical role family:\s*engineering/i.test(text) && /\b(infrastructure|platform|backend)\b/.test(text) && /\b(ai|ml|machine learning|llm)\b/.test(text));
}

function inferLocationTerm(text: string) {
  if (/\bpeoria\b/.test(text)) return "Peoria Illinois";
  if (/\bchicago\b/.test(text)) return "Chicago";
  if (/\bindianapolis\b/.test(text)) return "Indianapolis";
  if (/\bsf|san francisco|bay area\b/.test(text)) return "San Francisco";
  return "";
}

function inferPlantDomainTerm(text: string) {
  if (/\bhealthcare|medical device|medtech\b/.test(text)) return "medical device manufacturing";
  if (/\bpharma|biotech\b/.test(text)) return "pharma manufacturing";
  if (/\bfood production|food manufacturing\b/.test(text)) return "food manufacturing";
  if (/\bfda|iso|regulated\b/.test(text)) return "regulated manufacturing";
  return "";
}

function inferDomainTerm(text: string) {
  if (/\b(nlp|document parsing|language model)\b/.test(text)) return "NLP";
  if (/\b(fintech|banking|fraud|credit|underwriting|compliance)\b/.test(text)) return "fintech";
  if (/\b(ai|llm|model|agent|machine learning|ml)\b/.test(text)) return "AI";
  return "";
}

function inferRoleTerms(text: string) {
  const explicitProductRole = /\b(pm|product manager|founding pm|head of product|product lead)\b/.test(text);
  const explicitEngineeringRole = /\b(engineer|developer|solidity|smartcontract|smart contract engineer|protocol engineer|code|coding)\b/.test(text);
  const canonicalFamily = inferCanonicalRoleFamily(text);

  if (canonicalFamily === "manufacturing operations" || isPlantSearch(text)) return SEARCH_TERMS.plant;
  if (/\bproduct\s+eng(?:ineer)?s?\b/.test(text)) return ["product engineer", "founding product engineer", "software engineer", "full-stack engineer", "AI product engineer"];
  if (canonicalFamily === "engineering" && isAiInfrastructureSearch(text)) return SEARCH_TERMS.aiInfra;
  if (canonicalFamily === "engineering" && /\b(infrastructure|platform|systems|backend)\b/.test(text)) return SEARCH_TERMS.backend;
  if (canonicalFamily === "engineering") return ["software engineer", "founding engineer", "product engineer", "full-stack engineer", "ML engineer"];
  if (canonicalFamily === "product") return SEARCH_TERMS.product;
  if (/\b(operator|ops|operations|chief of staff|founder office)\b/.test(text)) return SEARCH_TERMS.operator;
  if (/\b(gtm|sales|account executive|ae|growth|revenue)\b/.test(text)) return SEARCH_TERMS.gtm;
  if (explicitProductRole) return SEARCH_TERMS.product;
  if (explicitEngineeringRole && /\b(solidity|smart contract|smartcontract|web3|defi|protocol|mainnet)\b/.test(text)) return SEARCH_TERMS.web3;
  if (/\b(design|designer)\b/.test(text)) return SEARCH_TERMS.design;
  if (/\b(backend|infra|infrastructure|systems|platform)\b/.test(text)) return SEARCH_TERMS.backend;
  if (/\b(ai|llm|model|agent|machine learning|ml)\b/.test(text)) return SEARCH_TERMS.ai;

  return ["founding engineer", "startup generalist", "product-minded builder"];
}

function buildPublicPortfolioQuery(roleTerm: string, text: string) {
  if (/\b(ai|llm|model|agent|machine learning|ml|engineer|developer)\b/.test(text)) {
    return `site:linkedin.com/in "${roleTerm}" "AI" "startup"`;
  }

  return `site:linkedin.com/in "${roleTerm}" "startup"`;
}

function compactPatternTerm(value: string) {
  const cleaned = value
    .replace(/\b(title|company|source|confidence|tags|fitReason|snippet|scope|mustHaves)=/gi, "")
    .replace(/[;|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = cleaned.match(/\b(founder(?:[-\s]adjacent)?|customer-facing|product judgment|startup|operator|ai|llm|builder|clarity|ownership|workflow|evals?)\b/i);

  return match?.[0] || "";
}
