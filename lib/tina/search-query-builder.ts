const SEARCH_TERMS = {
  ai: ["AI product engineer", "founding engineer", "machine learning engineer", "software engineer"],
  product: ["product manager", "founding product manager", "head of product", "product lead"],
  backend: ["senior backend engineer", "distributed systems engineer"],
  operator: ["startup operator", "founder office operator"],
  design: ["founding product designer", "product designer"],
  gtm: ["founding account executive", "startup gtm", "sales leader", "growth operator"],
  web3: ["Solidity engineer", "smart contract engineer", "DeFi engineer", "protocol engineer"]
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
  const roleTerms = inferRoleTerms(text);
  const environment = text.includes("startup") || text.includes("founding") ? "startup" : "early stage";
  const positiveTerm = compactPatternTerm(refinement?.positivePatterns?.[0] || refinement?.updatedSearchThesis || "");
  const domainTerm = inferDomainTerm(text);
  const qualifier = positiveTerm || domainTerm;
  const engineeringSearch = isEngineeringSearch(text);

  if (engineeringSearch) {
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
    `site:linkedin.com/in "${roleTerms[0]}" "${environment}"${qualifier ? ` "${qualifier}"` : ""}`,
    `site:linkedin.com/in "${roleTerms[1] || roleTerms[0]}" "${environment}"${qualifier ? ` "${qualifier}"` : ""}`,
    `site:linkedin.com/in "${roleTerms[2] || roleTerms[0]}" "customer-facing" "${domainTerm || "startup"}"`,
    buildPublicPortfolioQuery(roleTerms[0], text),
    `site:linkedin.com/in "${roleTerms[3] || roleTerms[0]}" "startup"`
  ].slice(0, 5);
}

function isEngineeringSearch(text: string) {
  if (/\b(pm|product manager|founding pm|head of product|product lead|account executive|sales|gtm|chief of staff|operator)\b/.test(text)) return false;
  return /\b(engineer|developer|software|full-stack|full stack|backend|frontend|ml engineer|ai engineer|product engineer|founding engineer|solidity|smart contract|technical founder)\b/.test(text);
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
