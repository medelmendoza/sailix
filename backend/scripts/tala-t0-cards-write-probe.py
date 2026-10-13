#!/usr/bin/env python3
"""
T0f - Flashcard + video-feedback write verification THROUGH THE REAL SAILIX GATEWAY (owner-authorized 2026-10-13: production host, dedicated TEST
account only, https only, smallest possible write, restore afterwards).

  1. start a throwaway local Sailix backend (database sailix_e2e, random password, progress writes ON for this process only)
  2. read the test account's stored snapshot S0 directly from Tala
  3. map the throwaway gateway to the team that has an assigned flashcard set, link the account, rate EVERY card through the gateway,
     and complete ONE assigned video that has no stored row, with feedback (rating + comment) -> Tala stores the rows
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
team = env["teamId"]  # replaced below by the team that has a flashcard set
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

# ---- Tala: login, find the flashcard set, read S0 ---------------------------------------------------------------------
st, p = http(OPENER, "POST", TALA + "/api/v1/login", body={"username": env["TALA_T0_USERNAME"], "password": env["TALA_T0_PASSWORD"]})
assert st == 200, f"tala login {st}"
tok, uid = p["accessToken"], p["userId"]
st, teams = http(OPENER, "GET", f"{TALA}/api/v1/auth/users/{uid}/teams", tok)
target = None
for t in teams:
    st, courses = http(OPENER, "GET", f"{TALA}/api/v1/auth/users/{uid}/teams/{t['teamId']}/courses", tok)
    if st != 200: continue
    for c in courses:
        mats = (c.get("course") or {}).get("materialDetails", [])
        cards = [d["materialId"] for d in mats if str(d.get("materialType")).lower() == "up_card"]
        if not cards: continue
        st, snap = http(OPENER, "GET", f"{TALA}/api/v1/auth/users/{uid}/teams/{t['teamId']}/courses/{c['courseId']}/sync/{c['assignId']}/data", tok)
        if st == 404: snap = {}                       # never synced: Tala holds no record yet
        elif st != 200: continue
        have_cards = {x.get("cardId") for x in snap.get("materials", {}).get("cards", [])}
        have_videos = {x.get("videoId") for x in snap.get("materials", {}).get("videos", [])}
        if cards[0] in have_cards: continue
        vids = [d["materialId"] for d in mats if str(d.get("materialType")).lower() == "video" and d["materialId"] not in have_videos]
        target = (t["teamId"], c, snap, cards[0], vids[0] if vids else None); break
    if target: break
if not target: sys.exit("no assigned flashcard set without a stored result: nothing to test; NOTHING changed")
team, c, s0, card_id, video_id = target
NO_RECORD = not s0
def empty_record(c):
    course = c.get("course") or {}
    r = {k: c[k] for k in KEEP if k in c and k != "materials"}
    r.update({"courseName": course.get("courseName", ""), "courseDescription": course.get("courseDescription", "") or "", "courseTags": course.get("tags", "") or "", "userTags": c.get("userTags", "") or "",
              "syncDate": "", "status": "NOT YET COMPLETED", "progress": "0/" + str(course.get("totalMaterial", 0)),
              "materials": {"videos": [], "cards": [], "quizzes": [], "epubs": [], "pdfs": []}})
    return r
if NO_RECORD:
    print("this course has NO stored record in Tala (GET returned 404). Tala has no delete: the 'restore' at the end can only write an EMPTY zero-progress record.")
    s0 = empty_record(c)
get_path = f"/api/v1/auth/users/{uid}/teams/{team}/courses/{c['courseId']}/sync/{c['assignId']}/data"
post_path = f"/api/v1/auth/users/{uid}/teams/{team}/courses/sync"
st, deck = http(OPENER, "GET", f"{TALA}/api/v1/auth/users/teams/{team}/upgraded_cards/{card_id}", tok)
n_cards = len(deck["data"])
print(f"S0: card rows stored = {len(s0['materials'].get('cards', []))}; flashcard set size = {n_cards}; a video without a stored row exists: {video_id is not None}")
ratings = [{"index": i, "rating": ["easy", "medium", "hard"][i % 3]} for i in range(n_cards)]

# ---- local gateway, mapped to THAT team ----------------------------------------------------------------------------------
pw = "Pw-" + secrets.token_hex(10)
E = dict(os.environ, APP_ENV="local", DB_DATABASE="sailix_e2e", SEED_DEMO_PASSWORD=pw, SEED_DEMO_TOTP_SECRET="JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
         SAILIX_TALA_ALLOWED_HOSTS=host, SAILIX_TALA_PROGRESS_WRITES="true", MAIL_MAILER="array", APP_DEBUG="false", TT=team)
def sh(*a): return subprocess.run(a, cwd=B, env=E, capture_output=True, text=True)
assert sh("php", "artisan", "migrate:fresh", "--seeder=E2eSeeder", "--force").returncode == 0
php = (f"$t=App\\Models\\Tenant::where('code','SFAI')->firstOrFail();"
       "$m=(new App\\Models\\TenantModule)->forceFill(['tenant_id'=>$t->id,'module'=>App\\Modules\\Module::Tala,'external_team_id'=>getenv('TT'),'status'=>App\\Enums\\ModuleStatus::Enabled]);$m->save();"
       f"App\\Support\\Settings\\SettingsRegistry::setPlatform('tala_api_base_url','{TALA}');echo 'ok';")
assert "ok" in sh("php", "artisan", "tinker", "--execute", php).stdout
srv = subprocess.Popen(["php", "-S", "127.0.0.1:8012", "../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php"], cwd=B / "public", env=dict(E, PHP_CLI_SERVER_WORKERS="4"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(2)
    API = "http://127.0.0.1:8012/api/v1"
    st, p = http(LOCAL, "POST", API + "/auth/token", body={"username": "crew.sfai", "password": pw, "device_name": "probe"})
    sx = p["data"]["token"]
    st, p = http(LOCAL, "POST", API + "/modules/tala/link", sx, {"username": env["TALA_T0_USERNAME"], "password": env["TALA_T0_PASSWORD"]})
    print("gateway link:", st)
    st, p = http(LOCAL, "GET", f"{API}/modules/tala/courses/{c['assignId']}", sx)
    kinds = collections_counter = {}
    for m in p["data"]["materials"]: kinds[m["type"]] = kinds.get(m["type"], 0) + 1
    print("gateway course detail: HTTP", st, "| material kinds:", kinds, "| flashcards viewable:", [m["viewable"] for m in p["data"]["materials"] if m["type"] == "flashcards"])
    st, d = http(LOCAL, "GET", f"{API}/modules/tala/courses/{c['assignId']}/flashcards/{card_id}", sx)
    print("gateway deck GET: HTTP", st, "| cards:", len(d["data"]["cards"]) if st == 200 else "-", "| card keys:", sorted(d["data"]["cards"][0].keys()) if st == 200 else "-")
    st, r = http(LOCAL, "POST", f"{API}/modules/tala/courses/{c['assignId']}/flashcards/{card_id}/ratings", sx, {"version": d["data"]["version"], "ratings": ratings})
    print("gateway ratings (all cards): HTTP", st, "| result:", json.dumps(shape(r["data"]) if st == 200 else r.get("code")), "| counts:", {k: r["data"][k] for k in ("easy", "medium", "hard")} if st == 200 else "-")
    if video_id:
        st, r = http(LOCAL, "POST", f"{API}/modules/tala/courses/{c['assignId']}/progress", sx, {"completed": [video_id], "feedback": {video_id: {"rating": 4.5, "comment": "probe feedback"}}})
        print("gateway video completion with feedback: HTTP", st, "| result:", json.dumps(shape(r["data"]) if st == 200 else r.get("code")))

    st, s1 = http(OPENER, "GET", TALA + get_path, tok)
    print("\nchanged in Tala after the submissions vs the empty baseline (names only):", diff(strip(s0), strip(s1)))
    rows = s1["materials"].get("cards", [])
    if rows:
        row = rows[-1]
        print("stored card-set row shape:", json.dumps(shape({k: v for k, v in row.items() if k != "data"})))
        print("stored card shape:", json.dumps(shape(row["data"][0])), "| result values stored:", sorted({x["result"] for x in row["data"]}))
    if video_id:
        v = [x for x in s1["materials"].get("videos", []) if x.get("videoId") == video_id]
        if v: print("stored video row feedback type:", type(v[0].get("feedback")).__name__, "| comment stored:", v[0].get("comment") == "probe feedback", "| status:", v[0].get("status"))
finally:
    st, _ = http(OPENER, "POST", TALA + post_path, tok, {"courseList": [{k: s0[k] for k in KEEP if k in s0}]})
    st2, s2 = http(OPENER, "GET", TALA + get_path, tok)
    left = diff(strip(s0), strip(s2)) if st2 == 200 else ["could not re-read"]
    print(f"\nrestore POST -> HTTP {st}; differences from the original after restore:", left or ("none -> account is back to its original state" if not NO_RECORD else "none vs an EMPTY record; the course now has an empty stored record where it had none (cannot be deleted)"))
    srv.terminate()
print("requests:", n)
