/** Chapter quizzes: what a question looks like and how a score reads (lib/quizApi.ts fetches them). */
export interface QuizQuestion {
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
}

/** A question the quiz can show: 3 or 4 choices and an answer among them. */
export function isQuestion(q: unknown): q is QuizQuestion {
  if (!q || typeof q !== "object") return false;
  const { question, choices, answer, explanation } = q as QuizQuestion;
  return (
    typeof question === "string" &&
    typeof explanation === "string" &&
    Array.isArray(choices) &&
    choices.length >= 3 &&
    choices.length <= 4 &&
    choices.every((c) => typeof c === "string") &&
    Number.isInteger(answer) &&
    answer >= 0 &&
    answer < choices.length
  );
}

/** "3 of 4 right: well done!" */
export function scoreLine(score: number, outOf: number): string {
  const cheer = score === outOf ? "Brilliant, every one!" : score >= outOf / 2 ? "Well done!" : "Good try. Reading the chapter again might help.";
  return `${score} of ${outOf} right. ${cheer}`;
}
