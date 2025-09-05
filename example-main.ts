import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import "dotenv/config";
import OpenAI from "openai";

/**
 * - Model sees placeholders like EMAIL_0001 / PHONE_NUMBER_0001 / SSN_0001
 * - Live user stream shows the original values 
 * - LLM Output prints exactly what the model produced 
 * - Final Output shows the ORIGINAL values fully unredacted
 */

type Mapping = Record<string, string>;
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

// PII regex (supports +CC and parentheses for phones)
const PII_PATTERNS: Record<string, RegExp> = {
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  PHONE_NUMBER: /(?<!\w)(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4}(?!\w)/g,
};

function pad4(n: number) { return n.toString().padStart(4, "0"); }

function redactText(text: string): { redactedText: string; mapping: Mapping } {
  let modified = text;
  const mapping: Mapping = {};
  const counters: Record<keyof typeof PII_PATTERNS, number> = { SSN: 1, EMAIL: 1, PHONE_NUMBER: 1 };

  for (const label of Object.keys(PII_PATTERNS) as (keyof typeof PII_PATTERNS)[]) {
    const re = new RegExp(PII_PATTERNS[label], "g");
    const matches = Array.from(modified.matchAll(re)).map((m) => m[0]);

    for (const match of matches) {
      if (Object.values(mapping).includes(match)) continue;
      const placeholder = `${label}_${pad4(counters[label])}`;
      mapping[placeholder] = match;
      modified = modified.split(match).join(placeholder);
      counters[label] += 1;
    }
  }

  return { redactedText: modified, mapping };
}

// Placeholder utils
const PLACEHOLDER_RE = /\b(?:SSN_\d{4}|EMAIL_\d{4}|PHONE_NUMBER_\d{4})\b/g;
const MAX_PH_LEN = 17; // longest placeholder token length (PHONE_NUMBER_0000)

function unredactOnce(text: string, mapping: Mapping): string {
  return text.replace(PLACEHOLDER_RE, (m) => mapping[m] ?? m);
}

// Stream-safe UNREDACTOR: converts complete placeholders in-flight to originals
function makeStreamUnredactor(mapping: Mapping) {
  let buf = "";
  const TAIL = MAX_PH_LEN - 1; // keep small tail to avoid cutting a placeholder token
  return (incoming: string) => {
    buf += incoming;
    buf = buf.replace(PLACEHOLDER_RE, (m) => mapping[m] ?? m);
    if (buf.length > TAIL) {
      const emitLen = buf.length - TAIL;
      const safe = buf.slice(0, emitLen);
      buf = buf.slice(emitLen);
      return safe;
    }
    return "";
  };
}

// Stream from model 
// onUserChunk receives raw deltas which we unredact for user display
async function callLLMStream(
  prompt: string,
  onUserChunk: (rawDelta: string) => void
): Promise<string> {
  console.log("\n LLM is responding...\n");
  let raw = "";

  if (!process.env.OPENAI_API_KEY) {
    // Simple mock string that contains placeholders only (no brackets)
    const mock =
      "OPENAI_API_KEY not set. Please update field. Placeholders will be handled, but final output and stream will not reflect accurate responses.";
    for (let i = 0; i < mock.length; i += 12) {
      const chunk = mock.slice(i, i + 12);
      onUserChunk(chunk);
      raw += chunk;
      await new Promise((r) => setTimeout(r, 8));
    }
    onUserChunk("");
    return raw;
  }

  try {
    const stream = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      stream: true,
      temperature: 0.2,
    });

    for await (const part of stream) {
      const delta = part.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        onUserChunk(delta);
        raw += delta;
        await new Promise((r) => setTimeout(r, 10));
      }
    }
    onUserChunk(""); // flush
  } catch (e: any) {
    console.log("\n Error:", e?.message || String(e));
  }

  return raw;
}

async function processRequest(system_prompt: string, prompt: string) {
  const combined = `${system_prompt} ${prompt}`;
  const { redactedText, mapping } = redactText(combined);

  // Send placeholders only to the model
  const safePrompt = redactedText;

  // Prepare unredactor for user-visible stream (prints ORIGINAL values)
  const toUser = makeStreamUnredactor(mapping);
  const onUserChunk = (chunk: string) => {
    const safe = toUser(chunk);
    if (safe) process.stdout.write(safe);
  };
  console.log("\n--- User-visible stream (live) ---\n");
  // 1) Stream from model
  const rawModelOutput = await callLLMStream(safePrompt, onUserChunk);
  // 2) LLM Output ( which is exactly what model produced with placeholders)
  const llmOutput = rawModelOutput;
  // 3) Final Output: changes from placeholders to originals fully unredacted
  const finalOutput = unredactOnce(llmOutput, mapping);
  console.log("\nRedacted Prompt:\n", redactedText);
  console.log("\nLLM Output:\n", llmOutput);
  console.log("\nFinal Output:\n", finalOutput);
}

async function main() {
  try {
    const baseDir = path.dirname(path.resolve(process.argv[1] || "."));
    const filePath = path.join(baseDir, "requests.csv");

    const csvRaw = fs.readFileSync(filePath, "utf8");
    const rows = parse(csvRaw, { columns: true, skip_empty_lines: true, trim: true }) as Array<{
      system_prompt: string;
      prompt: string;
    }>;

    for (let i = 0; i < rows.length; i++) {
      console.log(`\n\n=== Request #${i + 1} ===`);
      await processRequest(rows[i].system_prompt, rows[i].prompt);
    }
  } catch (e: any) {
    console.log("Error reading CSV:", e?.message || String(e));
  }
}

main().catch((e) => {
  console.error("Error:", e);
  process.exitCode = 1;
});
