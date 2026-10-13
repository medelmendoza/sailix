/**
 * Sample data for DEMO MODE (a build-time switch, never on in production): invented people, courses and cards,
 * dates relative to today so due dates always look current. Nothing here is real or leaves the device.
 */
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const demoMe = {
  user: { id: 'u1', username: 'maria', email: 'maria@example.test', display_name: 'Maria Santos' },
  membership: { id: 'm1', role: 'crew', status: 'active' },
  tenant: { id: 't1', code: 'SFAI', name: 'Southfield Agencies' },
  profile: {
    first_name: 'Maria',
    middle_name: null,
    last_name: 'Santos',
    suffix: null,
    mobile: null,
  },
  abilities: ['module.tala.use'],
  modules: [{ code: 'tala', label: 'Tala', enabled: true, linked: true, status: 'linked' }],
  memberships: [
    {
      id: 'm1',
      role: 'crew',
      tenant: { id: 't1', code: 'SFAI', name: 'Southfield Agencies' },
      current: true,
    },
    {
      id: 'm2',
      role: 'crew',
      tenant: { id: 't2', code: 'ACME', name: 'Acme Crewing' },
      current: false,
    },
  ],
};

const course = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  description: 'Learn the essentials step by step.',
  thumbnail_url: null,
  creator: 'Capt. Reyes',
  date_from: day(-30),
  date_to: day(30),
  status: 'NOT YET COMPLETED',
  progress: '1/4',
  completed: 1,
  total: 4,
  percent: 25,
  state: 'in_progress',
  total_materials: 4,
  ...over,
});

export const demoCourses = [
  course('A1', 'Fire Safety at Sea', {
    date_to: day(-2),
    completed: 2,
    percent: 50,
    progress: '2/4',
  }),
  course('A2', 'First Aid Basics', { date_to: day(3), completed: 3, percent: 75, progress: '3/4' }),
  course('A3', 'Navigation Rules', {
    date_to: day(45),
    completed: 0,
    percent: 0,
    progress: null,
    state: 'not_started',
    status: 'INACTIVE',
  }),
  course('A4', 'Seamanship Knots', {
    date_to: day(-60),
    completed: 4,
    percent: 100,
    progress: '4/4',
    state: 'completed',
    status: 'COMPLETED',
  }),
];

const mat = (id: string, type: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  type,
  name,
  description: null,
  thumbnail_url: null,
  viewable: true,
  progress: null,
  status: null,
  stats: null,
  ...over,
});

export const demoDetail = (id: string) => ({
  ...(demoCourses.find((c) => c.id === id) ?? demoCourses[0]!),
  hidden_materials: 0,
  progress_submission: true,
  materials: [
    mat('v1', 'video', 'Introduction to fire classes', {
      status: 'COMPLETED',
      stats: { rating: 4.5 },
    }),
    mat('p1', 'pdf', 'Extinguisher handbook'),
    mat('q1', 'quiz', 'Fire safety quiz', {
      status: 'COMPLETED',
      stats: { correct: 8, wrong: 2, average: 80, remarks: 'PASSED' },
    }),
    mat('c1', 'flashcards', 'Safety symbols', {
      stats: { easy: 5, medium: 7, hard: 8, notseen: 0 },
    }),
  ],
});

export const demoQuiz = {
  id: 'q1',
  name: 'Fire safety quiz',
  description: 'Choose the best answer for each question.',
  version: 'demo',
  sections: [
    {
      id: 's1',
      title: 'Part 1',
      description: null,
      questions: [
        {
          ref: '0.0',
          type: 'single',
          text: 'Which extinguisher is right for an electrical fire?',
          choices: ['Water', 'CO2', 'Foam', 'Wet chemical'],
          required: true,
          media_type: null,
          media_url: null,
        },
        {
          ref: '0.1',
          type: 'multiple',
          text: 'Pick all actions to take when the alarm sounds',
          choices: [
            'Raise the alarm',
            'Go to the muster station',
            'Open every door',
            'Use the lift',
          ],
          required: true,
          media_type: null,
          media_url: null,
        },
        {
          ref: '0.2',
          type: 'text',
          text: 'Name the device that detects smoke early',
          choices: [],
          required: true,
          media_type: null,
          media_url: null,
        },
      ],
    },
  ],
};

export const demoDeck = {
  id: 'c1',
  name: 'Safety symbols',
  description: null,
  version: 'demo',
  cards: [
    {
      index: 0,
      question: 'What does a green running figure sign mean?',
      question_media: null,
      answer: 'An emergency exit route',
      answer_media: null,
      rating: null,
    },
    {
      index: 1,
      question: 'What does a red circle with a diagonal bar mean?',
      question_media: null,
      answer: 'Prohibited: do not do this',
      answer_media: null,
      rating: null,
    },
    {
      index: 2,
      question: 'What does a blue circle sign mean?',
      question_media: null,
      answer: 'A mandatory action',
      answer_media: null,
      rating: null,
    },
  ],
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
export const demoAnnouncements = [
  {
    id: 'n1',
    title: 'Safety drill on Friday',
    body: 'All crew must join the muster at 10:00 on deck 2. Bring your lifejacket and your training card. Attendance will be recorded.',
    is_active: true,
    expires_at: null,
    created_at: hoursAgo(3),
    updated_at: hoursAgo(3),
    is_read: false,
  },
  {
    id: 'n2',
    title: 'New training portal is open',
    body: 'Your assigned courses now appear in the Tala service on the Home tab. Contact the office if a course is missing.',
    is_active: true,
    expires_at: null,
    created_at: hoursAgo(30),
    updated_at: hoursAgo(30),
    is_read: false,
  },
  {
    id: 'n3',
    title: 'Office closed on Monday',
    body: 'The office is closed for the holiday and reopens on Tuesday.',
    is_active: true,
    expires_at: null,
    created_at: hoursAgo(24 * 5),
    updated_at: hoursAgo(24 * 5),
    is_read: true,
  },
];

const dayFromNow = (d: number) => {
  const t = new Date(Date.now() + d * 86_400_000);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
export const demoTodos = [
  {
    id: 'd1',
    description: "Renew your seaman's book",
    due_date: dayFromNow(-2),
    is_done: false,
    done_at: null,
    created_at: hoursAgo(72),
  },
  {
    id: 'd2',
    description: 'Submit your medical certificate',
    due_date: dayFromNow(1),
    is_done: false,
    done_at: null,
    created_at: hoursAgo(48),
  },
  {
    id: 'd3',
    description: 'Complete the safety induction course',
    due_date: dayFromNow(9),
    is_done: false,
    done_at: null,
    created_at: hoursAgo(24),
  },
  {
    id: 'd4',
    description: 'Confirm your emergency contact',
    due_date: null,
    is_done: true,
    done_at: hoursAgo(5),
    created_at: hoursAgo(96),
  },
];
