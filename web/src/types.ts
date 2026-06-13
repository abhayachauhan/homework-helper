export type Status = "correct" | "partial" | "incorrect" | "unanswered";
export type HintType = "nudge" | "concept" | "worked_example";
export type Subject = "maths" | "english" | "mixed";

export interface Hint { level: 1 | 2 | 3; type: HintType; text: string; }

export interface TutorItem {
  id: string;
  questionText: string;
  studentAnswer: string | null;
  status: Status;
  feedback: string;
  hints: Hint[];
  solution: string | null;
}

export interface TutorResult { subject: Subject; summary: string; items: TutorItem[]; }
export interface Profile { id: string; name: string; level: string; age: number; }
export interface SubmissionSummary {
  id: string; profileId: string; createdAt: string;
  subject: string; summary: string; itemCount: number;
}
export interface SubmitResponse { id: string; result: TutorResult; }
