const SEARCH_TERMS = {
  ai: ["AI product engineer", "founding engineer", "machine learning engineer", "software engineer"],
  product: ["product manager", "founding product manager", "head of product", "product lead"],
  backend: ["senior backend engineer", "distributed systems engineer"],
  operator: ["startup operator", "founder office operator"],
  design: ["founding product designer", "product designer"],
  gtm: ["founding account executive", "startup gtm", "sales leader", "growth operator"]
};

export function buildPublicTalentSearchQueries(hiringContext: string) {
  const text = hiringContext.toLowerCase();
  const roleTerms = inferRoleTerms(text);
  const environment = text.includes("startup") || text.includes("founding") ? "startup" : "early stage";

  return [
    `site:linkedin.com/in "${roleTerms[0]}" "${environment}"`,
    `site:linkedin.com/in "${roleTerms[1] || roleTerms[0]}" "${environment}"`,
    `site:linkedin.com/in "${roleTerms[2] || roleTerms[0]}" "customer-facing" "startup"`,
    buildPublicPortfolioQuery(roleTerms[0], text),
    `site:linkedin.com/in "${roleTerms[3] || roleTerms[0]}" "startup"`
  ].slice(0, 5);
}

function inferRoleTerms(text: string) {
  if (/\b(operator|ops|operations|chief of staff|founder office)\b/.test(text)) return SEARCH_TERMS.operator;
  if (/\b(gtm|sales|account executive|ae|growth|revenue)\b/.test(text)) return SEARCH_TERMS.gtm;
  if (/\b(pm|product manager|head of product|product lead)\b/.test(text)) return SEARCH_TERMS.product;
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
