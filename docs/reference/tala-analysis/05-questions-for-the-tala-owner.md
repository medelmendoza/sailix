# Questions for the Tala owner

Collected from the T0 checks and the write probes (docs/13 §17, §20–§24). Nothing here has been sent to anyone; it is a list to take to the owner of the Tala server. Answers change what Sailix can safely turn on.

## A. Needed before turning on writes for real users (blocks `SAILIX_TALA_PROGRESS_WRITES`)

1. **Merge or replace?** `POST …/courses/sync` replaces the whole per-user snapshot and validates nothing (observed 2026-10-13). Is that intended? Is there, or could there be, a version or timestamp rule so two clients (the Tala app and Sailix) do not overwrite each other's progress?
2. **Is the owner aware** that Sailix will write learner records (video/PDF completion, quiz scores, flashcard ratings) through the same endpoint the Tala app uses?
3. **Quiz scoring:** is a client-sent score trusted by Tala reports? Sailix scores quizzes on the server from the answer key; is there an official scoring rule we should match (partial credit, multiple-choice ties, text matching)?
4. **Course join** (`POST …/teams/{team}/courses/apply` `{courseCode}`): for a valid code, a wrong code, an expired code and a course the user already has, what are the HTTP status and body? Is the result immediate enrolment or an application an administrator approves? (Sailix currently assumes: 401 → relink, other 4xx → "code not accepted", 5xx → unavailable.) Please supply one valid test course code and say if it is safe to use against the test account.

## B. Security findings to report (nothing blocks on these, but the owner should know)

5. A **plain HTTP** request is accepted with no redirect to HTTPS.
6. Access tokens are **year-long JWTs (HS384)** and there is **no refresh or revoke endpoint** we know of. Is there one? What invalidates a token?
7. A garbage bearer token returns **HTTP 500** instead of 401.
8. **Ids in the path are not authorization-checked**: a path with another user's or team's id answers 200/empty or 404 rather than 403. Is that intended?
9. The profile response includes the **team join code (`teamCode`)** and role names for every team the user belongs to.
10. **Quiz answer keys** are sent to the client with the questions.

## C. Product and data questions

11. `progress` is `"done/total"` and `null` before a course is started; is that stable? Are dates always `YYYY-MM-DD` and statuses always INACTIVE / NOT YET COMPLETED / COMPLETED?
12. `GET …/sync/{assignId}/data` returns 404 for a never-synced course. Is 404 the intended answer, and is there a way to read a course's stored state without it?
13. Which of EPUB and the legacy "quiz" item types are still supported? (Sailix excludes both, decision D-T6.)
14. Can one Sailix organization be mapped to exactly one Tala team on Tala's side (decision D-T7), and is there a supported way to look up a team's courses without the user's own login?
15. Is "Promo code" a real feature? The old app's menu entry opens a feedback dialog and the real dialog is commented out.
