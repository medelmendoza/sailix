#!/usr/bin/env python3
"""
T0 - Tala API verification probe (read-only). Approved by the product owner on 2026-10-13 (D-T1):
production host, dedicated TEST account, HTTPS only, read-only.

Safety properties (do not weaken):
  * https:// only, certificate verification ON, exact host from backend/.env.tala-t0; redirects are NOT followed.
  * Calls: POST /api/v1/login (needed to obtain a token) and GET requests only. Never calls register,
    forgot-password, change-password, delete, team/course apply or sync.
  * Output is SHAPE ONLY: key names, value types, counts, status codes, header names. No values, no tokens,
    no password, no ids, no personal data. Failures print the status code and error KEYS, never the body.
  * One request per second; hard cap on the number of requests.
Usage: python3 scripts/tala-t0-probe.py   (from backend/)
"""
import base64
import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent.parent / ".env.tala-t0"
MAX_REQUESTS = 30
sent = 0


def load_env():
    values = {}
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        values[k.strip()] = v.strip().strip("\"'")
    return values


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


OPENER = urllib.request.build_opener(NoRedirect, urllib.request.HTTPSHandler(context=ssl.create_default_context()))


def call(base, method, path, token=None, body=None, label=""):
    """Returns (status, parsed_json_or_None, headers)."""
    global sent
    sent += 1
    if sent > MAX_REQUESTS:
        sys.exit("request cap reached")
    time.sleep(1)
    headers = {"Accept": "application/json"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(base + path, data=data, method=method, headers=headers)
    try:
        resp = OPENER.open(req, timeout=20)
        status, raw, hdrs = resp.status, resp.read(), resp.headers
    except urllib.error.HTTPError as e:
        status, raw, hdrs = e.code, e.read(), e.headers
    except Exception as e:  # network / TLS problem: type only
        print(f"  [{label}] transport error: {type(e).__name__}")
        return None, None, {}
    try:
        parsed = json.loads(raw) if raw else None
    except ValueError:
        parsed = None
    return status, parsed, hdrs


def shape(value, depth=0):
    """Structure without values. Enum-like strings are NOT revealed either."""
    if isinstance(value, dict):
        return {k: shape(v, depth + 1) for k, v in value.items()} if depth < 5 else "{...}"
    if isinstance(value, list):
        return [f"len={len(value)}"] + ([shape(value[0], depth + 1)] if value else [])
    if value is None:
        return "null"
    return type(value).__name__


def show(label, status, parsed, hdrs, extra=None):
    print(f"[{label}] HTTP {status}")
    if parsed is not None:
        print("  body shape:", json.dumps(shape(parsed)))
    if extra:
        print("  ", extra)
    keep = [h for h in ("content-type", "www-authenticate", "strict-transport-security", "access-control-allow-origin") if h in {k.lower() for k in hdrs.keys()}]
    if keep:
        print("   headers present:", keep)


def jwt_info(token):
    parts = token.split(".")
    if len(parts) != 3:
        return "token is NOT a 3-part JWT (opaque or other format)"
    try:
        pad = lambda s: s + "=" * (-len(s) % 4)
        header = json.loads(base64.urlsafe_b64decode(pad(parts[0])))
        payload = json.loads(base64.urlsafe_b64decode(pad(parts[1])))
    except Exception:
        return "token has 3 parts but is not decodable JWT JSON"
    life = None
    if isinstance(payload.get("exp"), (int, float)) and isinstance(payload.get("iat"), (int, float)):
        life = f"{(payload['exp'] - payload['iat']) / 3600:.2f} h"
    return f"JWT alg={header.get('alg')} typ={header.get('typ')} claims={sorted(payload.keys())} lifetime={life}"


def main():
    env = load_env()
    host = env["TALA_T0_BASE_URL"].replace("https://", "").replace("http://", "").strip("/")
    if "://" in env["TALA_T0_BASE_URL"] and env["TALA_T0_BASE_URL"].startswith("http://"):
        print("note: file says http://, probe uses https:// regardless (credentials never go over HTTP)")
    base = "https://" + host
    team_id = env.get("teamId", "")
    print(f"T0 probe -> https://<host from file>  ({len(sys.argv)} args)  cap={MAX_REQUESTS} requests\n")

    # 0. No credentials: what does the auth surface say?
    st, p, h = call(base, "GET", "/api/v1/auth/users/teams/x/courses", label="no-token")
    show("GET protected path without a token", st, p, h)

    # 1. Login
    st, p, h = call(base, "POST", "/api/v1/login", body={"username": env["TALA_T0_USERNAME"], "password": env["TALA_T0_PASSWORD"]}, label="login")
    show("POST /api/v1/login", st, p, h)
    if st != 200 or not isinstance(p, dict) or "accessToken" not in p:
        print("login failed; stopping")
        return
    token, user_id = p["accessToken"], str(p["userId"])
    print("   access token:", jwt_info(token))
    if p.get("refreshToken"):
        print("   refresh token:", jwt_info(p["refreshToken"]))
    print("   userId looks like:", "UUID" if len(user_id) == 36 and user_id.count("-") == 4 else f"{type(p['userId']).__name__} of length {len(user_id)}")

    # 2. Profile (read)
    st, p, h = call(base, "GET", f"/api/v1/auth/users/{user_id}", token, label="profile")
    show("GET user profile", st, p, h)

    # 3. Teams (read)
    st, p, h = call(base, "GET", f"/api/v1/auth/users/{user_id}/teams", token, label="teams")
    show("GET user teams", st, p, h)
    teams = [t.get("teamId") for t in p] if st == 200 and isinstance(p, list) else []
    print("   configured teamId is among the user's teams:", team_id in [str(t) for t in teams], "| teams:", len(teams))
    if not team_id and teams:
        team_id = str(teams[0])

    # 4. Courses of the team (read)
    st, courses, h = call(base, "GET", f"/api/v1/auth/users/{user_id}/teams/{team_id}/courses", token, label="courses")
    show("GET team courses", st, courses, h)

    # 5. Authorization probes with FAKE ids only (no other person's data can be read this way)
    nil = "00000000-0000-0000-0000-000000000000"
    for label, path in [
        ("own token + fake userId in path", f"/api/v1/auth/users/{nil}/teams/{team_id}/courses"),
        ("own userId + fake teamId in path", f"/api/v1/auth/users/{user_id}/teams/{nil}/courses"),
        ("own token + fake userId (profile)", f"/api/v1/auth/users/{nil}"),
    ]:
        st, p, h = call(base, "GET", path, token, label=label)
        show(f"AUTHZ probe: {label}", st, p, h)

    # 6. Bad token
    st, p, h = call(base, "GET", f"/api/v1/auth/users/{user_id}", "not-a-real-token", label="bad-token")
    show("GET profile with a garbage token", st, p, h)

    # 7. One metadata fetch per material type present (no binary downloads; EPUB and legacy QUIZ skipped per D-T6)
    if st is not None and isinstance(courses, list) and courses:
        details = []
        for item in courses:
            details += (item.get("course") or {}).get("materialDetails") or []
        types = sorted({str(d.get("materialType")) for d in details})
        print(f"\n   material types present in assigned courses: {types} ({len(details)} materials)")
        path_for = {"video": "videos", "pdf": "pdf", "card": "upgraded_cards", "flashcard": "upgraded_cards", "quiz": "up_quizzes", "up_quiz": "up_quizzes"}
        done = set()
        for d in details:
            t = str(d.get("materialType")).lower()
            seg = path_for.get(t)
            if not seg or seg in done or not d.get("materialId"):
                continue
            done.add(seg)
            st, p, h = call(base, "GET", f"/api/v1/auth/users/teams/{team_id}/{seg}/{d['materialId']}", token, label=seg)
            show(f"GET material metadata ({seg})", st, p, h)
        # 8. Server-held progress for one assignment (read)
        first = courses[0]
        st, p, h = call(base, "GET", f"/api/v1/auth/users/{user_id}/teams/{team_id}/courses/{first.get('courseId')}/sync/{first.get('assignId')}/data", token, label="sync-data")
        show("GET stored progress for one assignment", st, p, h)

    print(f"\ndone: {sent} requests")


if __name__ == "__main__":
    main()
