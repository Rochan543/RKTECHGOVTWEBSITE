import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import mammoth from "mammoth";
import * as xlsx from "xlsx";
import { createWorker } from "tesseract.js";

import { logger } from "./logger";

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
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  let currentQuestion: {
    textLines: string[];
    options: ParsedOption[];
    answerText: string;
    explanation: string;
    hint: string;
    difficulty: "easy" | "medium" | "hard";
    positiveMarks: number;
    negativeMarks: number;
    isComplete: boolean;
  } | null = null;

  function commitCurrent() {
    if (!currentQuestion) return;
    const qText = currentQuestion.textLines.join("\n").trim();
    if (!qText) return;

    let options = [...currentQuestion.options];
    let type: ParsedQuestion["type"] = "single_choice";
    const answerText = currentQuestion.answerText.trim().toUpperCase();

    // Determine correct options based on answerText
    if (options.length > 0) {
      if (answerText.includes(",") || answerText.includes("&") || answerText.includes("AND")) {
        type = "multiple_choice";
        const letters = answerText.split(/[\,\s\&]+/i).map(l => l.trim().toUpperCase());
        options.forEach((opt, idx) => {
          const letter = String.fromCharCode(65 + idx);
          if (letters.includes(letter)) opt.isCorrect = true;
        });
      } else {
        type = "single_choice";
        let correctIdx = -1;
        if (answerText.length === 1 && answerText >= "A" && answerText <= "D") {
          correctIdx = answerText.charCodeAt(0) - 65;
        } else {
          correctIdx = options.findIndex(o => o.text.toUpperCase() === answerText);
        }
        if (correctIdx >= 0 && correctIdx < options.length) {
          options[correctIdx].isCorrect = true;
        } else if (options.length > 0) {
          options[0].isCorrect = true;
        }
      }
    } else {
      if (answerText === "TRUE" || answerText === "FALSE") {
        type = "true_false";
        options = [
          { text: "True", isCorrect: answerText === "TRUE" },
          { text: "False", isCorrect: answerText === "FALSE" }
        ];
      } else if (!isNaN(parseInt(answerText)) && answerText !== "") {
        type = "integer";
        options = [{ text: answerText, isCorrect: true }];
      }
    }

    // Validation checks
    let isValid = true;
    let validationError = "";
    if (!qText) {
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
      text: qText,
      options,
      type,
      difficulty: currentQuestion.difficulty,
      explanation: currentQuestion.explanation.trim() || undefined,
      hint: currentQuestion.hint.trim() || undefined,
      positiveMarks: currentQuestion.positiveMarks,
      negativeMarks: currentQuestion.negativeMarks,
      isValid,
      validationError: validationError || undefined,
    });

    currentQuestion = null;
  }

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (currentQuestion && !currentQuestion.isComplete && currentQuestion.options.length === 0) {
        currentQuestion.textLines.push("");
      }
      continue;
    }

    // Match question starters: Q. Q: Question Question: 1. 2. 3.
    const isQuestionStarter = /^(?:Q(?:uestion)?\s*[\.\:\)]|Q(?:uestion)?\s*\d+\s*[\.\:\)]+|\d+\s*[\.\:\)]|Question\b)/i.test(line);

    // Match options: A) a. (A)
    const optMatch = line.match(/^\s*(?:\(([A-Da-d])\)|\[([A-Da-d])\]|([A-Da-d])\s*[\.\)]+)\s*(.*)/);

    // Match answer: Answer: Ans: Correct: Correct Answer: Correct Option:
    const ansMatch = line.match(/^\s*(?:Correct\s*Answer|Correct\s*Option|Answer|Ans|Correct)\s*[\:\-]?\s*(.*)/i);

    // Match metadata
    const expMatch = line.match(/^\s*(?:Explanation|Explain|Sol|Solution)\s*[\:\-]?\s*(.*)/i);
    const hintMatch = line.match(/^\s*Hint\s*[\:\-]?\s*(.*)/i);
    const diffMatch = line.match(/^\s*Difficulty\s*[\:\-]?\s*(easy|medium|hard)/i);
    const marksMatch = line.match(/^\s*(?:Positive\s*)?Marks\s*[\:\-]?\s*([\d\.]+)/i);
    const negMatch = line.match(/^\s*(?:Negative\s*Marks|Negative)\s*[\:\-]?\s*([\d\.]+)/i);

    const isMetadata = !!(expMatch || hintMatch || diffMatch || marksMatch || negMatch);

    const shouldStartNew = !currentQuestion || 
                           isQuestionStarter || 
                           (currentQuestion.isComplete && optMatch);

    if (shouldStartNew) {
      commitCurrent();
      currentQuestion = {
        textLines: [],
        options: [],
        answerText: "",
        explanation: "",
        hint: "",
        difficulty: "medium",
        positiveMarks: 1,
        negativeMarks: 0.25,
        isComplete: false,
      };
    }

    if (!currentQuestion) continue;

    if (isQuestionStarter) {
      const prefixMatch = line.match(/^(?:Q(?:uestion)?\s*\d*\s*[\.\:\)]+|Question\b|\d+\s*[\.\:\)]+)\s*/i);
      const content = prefixMatch ? line.slice(prefixMatch[0].length).trim() : line;
      if (content) {
        currentQuestion.textLines.push(content);
      }
    } else if (optMatch) {
      const optVal = optMatch[4].trim();
      currentQuestion.options.push({ text: optVal, isCorrect: false });
    } else if (ansMatch) {
      currentQuestion.answerText = ansMatch[1].trim();
      currentQuestion.isComplete = true;
    } else if (expMatch) {
      currentQuestion.explanation = expMatch[1].trim();
    } else if (hintMatch) {
      currentQuestion.hint = hintMatch[1].trim();
    } else if (diffMatch) {
      currentQuestion.difficulty = diffMatch[1].toLowerCase() as any;
    } else if (marksMatch) {
      currentQuestion.positiveMarks = parseFloat(marksMatch[1]) || 1;
    } else if (negMatch) {
      currentQuestion.negativeMarks = parseFloat(negMatch[1]) || 0;
    } else {
      if (currentQuestion.explanation) {
        currentQuestion.explanation += "\n" + line;
      } else if (currentQuestion.isComplete) {
        currentQuestion.explanation = line;
      } else {
        currentQuestion.textLines.push(line);
      }
    }
  }

  commitCurrent();
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
    logger.error({ err }, "OCR Image parsing failed");
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
      const extractedText = data.text?.trim() ?? "";
      if (extractedText.length >= 50) {
        // Text-based PDF — parse directly
        questions = parseRawText(extractedText);
      } else {
        // Very little text extracted — likely a scanned (image-only) PDF.
        // Server-side PDF-to-image rendering requires system libraries (Ghostscript/Poppler)
        // that are not available in this environment. Return a clear guidance record so the
        // admin knows to re-export the file as an image.
        questions = [
          {
            text: "⚠️ This PDF appears to be a scanned (image-only) document with no extractable text. " +
              "To import questions via OCR, please export each page as a PNG or JPEG image and re-upload it.",
            options: [{ text: "N/A", isCorrect: true }],
            type: "single_choice",
            difficulty: "medium",
            positiveMarks: 1,
            negativeMarks: 0,
            isValid: false,
            validationError: "Scanned PDF — re-export pages as PNG/JPEG for OCR import",
          },
        ];
      }
    } catch (err) {
      logger.error({ err }, "PDF parse failed");
      questions = [
        {
          text: "⚠️ Failed to parse this PDF. The file may be corrupted or password-protected.",
          options: [{ text: "N/A", isCorrect: true }],
          type: "single_choice",
          difficulty: "medium",
          positiveMarks: 1,
          negativeMarks: 0,
          isValid: false,
          validationError: "PDF parse error — check the file and try again",
        },
      ];
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
