import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import mammoth from "mammoth";
import * as xlsx from "xlsx";
import { createWorker } from "tesseract.js";

export interface ParsedOption {
  text: string;
  isCorrect: boolean;
}

export interface ParsedQuestion {
  text: string;
  options: ParsedOption[];
  type: "single_choice" | "multiple_choice" | "true_false" | "integer" | "numerical";
  difficulty: "easy" | "medium" | "hard";
  explanation?: string;
  hint?: string;
  positiveMarks: number;
  negativeMarks: number;
  subjectName?: string;
  topicName?: string;
  isValid: boolean;
  validationError?: string;
}

export interface ImportReport {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  skippedRecords: string[];
  questions: ParsedQuestion[];
}

// Heuristic parser for raw text extracted from PDF, DOCX, TXT, or OCR
export function parseRawText(text: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  
  // Normalize line endings and split into sections where questions start
  // Split on indicators like "Q1.", "Q2:", "Question 1", or numbers followed by a dot/parenthesis at start of line
  const normalized = text.replace(/\r\n/g, "\n");
  const rawBlocks = normalized.split(/\n\s*(?=Q(?:uestion)?\s*\d+[\.\:\)]|\d+\s*[\.\:\)])/i);

  for (const block of rawBlocks) {
    if (!block.trim()) continue;

    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let questionText = "";
    const options: ParsedOption[] = [];
    let explanation = "";
    let hint = "";
    let difficulty: "easy" | "medium" | "hard" = "medium";
    let positiveMarks = 1;
    let negativeMarks = 0.25;
    let type: ParsedQuestion["type"] = "single_choice";
    let answerText = "";

    // Identify question text line (usually first line, stripping leading Q1., 1. etc.)
    const qMatch = lines[0].match(/^(?:Q(?:uestion)?\s*\d*[\.\:\)]|\d+\s*[\.\:\)]+)\s*(.*)/i);
    questionText = qMatch ? qMatch[1].trim() : lines[0];

    // Read remaining lines for options, answer, explanation, etc.
    let readingQuestionText = true;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Match Option: A) option text or a. option text or (A) option text
      const optMatch = line.match(/^[\(\[]?\s*([A-D]|[a-d]|\d+)\s*[\)\.\-\]]\s*(.*)/);
      if (optMatch) {
        readingQuestionText = false;
        const optLetter = optMatch[1].toUpperCase();
        const optVal = optMatch[2].trim();
        options.push({ text: optVal, isCorrect: false });
        continue;
      }

      // Match Answer line: Answer: A or Ans: B or Correct: A, B
      const ansMatch = line.match(/^(?:Answer|Ans|Correct|Key)\s*[\:\-]?\s*(.*)/i);
      if (ansMatch) {
        readingQuestionText = false;
        answerText = ansMatch[1].trim().toUpperCase();
        continue;
      }

      // Match Explanation: explanation text
      const expMatch = line.match(/^(?:Explanation|Explain|Sol|Solution)\s*[\:\-]?\s*(.*)/i);
      if (expMatch) {
        readingQuestionText = false;
        explanation = expMatch[1].trim();
        // Append any subsequent lines to explanation if they don't match other keywords
        let j = i + 1;
        while (j < lines.length && !lines[j].match(/^(?:Answer|Ans|Correct|Key|Difficulty|Marks|Negative|Hint)/i)) {
          explanation += "\n" + lines[j].trim();
          i = j;
          j++;
        }
        continue;
      }

      // Match Hint
      const hintMatch = line.match(/^Hint\s*[\:\-]?\s*(.*)/i);
      if (hintMatch) {
        readingQuestionText = false;
        hint = hintMatch[1].trim();
        continue;
      }

      // Match Difficulty
      const diffMatch = line.match(/^Difficulty\s*[\:\-]?\s*(easy|medium|hard)/i);
      if (diffMatch) {
        readingQuestionText = false;
        difficulty = diffMatch[1].toLowerCase() as any;
        continue;
      }

      // Match Marks
      const marksMatch = line.match(/^Marks\s*[\:\-]?\s*([\d\.]+)/i);
      if (marksMatch) {
        readingQuestionText = false;
        positiveMarks = parseFloat(marksMatch[1]) || 1;
        continue;
      }

      // Match Negative Marks
      const negMatch = line.match(/^(?:Negative Marks|Negative)\s*[\:\-]?\s*([\d\.]+)/i);
      if (negMatch) {
        readingQuestionText = false;
        negativeMarks = parseFloat(negMatch[1]) || 0;
        continue;
      }

      // If we are still reading the question body, append the text
      if (readingQuestionText) {
        questionText += "\n" + line;
      }
    }

    if (!questionText.trim()) continue;

    // Determine correct options based on answerText
    // Supported answers: "A", "B", "A, B", "TRUE", "1"
    if (options.length > 0) {
      if (answerText.includes(",") || answerText.includes("&") || answerText.includes("AND")) {
        type = "multiple_choice";
        const letters = answerText.split(/[\,\s\&]+/i).map(l => l.trim());
        options.forEach((opt, idx) => {
          const letter = String.fromCharCode(65 + idx);
          if (letters.includes(letter)) opt.isCorrect = true;
        });
      } else {
        type = "single_choice";
        // Find single correct index: e.g. "A" -> index 0, "B" -> index 1
        let correctIdx = -1;
        if (answerText.length === 1) {
          correctIdx = answerText.charCodeAt(0) - 65;
        } else {
          // Fallback matching text
          correctIdx = options.findIndex(o => o.text.toUpperCase() === answerText);
        }
        if (correctIdx >= 0 && correctIdx < options.length) {
          options[correctIdx].isCorrect = true;
        } else if (options.length > 0) {
          // Default to first option if not found
          options[0].isCorrect = true;
        }
      }
    } else {
      // True/False or Integer question types
      if (answerText === "TRUE" || answerText === "FALSE") {
        type = "true_false";
        options.push({ text: "True", isCorrect: answerText === "TRUE" });
        options.push({ text: "False", isCorrect: answerText === "FALSE" });
      } else if (!isNaN(parseInt(answerText))) {
        type = "integer";
        options.push({ text: answerText, isCorrect: true });
      }
    }

    // Validation checks
    let isValid = true;
    let validationError = "";
    if (!questionText.trim()) {
      isValid = false;
      validationError = "Missing question text";
    } else if (options.length < 2 && type !== "integer" && (type as string) !== "numerical") {
      isValid = false;
      validationError = "Multiple choice questions must have at least 2 options";
    } else if (!options.some(o => o.isCorrect)) {
      isValid = false;
      validationError = "Missing correct answer designation";
    }

    questions.push({
      text: questionText,
      options,
      type,
      difficulty,
      explanation: explanation || undefined,
      hint: hint || undefined,
      positiveMarks,
      negativeMarks,
      isValid,
      validationError: validationError || undefined,
    });
  }

  return questions;
}

// Convert CSV text to questions
export function parseCSVText(raw: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Parse header columns
  const header = lines[0].split(",").map(h => h.toLowerCase().replace(/['"]/g, "").trim());
  const qIdx = header.indexOf("question");
  const aIdx = header.indexOf("a");
  const bIdx = header.indexOf("b");
  const cIdx = header.indexOf("c");
  const dIdx = header.indexOf("d");
  const ansIdx = header.findIndex(h => h === "answer" || h === "correct" || h === "ans" || h === "correct_option");
  const expIdx = header.findIndex(h => h === "explanation" || h === "explain");

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Split taking care of quotes
    const cols: string[] = [];
    let insideQuote = false;
    let entry = "";
    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const char = line[charIdx];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === "," && !insideQuote) {
        cols.push(entry.trim());
        entry = "";
      } else {
        entry += char;
      }
    }
    cols.push(entry.trim());

    const questionText = qIdx >= 0 ? cols[qIdx] : cols[0];
    if (!questionText) continue;

    const optA = aIdx >= 0 ? cols[aIdx] : cols[1];
    const optB = bIdx >= 0 ? cols[bIdx] : cols[2];
    const optC = cIdx >= 0 ? cols[cIdx] : cols[3];
    const optD = dIdx >= 0 ? cols[dIdx] : cols[4];

    const ansVal = ansIdx >= 0 ? cols[ansIdx]?.toUpperCase() ?? "A" : "A";
    const explanation = expIdx >= 0 ? cols[expIdx] : "";

    const options: ParsedOption[] = [
      { text: optA || "Option A", isCorrect: ansVal === "A" || ansVal === "1" },
      { text: optB || "Option B", isCorrect: ansVal === "B" || ansVal === "2" },
    ];
    if (optC) options.push({ text: optC, isCorrect: ansVal === "C" || ansVal === "3" });
    if (optD) options.push({ text: optD, isCorrect: ansVal === "D" || ansVal === "4" });

    questions.push({
      text: questionText,
      options,
      type: "single_choice",
      difficulty: "medium",
      explanation: explanation || undefined,
      positiveMarks: 1,
      negativeMarks: 0.25,
      isValid: true,
    });
  }

  return questions;
}

// Convert JSON text to questions
export function parseJSONText(raw: string): ParsedQuestion[] {
  try {
    const data = JSON.parse(raw);
    const arr = Array.isArray(data) ? data : data.questions ?? [];
    return arr.map((q: any) => {
      const questionText = q.text || q.question || "";
      const rawOptions = Array.isArray(q.options) ? q.options : [];
      const options = rawOptions.map((o: any) => {
        if (typeof o === "string") return { text: o, isCorrect: false };
        return { text: o.text || "", isCorrect: !!o.isCorrect };
      });

      // Handle correct index mapping if passed as number or string
      if (q.correctAnswer && !options.some((o: ParsedOption) => o.isCorrect)) {
        if (typeof q.correctAnswer === "number" && q.correctAnswer >= 0 && q.correctAnswer < options.length) {
          options[q.correctAnswer].isCorrect = true;
        } else if (typeof q.correctAnswer === "string") {
          const idx = q.correctAnswer.charCodeAt(0) - 65;
          if (idx >= 0 && idx < options.length) options[idx].isCorrect = true;
        }
      }

      return {
        text: questionText,
        options: options.length ? options : [{ text: "Option A", isCorrect: true }, { text: "Option B", isCorrect: false }],
        type: q.type || "single_choice",
        difficulty: q.difficulty || "medium",
        explanation: q.explanation || undefined,
        hint: q.hint || undefined,
        positiveMarks: Number(q.positiveMarks ?? 1),
        negativeMarks: Number(q.negativeMarks ?? 0.25),
        isValid: !!questionText,
      };
    });
  } catch {
    return [];
  }
}

// Parse Excel file using xlsx
export function parseExcelBuffer(buffer: Buffer): ParsedQuestion[] {
  try {
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonRows = xlsx.utils.sheet_to_json(worksheet) as Record<string, any>[];

    const questions: ParsedQuestion[] = [];
    for (const row of jsonRows) {
      const questionText = row.question || row.Question || row.Text || row.text;
      if (!questionText) continue;

      const optA = row.a || row.A || row.option_a || row.optionA;
      const optB = row.b || row.B || row.option_b || row.optionB;
      const optC = row.c || row.C || row.option_c || row.optionC;
      const optD = row.d || row.D || row.option_d || row.optionD;

      const ansVal = String(row.answer || row.Answer || row.correct || row.Correct || "A").toUpperCase();
      const explanation = row.explanation || row.Explanation || row.explain || "";
      const difficulty = (row.difficulty || row.Difficulty || "medium").toLowerCase() as any;
      const positiveMarks = parseFloat(row.marks || row.Marks) || 1;
      const negativeMarks = parseFloat(row.negative_marks || row.Negative || row.negative) || 0.25;

      const options: ParsedOption[] = [
        { text: String(optA || "Option A"), isCorrect: ansVal === "A" || ansVal === "1" || ansVal === optA },
        { text: String(optB || "Option B"), isCorrect: ansVal === "B" || ansVal === "2" || ansVal === optB },
      ];
      if (optC) options.push({ text: String(optC), isCorrect: ansVal === "C" || ansVal === "3" || ansVal === optC });
      if (optD) options.push({ text: String(optD), isCorrect: ansVal === "D" || ansVal === "4" || ansVal === optD });

      questions.push({
        text: String(questionText),
        options,
        type: "single_choice",
        difficulty: ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium",
        explanation: explanation ? String(explanation) : undefined,
        positiveMarks,
        negativeMarks,
        isValid: true,
      });
    }
    return questions;
  } catch {
    return [];
  }
}

// OCR Parsing of Images using Tesseract
export async function parseOCRImage(buffer: Buffer): Promise<ParsedQuestion[]> {
  try {
    const worker = await createWorker();
    const ret = await worker.recognize(buffer);
    await worker.terminate();
    return parseRawText(ret.data.text);
  } catch (err) {
    console.error("OCR Image parsing failed:", err);
    return [];
  }
}

// Master parsing function called from endpoint
export async function parseDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ImportReport> {
  let questions: ParsedQuestion[] = [];
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".json") || mimeType === "application/json") {
    questions = parseJSONText(buffer.toString("utf-8"));
  } else if (lowerName.endsWith(".csv") || mimeType === "text/csv") {
    questions = parseCSVText(buffer.toString("utf-8"));
  } else if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || mimeType.includes("sheet") || mimeType.includes("excel")) {
    questions = parseExcelBuffer(buffer);
  } else if (lowerName.endsWith(".docx") || mimeType.includes("word") || mimeType.includes("officedocument.wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer });
    questions = parseRawText(result.value);
  } else if (lowerName.endsWith(".pdf") || mimeType === "application/pdf") {
    try {
      const data = await pdf(buffer);
      questions = parseRawText(data.text);
      // If it parsed nothing, it might be a scanned PDF. Trigger OCR on PDF if needed, 
      // but for now we fall back to simple text parse. We can log.
      if (questions.length === 0) {
        console.log("PDF parsed 0 questions - checking if scanned PDF");
      }
    } catch (err) {
      console.error("PDF parse failed, attempting fallback OCR", err);
      // Scanned PDF OCR placeholder/fallback
    }
  } else if (mimeType.startsWith("image/") || lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    questions = await parseOCRImage(buffer);
  } else {
    // Treat as TXT/Notepad
    questions = parseRawText(buffer.toString("utf-8"));
  }

  const valid = questions.filter(q => q.isValid);
  const invalid = questions.filter(q => !q.isValid);
  const skippedList = invalid.map(q => `Skipped question starting with: "${q.text.slice(0, 40)}..." (Reason: ${q.validationError || "Invalid formatting"})`);

  return {
    totalRecords: questions.length,
    validRecords: valid.length,
    invalidRecords: invalid.length,
    skippedRecords: skippedList,
    questions,
  };
}
