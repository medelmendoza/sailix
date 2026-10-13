/**
 * The words of the Astra tools, taken from the original Sailix app. Typos in the original are corrected ("its" for
 * "it's", "an communication", "you can to do"), and the Pomodoro help now says what the timer does: a 15-minute long break.
 */
export const HELP = {
  pomodoro: {
    title: 'What is Pomodoro?',
    body: 'The Pomodoro Technique is a time management method in which you do focused work during 25-minute intervals, known as pomodoros, and take a five-minute break.\n\nThis goes for 4 intervals, and after the fourth you take a longer 15-minute break.',
  },
  noise: {
    title: 'Focus or Rest?',
    body: 'Background noise can be a powerful tool for improving focus and concentration while studying. It lets you go deeper into your work and reach a state of flow.\n\nUse these background noises to either focus or rest.',
  },
  risk: {
    title: 'What is Risk Management?',
    body: "Risk management is the process of identifying, assessing and controlling threats to an organization's capital, earnings and operations.\n\nThis chart shows what to do depending on whether the PROBABILITY and the IMPACT of your risk are HIGH or LOW.",
  },
  rca: {
    title: 'What is Root Cause Analysis?',
    body: 'Root cause analysis (RCA) is the process of discovering the root causes of problems in order to identify appropriate solutions.',
  },
  pmepe: {
    title: 'What is P.M.E.P.E?',
    body: '“Purple Monkey Eating Pink Elephant”, or P.M.E.P.E, is a mnemonic that helps you remember the 5 main places to look for the root cause of a problem on a ship. Each letter reminds you to ask whether the problem is related to, for example, the Equipment on the ship.',
  },
  scaril: {
    title: 'What is S.C.A.R.I.L?',
    body: 'A framework for assessing a problem and communicating it. Situation, Complication, Analysis, Recommendation, Impact and Learnings help you put out fires by recognizing why something happened and what you can do to prevent it.',
  },
  emails: {
    title: 'What is a Military Style Email?',
    body: 'A communication framework that makes your emails more concise and effective. It also includes steps towards recognizing a problem and acting to prevent it.',
  },
} as const;

export type Quadrant = {
  id: 'reduce' | 'avoid' | 'accept' | 'transfer';
  probability: 'High' | 'Low';
  impact: 'High' | 'Low';
  title: string;
  text: string;
};

/** Probability goes up the page, impact goes across (spec BR-52). Order is the grid order: top-left, top-right, bottom-left, bottom-right. */
export const QUADRANTS: readonly Quadrant[] = [
  {
    id: 'reduce',
    probability: 'High',
    impact: 'Low',
    title: 'Reduce your risk!',
    text: 'When your risk is HIGH probability but LOW impact, you need to take action to minimize its impact.',
  },
  {
    id: 'avoid',
    probability: 'High',
    impact: 'High',
    title: 'Avoid your risk!',
    text: 'When your risk is HIGH probability with HIGH impact, it is better to avoid the risk entirely.',
  },
  {
    id: 'accept',
    probability: 'Low',
    impact: 'Low',
    title: 'Accept your risk!',
    text: "When your risk is LOW probability with LOW impact, sometimes the best option is to accept it, especially if it's the most optimal option.",
  },
  {
    id: 'transfer',
    probability: 'Low',
    impact: 'High',
    title: 'Transfer your risk!',
    text: 'When your risk is LOW probability but with HIGH impact, it is best to share the risk or transfer the risk entirely.',
  },
];

export const WHYS_BLURB =
  '5 Whys is the practice of asking why repeatedly whenever a problem is encountered, to get beyond the obvious symptoms and discover the root cause.';

/** Category, mnemonic word, what it covers (spec 3.5). */
export const PMEPE = [
  { category: 'People', word: 'Purple', covers: 'Related to people' },
  { category: 'Materials', word: 'Monkey', covers: 'Supplies, cargo and inventory' },
  { category: 'Equipment', word: 'Eating', covers: 'Machinery and tools' },
  { category: 'Process and Policies', word: 'Pink', covers: 'Lack of clarity and gaps' },
  { category: 'Environment', word: 'Elephant', covers: 'Weather and company culture' },
] as const;

export const SCARIL = [
  { word: 'Situation', covers: 'Background summary' },
  { word: 'Complication', covers: 'Incident / problem' },
  { word: 'Analysis', covers: 'Root causes / alternatives' },
  { word: 'Recommendation', covers: 'Corrective actions / solutions' },
  { word: 'Impact', covers: 'How badly affected?' },
  { word: 'Learnings', covers: 'Lessons learned / improvement' },
] as const;

export const EMAIL_STEPS = [
  { step: 'to-cc', label: 'Step 1: To and CC' },
  { step: 'raid', label: 'Step 2: R.A.I.D and Subject' },
  { step: 'bluf', label: 'Step 3: B.L.U.F and Body' },
  { step: 'next', label: 'Step 4: Next steps' },
] as const;

export const TO_CC = {
  heading: 'To and CC',
  sub: 'Know who you are sending your email to.',
  items: [
    {
      word: 'To',
      covers:
        'For the main recipients of your email: the people named in the greeting at the start of your message and those from whom you expect a direct reply or action.',
    },
    {
      word: 'CC',
      covers: 'Carbon copy. A copy sent to one or more people to keep them in the loop.',
    },
  ],
} as const;

export const RAID = {
  heading: 'RAID!',
  sub: "Set the right expectations for your email's subject.",
  items: [
    { word: 'Request', covers: 'Approvals, signatures, documents' },
    { word: 'Action', covers: 'Action needs to be done' },
    { word: 'Info', covers: 'Updates and announcements' },
    { word: 'Decision', covers: 'Choose from options and/or a recommendation' },
    { word: 'Urgent', covers: 'Added when the request needs an immediate response' },
  ],
  before: 'Subject: Documents for Crew Change',
  after: 'Subject: [Urgent Request] Documents for Crew Change - MV Vessel A',
} as const;

export const BLUF = {
  heading: 'BLUF',
  sub: 'Bottom Line Up Front: put all the important details first, in 3 to 5 sentences.',
  items: [
    { word: 'Who', covers: 'Who is involved?' },
    { word: 'What', covers: 'What happened? What needs to be done?' },
    { word: 'When', covers: 'When did it happen? How long will it take?' },
    { word: 'Where', covers: 'Where did it happen? Where to go or accomplish it?' },
    { word: 'Why', covers: 'Why did it happen?' },
    { word: 'How', covers: 'How did it happen?' },
  ],
} as const;

export const NEXT_STEPS = 'After sending the email, you might want to consider an RCA or a SCARIL.';

export const DOCS = {
  bluf: { title: 'BLUF example' },
  pmepe: { title: 'P.M.E.P.E detailed view' },
  scaril: { title: 'SCARIL detailed view' },
} as const;
