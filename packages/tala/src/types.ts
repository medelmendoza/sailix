/** The shapes the Tala screens use. The same as the Sailix API's Tala schemas, written out so the package stands alone. */
export interface TalaCourse {
  /** Assignment id (the only id the screens ever use) */
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  creator: string | null;
  date_from: string | null;
  date_to: string | null;
  status: string | null;
  /** Tala's own counter, 'done/total' (null for a course never started) */
  progress: string | null;
  completed: number;
  total: number;
  percent: number;
  state: 'not_started' | 'in_progress' | 'completed';
  total_materials: number;
}

export interface TalaMaterialSummary {
  id: string;
  type: 'video' | 'pdf' | 'quiz' | 'flashcards';
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  viewable: boolean;
  progress: string | null;
  status: string | null;
  stats: null | {
    rating?: number | null;
    correct?: number;
    wrong?: number;
    average?: number | null;
    remarks?: 'PASSED' | 'FAILED' | null;
    easy?: number;
    medium?: number;
    hard?: number;
    notseen?: number;
  };
}

export interface TalaCourseDetail extends TalaCourse {
  progress_submission: boolean;
  /** Tala marks the course as ordered: each material is done after the ones before it. */
  sequential?: boolean;
  materials: TalaMaterialSummary[];
  hidden_materials: number;
}

export interface TalaMaterial {
  id: string;
  type: 'video' | 'pdf';
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  file_url: string | null;
}

export interface TalaQuiz {
  id: string;
  name: string;
  description: string | null;
  version: string;
  sections: {
    id: string;
    title: string | null;
    description: string | null;
    questions: {
      ref: string;
      type: 'single' | 'multiple' | 'text';
      text: string;
      choices: string[];
      required: boolean;
      media_type: string | null;
      media_url: string | null;
    }[];
  }[];
}

export interface TalaQuizResult {
  progress: string;
  status: string;
  correct: number;
  wrong: number;
  total: number;
  average: number;
  passed: boolean;
}

export interface TalaDeck {
  id: string;
  name: string;
  description: string | null;
  version: string;
  cards: {
    index: number;
    question: string | null;
    question_media: { type: 'image' | 'video' | 'audio'; url: string } | null;
    answer: string | null;
    answer_media: { type: 'image' | 'video' | 'audio'; url: string } | null;
    rating: 'easy' | 'medium' | 'hard' | null;
  }[];
}

export interface TalaFlashcardResult {
  progress: string;
  status: string;
  easy: number;
  medium: number;
  hard: number;
}

/** The wrapper the Sailix API put around every answer; the package has no server of its own, so a plain data holder. */
export type Envelope<T> = { data: T };
