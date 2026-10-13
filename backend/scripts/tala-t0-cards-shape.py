#!/usr/bin/env python3
"""T0e - READ-ONLY: which material types exist across ALL teams of the test account, and the shape of a flashcard material.
GET requests only (plus login), https only, test account only. Prints counts, key names and categories only - no names,
ids, card text or answers."""
import collections, json, ssl, sys, time, urllib.request, urllib.error
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
    if n > 40: sys.exit("cap")
    time.sleep(0.7)
    h = {"Accept": "application/json"}
    if body is not None: h["Content-Type"] = "application/json"
    if token: h["Authorization"] = "Bearer " + token
    req = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers=h)
    try:
        r = OPENER.open(req, timeout=30); return r.status, json.loads(r.read() or "null")
    except urllib.error.HTTPError as e:
        return e.code, None
def shape(v, d=0):
    if isinstance(v, dict): return {k: shape(x, d + 1) for k, x in v.items()} if d < 4 else "{...}"
    if isinstance(v, list): return [f"len={len(v)}"] + ([shape(v[0], d + 1)] if v else [])
    return "null" if v is None else type(v).__name__

st, p = call("POST", "/api/v1/login", body={"username": env["TALA_T0_USERNAME"], "password": env["TALA_T0_PASSWORD"]})
tok, uid = p["accessToken"], p["userId"]
st, teams = call("GET", f"/api/v1/auth/users/{uid}/teams", tok)
print("teams:", len(teams), "| configured team is one of them:", any(t["teamId"] == env["teamId"] for t in teams))
card_ids = []
for i, t in enumerate(teams):
    st, courses = call("GET", f"/api/v1/auth/users/{uid}/teams/{t['teamId']}/courses", tok)
    if st != 200: print(f"team {i}: courses HTTP {st}"); continue
    types = collections.Counter(str(d.get("materialType")).lower() for c in courses for d in (c.get("course") or {}).get("materialDetails", []))
    print(f"team {i}{' (configured)' if t['teamId'] == env['teamId'] else ''}: {len(courses)} course(s); material types: {dict(types)}")
    for c in courses:
        for d in (c.get("course") or {}).get("materialDetails", []):
            if str(d.get("materialType")).lower() in ("card", "up_card"):
                card_ids.append((t["teamId"], d["materialId"], str(d.get("materialType")).lower()))
print("flashcard materials found:", len(card_ids))
for team, mid, mt in card_ids[:2]:
    st, card = call("GET", f"/api/v1/auth/users/teams/{team}/upgraded_cards/{mid}", tok)
    print(f"\nflashcard ({mt}) GET: HTTP {st}")
    if st == 200:
        print("top-level keys:", sorted(card.keys()))
        data = card.get("data", [])
        print("cards in set:", len(data))
        if data:
            print("card item shape:", json.dumps(shape(data[0])))
            print("question/answer media types seen:", sorted({str(x.get("questionMediaType")) for x in data}), "/", sorted({str(x.get("answerMediaType")) for x in data}))
print("\nrequests:", n)
