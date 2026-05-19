type TavilyCompanyResult = {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
};

export type CompanyContextResult = {
  query: string;
  snippets: Array<{
    title: string;
    url: string;
    content: string;
  }>;
};

export function isCompanyContextMessage(message: string) {
  return /\b(my|our)\s+company\b|\bcompany\s+is\s+called\b|\bwe\s+(build|make|sell|do|are)\b|\b(product|startup)\s+is\b/i.test(message);
}

export async function retrieveCompanyContext(message: string): Promise<CompanyContextResult | null> {
  if (!process.env.TAVILY_API_KEY || !isCompanyContextMessage(message)) return null;

  const query = buildCompanyQuery(message);

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: 3,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      console.error("[Tina company context] Tavily request failed:", response.status);
      return null;
    }

    const data = (await response.json()) as { results?: TavilyCompanyResult[] };
    const snippets = (data.results || [])
      .filter((result) => result.title && result.url)
      .slice(0, 3)
      .map((result) => ({
        title: cleanText(result.title || "Company result", 90),
        url: result.url || "",
        content: cleanText(result.content || result.snippet || "", 220)
      }));

    if (!snippets.length) return null;

    return { query, snippets };
  } catch (error) {
    console.error("[Tina company context] Tavily request failed:", error);
    return null;
  }
}

export function formatCompanyContext(context: CompanyContextResult | null) {
  if (!context?.snippets.length) return "";

  return [
    "Public company context from web search. Use lightly and do not overstate certainty:",
    `Query: ${context.query}`,
    ...context.snippets.map((snippet, index) => `${index + 1}. ${snippet.title} — ${snippet.content} (${snippet.url})`)
  ].join("\n");
}

function buildCompanyQuery(message: string) {
  const cleaned = message
    .replace(/\b(my|our)\s+company\s+(is\s+called|is|called)\b/gi, "")
    .replace(/\bdoes\b/gi, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `${cleaned} company product startup hiring`.trim();
}

function cleanText(value: string, maxLength: number) {
  const cleaned = value
    .replace(/https?:\/\/\S+/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x2019;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).replace(/\s+\S*$/, "")}...`;
}
