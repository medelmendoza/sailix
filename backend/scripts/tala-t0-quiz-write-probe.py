#!/usr/bin/env python3
"""
T0d - Quiz write verification THROUGH THE REAL SAILIX GATEWAY (owner-authorized 2026-10-13: production host, dedicated TEST
account only, https only, smallest possible write, restore afterwards).

  1. start a throwaway local Sailix backend (database sailix_e2e, random password, progress writes ON for this process only)
  2. read the test account's stored snapshot S0 directly from Tala
  3. link the account through the gateway, take ONE assigned quiz that has no stored attempt, answer every question correctly
     (the key is read here only to make a deterministic request), submit through the gateway  -> Tala stores the row
  4. read the snapshot again (S1) and report what changed (field NAMES only)
  5. restore S0 by posting it back, and verify the account equals its original state
Output: shapes, counts and categories only. No ids, names, answers, tokens or passwords.
"""
import json, os, re, secrets, ssl, subprocess, sys, time, urllib.error, urllib.request
from pathlib import Path

B = Path(__file__).resolve().parent.parent
env = {}
for l in (B / ".env.tala-t0").read_text().splitlines():
    if "=" in l and not l.strip().startswith("#"):
        k, _, v = l.partition("="); env[k.strip()] = v.strip().strip("\"'")
host = env["TALA_T0_BASE_URL"].replace("https://", "").replace("http://", "").strip("/")
TALA = "https://" + host
team = env["teamId"]
IGNORED = {"createdAt", "createdDate", "createdTime", "updatedAt", "updatedDate", "updatedTime", "millis", "bufferDate", "syncDate", "courseSyncId"}
KEEP = ["assignId", "courseId", "courseName", "courseDescription", "userId", "teamId", "lastName", "firstName", "middleName", "dateFrom", "dateTo", "dateAssigned", "assignedBy", "email", "status", "progress", "syncDate", "courseTags", "userTags", "materials"]
n = 0

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
OPENER = urllib.request.build_opener(NoRedirect, urllib.request.HTTPSHandler(context=ssl.create_default_context()))
LOCAL = urllib.request.build_opener(NoRedirect)

def http(opener, method, url, token=None, body=None):
    global n
    n += 1
    if n > 60: sys.exit("request cap")
    time.sleep(0.5)
    h = {"Accept": "application/json", "Content-Type": "application/json"}
    if token: h["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method=method, headers=h)
    try:
        r = opener.open(req, timeout=60); raw = r.read(); st = r.status
    except urllib.error.HTTPError as e:
        raw = e.read(); st = e.code
    try: return st, json.loads(raw) if raw else None
    except ValueError: return st, None

def strip(v):
    if isinstance(v, dict): return {k: strip(x) for k, x in v.items() if k not in IGNORED}
    if isinstance(v, list): return [strip(x) for x in v]
    return v
def diff(a, b, path=""):
    out = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a: out.append(f"{path}.{k} (added)")
            elif k not in b: out.append(f"{path}.{k} (removed)")
            else: out += diff(a[k], b[k], f"{path}.{k}")
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b): out.append(f"{path} (length {len(a)} -> {len(b)})")
        else:
            for i, (x, y) in enumerate(zip(a, b)): out += diff(x, y, f"{path}[{i}]")
    elif a != b: out.append(f"{path} (changed)")
    return out
def shape(v, d=0):
    if isinstance(v, dict): return {k: shape(x, d + 1) for k, x in v.items()} if d < 4 else "{...}"
    if isinstance(v, list): return [f"len={len(v)}"] + ([shape(v[0], d + 1)] if v else [])
    return "null" if v is None else type(v).__name__

# ---- Tala: login, find the quiz, read S0 ------------------------------------------------------------------------------
st, p = http(OPENER, "POST", TALA + "/api/v1/login", body={"username": env["TALA_T0_USERNAME"], "password": env["TALA_T0_PASSWORD"]})
assert st == 200, f"tala login {st}"
tok, uid = p["accessToken"], p["userId"]
st, courses = http(OPENER, "GET", f"{TALA}/api/v1/auth/users/{uid}/teams/{team}/courses", tok)
target = None
for c in courses:
    st, snap = http(OPENER, "GET", f"{TALA}/api/v1/auth/users/{uid}/teams/{team}/courses/{c['courseId']}/sync/{c['assignId']}/data", tok)
    have = {q.get("quizId") for q in snap.get("materials", {}).get("quizzes", [])}
    for d in (c.get("course") or {}).get("materialDetails", []):
        if str(d.get("materialType")).lower() == "up_quiz" and d["materialId"] not in have:
            target = (c, snap, d["materialId"]); break
    if target: break
if not target: sys.exit("no assigned quiz without a stored attempt: nothing to test; NOTHING changed")
c, s0, quiz_id = target
get_path = f"/api/v1/auth/users/{uid}/teams/{team}/courses/{c['courseId']}/sync/{c['assignId']}/data"
post_path = f"/api/v1/auth/users/{uid}/teams/{team}/courses/sync"
st, quiz = http(OPENER, "GET", f"{TALA}/api/v1/auth/users/teams/{team}/up_quizzes/{quiz_id}", tok)
answers = []
for si, sec in enumerate(quiz["arraySection"]):
    for qi, q in enumerate(sec["data"]):
        answers.append({"ref": f"{si}.{qi}", "value": str(q["answer"]) if q.get("questionType") == "multipleChoice" else q["answer"].split(":") if q.get("questionType") == "checkbox" else q["answer"]})
print(f"S0: quiz rows stored = {len(s0['materials'].get('quizzes', []))}; assigned quiz questions = {len(answers)}")

# ---- local gateway ----------------------------------------------------------------------------------------------------
pw = "Pw-" + secrets.token_hex(10)
E = dict(os.environ, APP_ENV="local", DB_DATABASE="sailix_e2e", SEED_DEMO_PASSWORD=pw, SEED_DEMO_TOTP_SECRET="JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
         SAILIX_TALA_ALLOWED_HOSTS=host, SAILIX_TALA_PROGRESS_WRITES="true", MAIL_MAILER="array", APP_DEBUG="false", TT=team)
def sh(*a): return subprocess.run(a, cwd=B, env=E, capture_output=True, text=True)
assert sh("php", "artisan", "migrate:fresh", "--seeder=E2eSeeder", "--force").returncode == 0
php = (f"$t=App\\Models\\Tenant::where('code','SFAI')->firstOrFail();"
       "$m=(new App\\Models\\TenantModule)->forceFill(['tenant_id'=>$t->id,'module'=>App\\Modules\\Module::Tala,'external_team_id'=>getenv('TT'),'status'=>App\\Enums\\ModuleStatus::Enabled]);$m->save();"
       f"App\\Support\\Settings\\SettingsRegistry::setPlatform('tala_api_base_url','{TALA}');echo 'ok';")
assert "ok" in sh("php", "artisan", "tinker", "--execute", php).stdout
srv = subprocess.Popen(["php", "-S", "127.0.0.1:8011", "../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php"], cwd=B / "public", env=dict(E, PHP_CLI_SERVER_WORKERS="4"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
restored = False
try:
    time.sleep(2)
    API = "http://127.0.0.1:8011/api/v1"
    st, p = http(LOCAL, "POST", API + "/auth/token", body={"username": "crew.sfai", "password": pw, "device_name": "probe"})
    sx = p["data"]["token"]
    st, p = http(LOCAL, "POST", API + "/modules/tala/link", sx, {"username": env["TALA_T0_USERNAME"], "password": env["TALA_T0_PASSWORD"]})
    print("gateway link:", st)
    st, p = http(LOCAL, "GET", f"{API}/modules/tala/courses/{c['assignId']}", sx)
    print("gateway course detail: HTTP", st, "| progress_submission:", p["data"].get("progress_submission"), "| quiz viewable:", [m["viewable"] for m in p["data"]["materials"] if m["type"] == "quiz"])
    st, q = http(LOCAL, "GET", f"{API}/modules/tala/courses/{c['assignId']}/quizzes/{quiz_id}", sx)
    print("gateway quiz GET: HTTP", st, "| contains the word 'answer':", "answer" in json.dumps(q).lower(), "| questions:", sum(len(s["questions"]) for s in q["data"]["sections"]) if st == 200 else "-")
    st, r = http(LOCAL, "POST", f"{API}/modules/tala/courses/{c['assignId']}/quizzes/{quiz_id}/attempts", sx, {"version": q["data"]["version"], "answers": answers})
    print("gateway attempt (all correct): HTTP", st, "| result shape:", json.dumps(shape(r["data"]) if st == 200 else r.get("code")))

    st, s1 = http(OPENER, "GET", TALA + get_path, tok)
    print("\nchanged in Tala after the submission (names only):", diff(strip(s0), strip(s1)))
    rows = s1["materials"].get("quizzes", [])
    if rows:
        row = rows[-1]
        print("stored quiz row shape:", json.dumps(shape({k: v for k, v in row.items() if k != "sections"})))
        print("stored question shape:", json.dumps(shape(row["sections"][0]["data"][0])))
        print("stored remarks category:", row.get("remarks"), "| status:", row.get("status"))
finally:
    # ---- restore S0 exactly -------------------------------------------------------------------------------------------
    st, _ = http(OPENER, "POST", TALA + post_path, tok, {"courseList": [{k: s0[k] for k in KEEP if k in s0}]})
    st2, s2 = http(OPENER, "GET", TALA + get_path, tok)
    left = diff(strip(s0), strip(s2)) if st2 == 200 else ["could not re-read"]
    print(f"\nrestore POST -> HTTP {st}; differences from the original after restore:", left or "none -> account is back to its original state")
    srv.terminate()
print("requests:", n)
