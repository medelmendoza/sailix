#!/usr/bin/env python3
"""T0c - READ-ONLY look at how Tala encodes quiz questions and answers, to implement server-side scoring correctly.
GET requests only (plus the login that obtains a token), https only, test account only. Prints categories and counts
ONLY: no question text, no answers, no choices, no ids."""
import json, ssl, sys, time, urllib.request, urllib.error, re, collections
from pathlib import Path
ENV = Path(__file__).resolve().parent.parent / ".env.tala-t0"

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
OPENER = urllib.request.build_opener(NoRedirect, urllib.request.HTTPSHandler(context=ssl.create_default_context()))
env = {}
for l in ENV.read_text().splitlines():
    if "=" in l and not l.strip().startswith("#"):
        k, _, v = l.partition("="); env[k.strip()] = v.strip().strip("\"'")
base = "https://" + env["TALA_T0_BASE_URL"].replace("https://", "").replace("http://", "").strip("/")
n = 0
def call(method, path, token=None, body=None):
    global n
    n += 1
    if n > 15: sys.exit("cap")
    time.sleep(1)
    h = {"Accept": "application/json"}
    if body is not None: h["Content-Type"] = "application/json"
    if token: h["Authorization"] = "Bearer " + token
    req = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers=h)
    try:
        r = OPENER.open(req, timeout=30); return r.status, json.loads(r.read() or "null")
    except urllib.error.HTTPError as e:
        return e.code, None

st, p = call("POST", "/api/v1/login", body={"username": env["TALA_T0_USERNAME"], "password": env["TALA_T0_PASSWORD"]})
tok, uid, team = p["accessToken"], p["userId"], env["teamId"]
st, courses = call("GET", f"/api/v1/auth/users/{uid}/teams/{team}/courses", tok)
quiz_ids = [d["materialId"] for c in courses for d in (c.get("course") or {}).get("materialDetails", []) if str(d.get("materialType")).lower() == "up_quiz"]
print("up_quiz materials assigned:", len(quiz_ids))
for qid in quiz_ids[:2]:
    st, q = call("GET", f"/api/v1/auth/users/teams/{team}/up_quizzes/{qid}", tok)
    if st != 200: print("quiz fetch HTTP", st); continue
    print("\nquiz-level keys:", sorted(k for k in q if k not in ("arraySection",)))
    print("quizPercentage looks like:", "digits" if re.fullmatch(r"\d+(\.\d+)?", str(q.get("quizPercentage"))) else "other", "| sections:", len(q["arraySection"]))
    types = collections.Counter(); pat = collections.defaultdict(collections.Counter); keys = set()
    for sec in q["arraySection"]:
        keys |= set(sec.keys())
        for it in sec["data"]:
            t = str(it.get("questionType")); types[t] += 1
            a, ch = str(it.get("answer", "")), str(it.get("choices", ""))
            nch = len(ch.split(":")) if ch else 0
            if re.fullmatch(r"\d+", a): cls = f"single index (0-based would be 0..{nch-1}); value range check: {'in 0..n-1' if int(a) < nch else 'needs 1-based (== n)' if int(a) == nch else 'out of range'}"
            elif re.fullmatch(r"\d+(:\d+)+", a): cls = "colon-joined indices"
            elif a == "": cls = "empty"
            else: cls = "text"
            pat[t][cls] += 1
            pat[t][f"choices count={nch}"] += 1
            pat[t]["required="+str(it.get("required"))] += 1
    print("section keys:", sorted(keys)); print("question types:", dict(types))
    for t, c in pat.items(): print(f"  {t}:", dict(c))
print("\nrequests:", n)
