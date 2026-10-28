/** The screens inside the Tala package, with the names the Sailix navigator used so the screens did not change. */
export type TalaRoutes = {
  TalaTabs: undefined;
  TalaAccount: undefined;
  TalaStats: undefined;
  TalaJoinCourse: undefined;
  /** The courses behind one number on the dashboard. */
  TalaDrill: { title: string; ids: string[] };
  TalaCourseStats: { assignId: string; name: string };
  TalaCourse: { assignId: string; name: string };
  TalaFlashcards: { assignId: string; cardId: string; name: string };
  TalaQuiz: { assignId: string; quizId: string; name: string };
  TalaPdf: { name: string; uri: string };
  TalaVideo: {
    name: string;
    uri: string;
    assignId: string;
    materialId: string;
    canComplete: boolean;
    /** Already completed (or waiting to be sent): nothing left to do on the video page. */
    completed: boolean;
  };
};
