import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const evalDir = path.join(root, "evals", "evals:retrieval_quality");
const knowledgeDir = path.join(root, "knowledge_base");
const compiledRetriever = path.join(root, ".tmp", "eval-retrieval", "retrieveBrainContext.js");

if (!existsSync(evalDir)) {
  console.error(`Missing eval directory: ${path.relative(root, evalDir)}`);
  process.exit(1);
}

const { retrieveBrainContext } = await import(pathToFileUrl(compiledRetriever));
const knowledgeFiles = listMarkdownFiles(knowledgeDir).map((file) => path.relative(knowledgeDir, file));
const knowledgeBasenames = new Set(knowledgeFiles.map((file) => path.basename(file)));
const evalFiles = listMarkdownFiles(evalDir).sort();

let failures = 0;
let todos = 0;

for (const file of evalFiles) {
  const content = readFileSync(file, "utf8");
  const title = heading(content) || path.basename(file);
  const userInput = section(content, "User Input").trim();
  const shouldRetrieve = bullets(section(content, "Should Retrieve"));
  const shouldNotRetrieve = bullets(section(content, "Should NOT Retrieve"));

  if (!userInput) {
    failures += 1;
    printCase(title, ["Missing User Input section."]);
    continue;
  }

  const result = retrieveBrainContext(userInput, 6);
  const retrieved = result.chunks.map((chunk) => chunk.file);
  const retrievedBasenames = new Set(retrieved.map((fileName) => path.basename(fileName)));
  const missingExpectedKnowledge = shouldRetrieve.filter((expected) => !knowledgeBasenames.has(path.basename(expected)));
  const existingExpected = shouldRetrieve.filter((expected) => knowledgeBasenames.has(path.basename(expected)));
  const missedExistingExpected = existingExpected.filter((expected) => !retrievedBasenames.has(path.basename(expected)));
  const matchedExpected = shouldRetrieve.filter((expected) => retrievedBasenames.has(path.basename(expected)));
  const forbiddenHits = shouldNotRetrieve.filter((forbidden) => retrievedBasenames.has(path.basename(forbidden)));
  const notes = [];

  if (!retrieved.length) notes.push("No context retrieved.");
  if (forbiddenHits.length) notes.push(`Forbidden retrieved: ${forbiddenHits.join(", ")}`);
  if (missedExistingExpected.length) notes.push(`Expected files not in top retrieval: ${missedExistingExpected.join(", ")}`);
  if (missingExpectedKnowledge.length) notes.push(`Expected files not in knowledge_base yet: ${missingExpectedKnowledge.join(", ")}`);

  const failed = forbiddenHits.length > 0 || !retrieved.length || (existingExpected.length > 0 && matchedExpected.length === 0);
  const todo = !failed && missingExpectedKnowledge.length > 0;
  const passed = !failed && !todo && retrieved.length > 0;

  if (failed) failures += 1;
  if (todo) todos += 1;

  printCase(title, [
    `${passed ? "PASS" : todo ? "TODO" : "FAIL"} ${path.relative(root, file)}`,
    `Input: ${userInput}`,
    `Retrieved: ${retrieved.map((item) => `${item}`).join(", ") || "none"}`,
    `Expected matched: ${matchedExpected.join(", ") || "none"}`,
    notes.length ? `Notes: ${notes.join(" | ")}` : ""
  ].filter(Boolean));
}

rmSync(path.join(root, ".tmp", "eval-retrieval"), { recursive: true, force: true });

if (failures || todos) {
  console.error(`\n${failures} retrieval eval(s) failed. ${todos} eval(s) need expected knowledge files added or renamed.`);
  process.exit(1);
}

console.log("\nAll retrieval evals passed.");

function listMarkdownFiles(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) return listMarkdownFiles(fullPath);
      if (stat.isFile() && entry.endsWith(".md")) return [fullPath];

      return [];
    });
}

function heading(markdown) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function section(markdown, name) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${name}`);
  if (start === -1) return "";

  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    body.push(line);
  }

  return body.join("\n");
}

function bullets(markdown) {
  return markdown
    .split("\n")
    .map((line) => line.match(/^-\s+(.+)$/)?.[1]?.trim())
    .filter(Boolean);
}

function printCase(title, lines) {
  console.log(`\n## ${title}`);
  for (const line of lines) console.log(line);
}

function pathToFileUrl(filePath) {
  return new URL(`file://${filePath}`).href;
}
