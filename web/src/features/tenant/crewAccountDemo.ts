/**
 * Dummy "CMS" crew records for the Create Crew Account screens. There is no CMS connection yet (a decision is pending), so
 * these stand in for what a search of it would return. Nothing here is read from or written to the server.
 */
export interface CmsCrew {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
  crewNumber: string;
  rank: string;
  fleet: string;
  employmentStatus: string;
  /** `YYYY-MM-DD`. */
  birthday: string;
  email: string;
}

export const CMS_CREW: CmsCrew[] = [
  {
    id: 'cms-1',
    lastName: 'Bustamante',
    firstName: 'Jaycob',
    middleName: 'Reyes',
    suffix: 'N/A',
    crewNumber: '09977',
    rank: 'AB',
    fleet: 'Fleet B',
    employmentStatus: 'On board',
    birthday: '1990-05-04',
    email: 'jaycob.bustamante@example.test',
  },
  {
    id: 'cms-2',
    lastName: 'Gatdula',
    firstName: 'Gian',
    middleName: 'Cruz',
    suffix: 'Jr.',
    crewNumber: '09988',
    rank: 'OS',
    fleet: 'Fleet A',
    employmentStatus: 'On vacation',
    birthday: '1995-11-21',
    email: 'gian.gatdula@example.test',
  },
  {
    id: 'cms-3',
    lastName: 'Santos',
    firstName: 'Maria',
    middleName: 'Dela Cruz',
    suffix: 'N/A',
    crewNumber: '10014',
    rank: 'Cook',
    fleet: 'Fleet A',
    employmentStatus: 'On board',
    birthday: '1988-02-17',
    email: 'maria.santos@example.test',
  },
  {
    id: 'cms-4',
    lastName: 'Reyes',
    firstName: 'Jun',
    middleName: 'Alvarez',
    suffix: 'III',
    crewNumber: '10027',
    rank: 'Bosun',
    fleet: 'Fleet C',
    employmentStatus: 'On board',
    birthday: '1984-09-30',
    email: 'jun.reyes@example.test',
  },
  {
    id: 'cms-5',
    lastName: 'Bustamante',
    firstName: 'Carlo',
    middleName: 'Mendoza',
    suffix: 'N/A',
    crewNumber: '10033',
    rank: 'Oiler',
    fleet: 'Fleet B',
    employmentStatus: 'Standby',
    birthday: '1992-07-08',
    email: 'carlo.bustamante@example.test',
  },
  {
    id: 'cms-6',
    lastName: 'Villanueva',
    firstName: 'Ana',
    middleName: 'Lopez',
    suffix: 'N/A',
    crewNumber: '10041',
    rank: '3rd Officer',
    fleet: 'Fleet C',
    employmentStatus: 'On vacation',
    birthday: '1993-12-02',
    email: 'ana.villanueva@example.test',
  },
];

/** What a search of the dummy CMS returns: every record whose last name, first name and crew ID contain what was typed. */
export function searchCms(query: { last: string; first: string; id: string }): CmsCrew[] {
  const has = (value: string, part: string) =>
    value.toLowerCase().includes(part.trim().toLowerCase());
  return CMS_CREW.filter(
    (c) =>
      has(c.lastName, query.last) && has(c.firstName, query.first) && has(c.crewNumber, query.id),
  );
}

/** A new crew member's first password: their birthday as `yyyymmdd`, as the printed instructions say. */
export const startingPassword = (birthday: string) => birthday.replaceAll('-', '');

/** A username from the name: `jaycob.bustamante`. */
export const suggestUsername = (c: Pick<CmsCrew, 'firstName' | 'lastName'>) =>
  `${c.firstName}.${c.lastName}`.toLowerCase().replace(/[^a-z.]/g, '');
