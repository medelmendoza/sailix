#!/usr/bin/env python3
"""T0g - READ-ONLY: formats of the course-list fields behind "My Stats" and due dates (progress, status, dates).
GET only (plus login), https only, test account only. Prints format classes and counts, never values."""
import collections, json, re, ssl, sys, time, urllib.request, urllib.error
from pathlib import Path
env = {}
for l in (Path(__file__).resolve().parent.parent / ".env.tala-t0").read_text().splitlines():
    if "=" in l and not l.strip().startswith("#"):
        k, _, v = l.partition("="); env[k.strip()] = v.strip().strip("\"'")
base = "https://" + env["TALA_T0_BASE_URL"].replace("https://", "").replace("http://", "").strip("/")
class NR(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
O = urllib.request.build_opener(NR, urllib.request.HTTPSHandler(context=ssl.create_default_context()))
n = 0
def call(m, path, tok=None, body=None):
    global n
    n += 1
    if n > 40: sys.exit("cap")
    time.sleep(0.5)
    h = {"Accept": "application/json", **({"Content-Type": "application/json"} if body else {}), **({"Authorization": "Bearer " + tok} if tok else {})}
    try:
        r = O.open(urllib.request.Request(base + path, data=json.dumps(body).encode() if body else None, method=m, headers=h), timeout=30); raw = r.read(); return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, None
def fmt(v):
    if v is None: return "null"
    s = str(v)
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s): return "YYYY-MM-DD"
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?", s): return "ISO datetime" + (" with zone" if re.search(r"(Z|[+-]\d{2}:?\d{2})$", s) else " no zone")
    if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}", s): return "M/D/YYYY"
    if re.fullmatch(r"\d+/\d+", s): return "n/total"
    if re.fullmatch(r"\d+(\.\d+)?", s): return "number"
    if s == "": return "empty"
    return "text"
st, p = call("POST", "/api/v1/login", body={"username": env["TALA_T0_USERNAME"], "password": env["TALA_T0_PASSWORD"]})
tok, uid = p["accessToken"], p["userId"]
st, teams = call("GET", f"/api/v1/auth/users/{uid}/teams", tok)
fields = ["dateFrom", "dateTo", "dateAssigned", "progress", "status"]
seen = {f: collections.Counter() for f in fields}
statuses = collections.Counter(); total = collections.Counter(); ordering = collections.Counter(); sync_prog = collections.Counter()
count = 0
for t in teams:
    st, courses = call("GET", f"/api/v1/auth/users/{uid}/teams/{t['teamId']}/courses", tok)
    for c in courses or []:
        count += 1
        for f in fields: seen[f][fmt(c.get(f))] += 1
        statuses[str(c.get("status"))] += 1
        total[fmt((c.get("course") or {}).get("totalMaterial"))] += 1
        if c.get("dateFrom") and c.get("dateTo"): ordering["dateTo >= dateFrom" if str(c["dateTo"]) >= str(c["dateFrom"]) else "dateTo < dateFrom"] += 1
print("courses across all teams:", count)
for f in fields: print(f"  {f}:", dict(seen[f]))
print("  status values:", dict(statuses))
print("  course.totalMaterial format:", dict(total), "| ordering:", dict(ordering))
print("requests:", n)
