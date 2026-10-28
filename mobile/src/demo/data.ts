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
  modules: [
    { code: 'tala', label: 'Lodestar', enabled: true, linked: true, status: 'linked' },
    { code: 'astra', label: 'Astra', enabled: true, linked: true, status: 'available' },
    { code: 'callit', label: 'Call-it', enabled: true, linked: true, status: 'available' },
  ],
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

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n: number) => ymd(new Date(Date.now() + n * 86_400_000));
const docType = (id: string, name: string) => ({ id, name, short_name: null });
const doc = (
  id: string,
  type: string,
  status: string,
  expiry: string,
  over: Record<string, unknown> = {},
) => ({
  id,
  status,
  type: docType(`t-${id}`, type),
  number: `${id.toUpperCase()}-1234`,
  grade: null,
  location: 'Manila',
  school: null,
  issued_on: inDays(-700),
  expires_on:
    expiry === 'none'
      ? null
      : inDays(expiry === 'expired' ? -12 : expiry === 'expiring' ? 40 : 900),
  expiry_status: expiry,
  rejection_reason: null,
  file: { name: `${id}.pdf`, type: 'application/pdf', size: 52000 },
  submitted_at: hoursAgo(300),
  reviewed_at: status === 'pending' ? null : hoursAgo(200),
  ...over,
});
export const demoDocuments = {
  approved: [
    doc('d1', 'Medical Certificate', 'approved', 'expired'),
    doc('d2', "Seaman's Book", 'approved', 'expiring'),
    doc('d3', 'Passport', 'approved', 'valid'),
  ],
  review: [
    doc('d4', 'Yellow Fever Vaccination', 'pending', 'none'),
    doc('d5', 'Certificate of Competency', 'rejected', 'valid', {
      rejection_reason: 'The scan is cut off at the bottom. Please upload the whole page.',
    }),
  ],
};
export const demoDocumentTypes = [
  'Passport',
  "Seaman's Book",
  'Medical Certificate',
  'Basic Safety Training',
].map((n, i) => ({
  id: `ty${i}`,
  name: n,
  short_name: null,
}));

const slip = (
  id: string,
  kind: string,
  label: string,
  ago: number,
  net: string,
  dollar = false,
) => ({
  id,
  kind,
  pay_date: inDays(-ago * 30),
  period_label: label,
  vessel_name: 'MV Pacific Dawn',
  net_amount: net,
  is_dollar: dollar,
});
export const demoPayslips = {
  allotment: [
    slip('p1', 'regular', 'September 2026', 0, '19000.00'),
    slip('p2', 'special', 'Christmas Bonus', 1, '8495.00'),
    slip('p3', 'regular', 'August 2026', 1, '18820.50'),
  ],
  final: [slip('p9', 'final', 'Final Pay', 8, '62455.00')],
};
export const demoPayslipDetail = (id: string) => ({
  id,
  kind: 'regular',
  pay_date: inDays(0),
  period_label: 'September 2026',
  vessel_name: 'MV Pacific Dawn',
  full_vessel_name: 'MV Pacific Dawn (Bulk Carrier)',
  position: 'Able Seaman',
  address: '12 Harbor St., Manila',
  depart_date: inDays(-120),
  payroll_date: inDays(-2),
  payee_name: 'Demo Crew Spouse',
  bank_code: 'BDO',
  account_number: '••••5678',
  is_dollar: false,
  exchange_rate: '56.1250',
  pay_usd: '420.00',
  pay_peso: '23572.50',
  adjustment: '35.00',
  adjustment_detail: 'Overtime adjustment',
  signon_adjustment: null,
  union_dues: '15.00',
  bank_charges: '5.00',
  withholding_tax: null,
  mpfee: null,
  sss_total: '2000.00',
  employee_sss: '1350.00',
  employee_philhealth: '450.00',
  employee_pagibig: '200.00',
  deductions: [
    { description: 'Cash advance (Medical)', amount: '1000.00' },
    { description: 'Cash advance (Tickets)', amount: '750.00' },
  ],
  deductions_total: '1750.00',
  net_amount: id === 'p9' ? '62455.00' : '19000.00',
});
export const demoLoans = {
  data: [
    {
      id: 'l1',
      code: 'MED',
      description: 'Medical cash advance',
      loan_date: inDays(-210),
      start_of_deduction: inDays(-180),
      loan_amount: '10000.00',
      deduct_amount: '1000.00',
      paid_amount: '4000.00',
      balance: '6000.00',
      is_dollar: false,
      is_stopped: false,
      remarks: null,
    },
    {
      id: 'l2',
      code: 'TKT',
      description: 'Airfare advance',
      loan_date: inDays(-210),
      start_of_deduction: inDays(-180),
      loan_amount: '18000.00',
      deduct_amount: '750.00',
      paid_amount: '15000.00',
      balance: '3000.00',
      is_dollar: false,
      is_stopped: false,
      remarks: null,
    },
    {
      id: 'l3',
      code: 'USD1',
      description: 'Emergency advance (USD)',
      loan_date: inDays(-90),
      start_of_deduction: inDays(-60),
      loan_amount: '500.00',
      deduct_amount: '50.00',
      paid_amount: '100.00',
      balance: '400.00',
      is_dollar: true,
      is_stopped: false,
      remarks: null,
    },
  ],
  totals: { php: '1750.00', usd: '50.00' },
};

export const demoCallIt = {
  stats: {
    reports_made: 12,
    badges: [
      { reports: 1, label: 'First report' },
      { reports: 10, label: '10 reports made' },
    ],
    next_badge: 50,
  },
  reports: [
    {
      id: 'c1',
      status: 'draft',
      classification: 'unsafe_conditions',
      sub_classification: 'equipment',
      location: 'main_deck',
      location_other: null,
      vessel: 'MV Pacific Dawn',
      details: 'Oil leak under the starboard winch.',
      intervened: false,
      intervention_details: null,
      official_report: false,
      file: null,
      submitted_at: null,
      reviewed_at: null,
      created_at: hoursAgo(2),
    },
    {
      id: 'c2',
      status: 'submitted',
      classification: 'unsafe_acts',
      sub_classification: 'people',
      location: 'machinery_space',
      location_other: null,
      vessel: 'MV Pacific Dawn',
      details: 'Crew member near the rotating shaft without a guard.',
      intervened: true,
      intervention_details: 'Stopped the work and called the duty engineer.',
      official_report: true,
      file: null,
      submitted_at: hoursAgo(70),
      reviewed_at: null,
      created_at: hoursAgo(72),
    },
    {
      id: 'c3',
      status: 'reviewed',
      classification: 'unsafe_behaviour',
      sub_classification: 'processes',
      location: 'others',
      location_other: 'Gangway',
      vessel: 'MV Pacific Dawn',
      details: 'Gangway net not rigged during cargo operations.',
      intervened: false,
      intervention_details: null,
      official_report: false,
      file: null,
      submitted_at: hoursAgo(200),
      reviewed_at: hoursAgo(150),
      created_at: hoursAgo(210),
    },
  ],
};
