# Message to the Tala owner (DRAFT, not sent)

Subject: Questions before Sailix writes learner progress to Tala

Hi,

We are building Sailix, a crew app from BTSolve that offers Tala as one of its services. Sailix uses the same Tala server as the Tala app. We only ever call `tala-v3-server.btsolve.com` over HTTPS with the approved test account, and we create no accounts. Before we turn on writing learner progress for real people, we need your answers to the questions below.

## Please answer these first (they block turning on writes)

1. `POST …/courses/sync` replaces the whole per-user snapshot and checks nothing. Is that on purpose? Is there, or could there be, a version or timestamp rule so the Tala app and Sailix do not overwrite each other's progress?
2. Sailix will write video and PDF completion, quiz scores and flashcard ratings through that same endpoint. Are you fine with that?
3. Do Tala reports trust a score sent by the client? Sailix scores quizzes on its own server from the answer key. Is there an official scoring rule we should copy (partial credit, ties, text matching)?
4. For `POST …/teams/{team}/courses/apply` with `{courseCode}`: what are the HTTP status and body for a valid code, a wrong code, an expired code, and a course the user already has? Is the result immediate enrolment, or an application an administrator approves?
5. Can you give us one valid test course code, and tell us whether it is safe to use with the test account?

## Things you should know about (nothing waits on these)

6. A plain HTTP request is accepted without redirecting to HTTPS.
7. Access tokens are year-long JWTs and we know of no refresh or revoke endpoint. Is there one, and what invalidates a token?
8. A garbage bearer token returns HTTP 500 instead of 401.
9. Ids in the path are not authorization-checked: another user's or team's id returns 200/empty or 404, not 403.
10. The profile response includes the team join code (`teamCode`) for every team the user belongs to.
11. Quiz answer keys are sent to the client with the questions.

## Other questions

12. Is `progress` always `"done/total"` (and `null` before a course starts)? Are dates always `YYYY-MM-DD`, and statuses always INACTIVE / NOT YET COMPLETED / COMPLETED?
13. `GET …/sync/{assignId}/data` returns 404 for a course that was never synced. Is that intended, and is there another way to read a course's stored state?
14. Are EPUB and the legacy "quiz" item types still supported? Sailix leaves both out.
15. Can one Sailix organization map to exactly one Tala team, and can we look up a team's courses without using a user's own login?
16. Is "Promo code" a real feature? The old app's menu entry opens a feedback dialog.

Thanks,
BTSolve
