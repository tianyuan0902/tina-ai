"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveBrainContext = retrieveBrainContext;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const KNOWLEDGE_BASE_DIR = node_path_1.default.join(process.cwd(), "knowledge_base");
const MIN_RELEVANCE_SCORE = 8;
const IMPORTANT_TERMS = new Set([
    "ai",
    "adaptability",
    "ambiguity",
    "archetype",
    "autonomy",
    "backend",
    "candidate",
    "chaos",
    "clarity",
    "comp",
    "compensation",
    "compatibility",
    "contract",
    "corporate",
    "crypto",
    "decision",
    "differentiated",
    "defi",
    "emotional",
    "engineer",
    "environment",
    "faang",
    "fail",
    "failed",
    "failure",
    "founder",
    "founding",
    "gtm",
    "india",
    "hire",
    "hiring",
    "infra",
    "inr",
    "interview",
    "interviewer",
    "judgment",
    "learning",
    "matching",
    "ownership",
    "operator",
    "pay",
    "pedigree",
    "pm",
    "product",
    "protocol",
    "recruiting",
    "remote",
    "roadmap",
    "salary",
    "security",
    "senior",
    "signal",
    "signals",
    "solidity",
    "sourcing",
    "startup",
    "stress",
    "smart",
    "smartcontract",
    "tc",
    "taste",
    "technical",
    "trust",
    "web3"
]);
const DOMAIN_GUARDS = [
    {
        name: "smart-contract",
        query: /\b(smartcontract|smart contract|solidity|web3|crypto|defi|onchain|on-chain|protocol)\b/i,
        chunk: /\b(smartcontract|smart contract|solidity|web3|crypto|defi|onchain|on-chain|protocol)\b/i
    },
    {
        name: "ai-product",
        query: /\b(ai|llm|model|prompt|eval|workflow|agent)\b/i,
        chunk: /\b(ai|llm|model|prompt|eval|workflow|agent)\b/i
    },
    {
        name: "product",
        query: /\b(pm|product manager|roadmap|customer|customers|discovery|product)\b/i,
        chunk: /\b(pm|product manager|roadmap|customer|customers|discovery|product)\b/i
    },
    {
        name: "backend",
        query: /\b(backend|systems|infrastructure|infra|architecture|reliability)\b/i,
        chunk: /\b(backend|systems|infrastructure|infra|architecture|reliability)\b/i
    },
    {
        name: "operator",
        query: /\b(operator|operations|chaos|process|cross-functional|execution)\b/i,
        chunk: /\b(operator|operations|chaos|process|cross-functional|execution)\b/i
    },
    {
        name: "compensation",
        query: /\b(comp|compensation|salary|pay|paid|offer|equity|bonus|total comp|tc|levels?\.?fyi|lpa|inr|remote pay|location-adjusted|same pay)\b/i,
        chunk: /\b(comp|compensation|salary|pay|paid|offer|equity|bonus|total comp|tc|levels?\.?fyi|lpa|inr|remote pay|location-adjusted|same pay)\b/i
    }
];
function retrieveBrainContext(latestUserMessage, maxChunks = 4) {
    var _a, _b;
    const queryTerms = tokenize(latestUserMessage);
    const chunks = getKnowledgeBaseFiles().flatMap(readBrainChunks);
    const scored = chunks
        .filter((chunk) => !normalize(chunk.content).startsWith("bad"))
        .map((chunk) => ({
        ...chunk,
        score: scoreChunk(chunk.content, latestUserMessage, queryTerms)
    }))
        .filter((chunk) => chunk.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxChunks);
    const topScore = (_b = (_a = scored[0]) === null || _a === void 0 ? void 0 : _a.score) !== null && _b !== void 0 ? _b : 0;
    const selected = topScore >= MIN_RELEVANCE_SCORE
        ? scored.filter((chunk) => chunk.score >= Math.max(MIN_RELEVANCE_SCORE, topScore * 0.7))
        : [];
    return {
        chunks: selected,
        context: selected.map((chunk) => `Source: ${chunk.file}\n${chunk.content}`).join("\n\n---\n\n")
    };
}
function getKnowledgeBaseFiles() {
    return walkMarkdownFiles(KNOWLEDGE_BASE_DIR).sort();
}
function walkMarkdownFiles(dir) {
    return (0, node_fs_1.readdirSync)(dir).flatMap((entry) => {
        const fullPath = node_path_1.default.join(dir, entry);
        const stat = (0, node_fs_1.statSync)(fullPath);
        if (stat.isDirectory())
            return walkMarkdownFiles(fullPath);
        if (stat.isFile() && entry.endsWith(".md"))
            return [fullPath];
        return [];
    });
}
function readBrainChunks(filePath) {
    const content = (0, node_fs_1.readFileSync)(filePath, "utf8").trim();
    const file = node_path_1.default.relative(KNOWLEDGE_BASE_DIR, filePath);
    const shouldKeepWholeFile = file.startsWith("live_qa/") || file.startsWith("examples/");
    const chunks = shouldKeepWholeFile ? [content] : splitIntoChunks(content);
    return chunks
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .filter((chunk) => !/^#+\s.+$/.test(chunk))
        .map((chunk, index) => ({
        id: `${file}:${index + 1}`,
        file,
        content: chunk,
        score: 0
    }));
}
function splitIntoChunks(content) {
    return content.split(/\n\s*\n(?=#+\s|Question:|Tina Answer:|Key Pattern:|Why It Matters:|- |\w)/);
}
function scoreChunk(content, query, queryTerms) {
    const normalized = normalize(content);
    const chunkTerms = tokenize(content);
    let score = 0;
    for (const term of queryTerms) {
        if (normalized.includes(term))
            score += IMPORTANT_TERMS.has(term) ? 3 : 1;
    }
    if (queryTerms.includes("smart") && queryTerms.includes("contract") && normalized.includes("smart contract")) {
        score += 8;
    }
    if (queryTerms.includes("smartcontract") && normalized.includes("smart contract")) {
        score += 8;
    }
    if (queryTerms.includes("corporate") && normalized.includes("too corporate")) {
        score += 6;
    }
    if (queryTerms.includes("faang") && normalized.includes("faang")) {
        score += 6;
    }
    if (/\b(startup|hire|hires|hiring)\b/i.test(query) && /\b(fail|fails|failed|failure|amazing)\b/i.test(query) &&
        /\b(high pressure emotional system|incompatibility in motion|calibration failures|not competency)\b/i.test(content)) {
        score += 10;
    }
    if (/\b(ai|technical|skills|execution)\b/i.test(query) && /\b(less differentiated|differentiated|differentiation|levels)\b/i.test(query) &&
        /\b(judgment|taste|adaptability|context synthesis|emotional regulation)\b/i.test(content)) {
        score += 10;
    }
    if (/\b(felt off|something off|interviewed perfectly)\b/i.test(query) &&
        /\b(inconsistency|underneath the words|compressed pattern recognition|confidence.*judgment)\b/i.test(content)) {
        score += 8;
    }
    if (/\b(ai native|ai-native|product oriented|product-oriented)\b/i.test(query) &&
        /\b(startup-native builders|startup native builders|high-agency operators|ambiguity tolerance|product-thinking engineers)\b/i.test(content)) {
        score += 12;
    }
    if (/\b(right experience|perfect on paper|all the right experience|feels off)\b/i.test(query) &&
        /\b(signal extraction|interview inconsistency|judgment under pressure|founder intuition|strong candidate signals)\b/i.test(content)) {
        score += 12;
    }
    if (/\b(nobody around me|sees the business|as deeply as i do|shared judgment)\b/i.test(query) &&
        /\b(founder loneliness|context density|trust under scaling|executive calibration|shared judgment)\b/i.test(content)) {
        score += 12;
    }
    if (/\b(thinks like me|without me explaining|run with things|need someone who thinks)\b/i.test(query) &&
        /\b(founder mirror hiring|independent operator patterns|ambiguity tolerance|trust generation|low explanation dependency)\b/i.test(content)) {
        score += 12;
    }
    if (/\b(candidates|pipeline|exceptional|few people actually feel)\b/i.test(query) &&
        /\b(talent bar calibration|founder signal clarity|market positioning|role definition quality|exceptional)\b/i.test(content)) {
        score += 12;
    }
    if (/\b(comp|compensation|salary|pay|paid|offer|equity|bonus|total comp|tc|levels?\.?fyi|lpa|inr|remote pay|location adjusted|same pay|location agnostic)\b/i.test(query) &&
        /\b(compensation|salary|pay|total compensation|levels\.fyi|leetcode compensation|equal pay|location-agnostic|location-adjusted|equity|bonus|market benchmarking)\b/i.test(content)) {
        score += 16;
    }
    if (/\b(india|bangalore|bengaluru|hyderabad|delhi|mumbai|pune|chennai|inr|lpa)\b/i.test(query) &&
        /\b(india|indian|inr|lpa|leetcode compensation|bangalore|bengaluru|hyderabad|pune|chennai)\b/i.test(content)) {
        score += 12;
    }
    if (/\b(remote|global|distributed|location|same pay|equal pay|location agnostic|location adjusted)\b/i.test(query) &&
        /\b(equal pay|remote workers|location-agnostic|location-adjusted|same pay everywhere|distributed|geography)\b/i.test(content)) {
        score += 12;
    }
    if (/\b(strong people|leave|disengaged|a players|few months)\b/i.test(query) &&
        /\b(emotional operating compatibility|founder anxiety dynamics|autonomy vs visibility|startup pressure systems|strong people can disengage)\b/i.test(content)) {
        score += 12;
    }
    if (normalized.startsWith("good")) {
        score += 4;
    }
    if (normalized.startsWith("bad")) {
        score -= 10;
    }
    score += sharedTermCount(queryTerms, chunkTerms);
    if (hasConflictingDomain(query, content)) {
        score -= 18;
    }
    score += exclusiveDomainAdjustment(query, content);
    return score;
}
function exclusiveDomainAdjustment(query, content) {
    let adjustment = 0;
    if (/\b(smartcontract|smart contract|solidity|web3|crypto|defi|onchain|on-chain|protocol)\b/i.test(content) &&
        !/\b(smartcontract|smart contract|solidity|web3|crypto|defi|onchain|on-chain|protocol)\b/i.test(query)) {
        adjustment -= 24;
    }
    if (/\b(ai|llm|prompt|eval|model behavior|agent)\b/i.test(content) &&
        !/\b(ai|llm|prompt|eval|model|agent)\b/i.test(query)) {
        adjustment -= 14;
    }
    if (/\b(backend|systems|infrastructure|architecture)\b/i.test(content) &&
        !/\b(backend|systems|infrastructure|infra|architecture|reliability)\b/i.test(query)) {
        adjustment -= 10;
    }
    return adjustment;
}
function hasConflictingDomain(query, content) {
    const queryDomains = DOMAIN_GUARDS.filter((domain) => domain.query.test(query)).map((domain) => domain.name);
    const chunkDomains = DOMAIN_GUARDS.filter((domain) => domain.chunk.test(content)).map((domain) => domain.name);
    if (!queryDomains.length || !chunkDomains.length)
        return false;
    if (chunkDomains.some((domain) => queryDomains.includes(domain)))
        return false;
    return chunkDomains.some((domain) => !queryDomains.includes(domain));
}
function sharedTermCount(a, b) {
    const bTerms = new Set(b);
    return a.filter((term) => IMPORTANT_TERMS.has(term) && bTerms.has(term)).length;
}
function tokenize(value) {
    return normalize(value)
        .split(" ")
        .filter((term) => term.length > 2);
}
function normalize(value) {
    return value
        .toLowerCase()
        .replace(/\bsmartcontract\b/g, "smartcontract smart contract")
        .replace(/[-_/]/g, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
