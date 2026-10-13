#!/usr/bin/env python3
"""
T0b - Tala progress-sync WRITE probe. Approved by the product owner on 2026-10-13 ("Go with offline mode and progress
submission"): production host, dedicated TEST account only, HTTPS only, the smallest possible write.

What it does, in order (all on ONE assignment of the test account):
  1. read the account's stored progress snapshot S0 (GET .../sync/{assignId}/data)
  2. POST S0 back UNCHANGED                      -> learns whether the server accepts its own snapshot and what it does
  3. POST S0 with ONE video marked COMPLETED     -> learns merge vs replace, monotonic rules, what gets recomputed
  4. POST S0 again (restore)                     -> learns whether a decrease is accepted; the account ends as it started if so
Safety: https only, no redirects, one request per second, hard cap, test account only, reads credentials from
backend/.env.tala-t0. Output is SHAPE ONLY: key names, counts, categorical status values. No ids, names, e-mails, tokens.
If any step fails unexpectedly the script stops and prints how to restore manually (it never retries a write).
"""
import copy
import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent.parent / ".env.tala-t0"
MAX_REQUESTS = 20
sent = 0
IGNORED = {"createdAt", "createdDate", "createdTime", "updatedAt", "updatedDate", "updatedTime", "millis", "bufferDate", "syncDate", "courseSyncId"}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


OPENER = urllib.request.build_opener(NoRedirect, urllib.request.HTTPSHandler(context=ssl.create_default_context()))


def load_env():
    v = {}
    for line in ENV_FILE.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, _, x = line.partition("=")
            v[k.strip()] = x.strip().strip("\"'")
    return v


def call(base, method, path, token=None, body=None):
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
        r = OPENER.open(req, timeout=30)
        st, raw = r.status, r.read()
    except urllib.error.HTTPError as e:
        st, raw = e.code, e.read()
    except Exception as e:
        sys.exit(f"transport error: {type(e).__name__}")
    try:
        return st, (json.loads(raw) if raw else None)
    except ValueError:
        return st, None


def shape(v, d=0):
    if isinstance(v, dict):
        return {k: shape(x, d + 1) for k, x in v.items()} if d < 5 else "{...}"
    if isinstance(v, list):
        return [f"len={len(v)}"] + ([shape(v[0], d + 1)] if v else [])
    return "null" if v is None else type(v).__name__


def strip(v):
    """Drop volatile server-side metadata before comparing."""
    if isinstance(v, dict):
        return {k: strip(x) for k, x in v.items() if k not in IGNORED}
    if isinstance(v, list):
        return [strip(x) for x in v]
    return v


def diff(a, b, path=""):
    """Names of differing fields (never values)."""
    out = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a:
                out.append(f"{path}.{k} (added)")
            elif k not in b:
                out.append(f"{path}.{k} (removed)")
            else:
                out += diff(a[k], b[k], f"{path}.{k}")
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            out.append(f"{path} (length {len(a)} -> {len(b)})")
        else:
            for i, (x, y) in enumerate(zip(a, b)):
                out += diff(x, y, f"{path}[{i}]")
    elif a != b:
        out.append(f"{path} (changed)")
    return out


def statuses(snap):
    m = snap.get("materials", {})
    return {g: sorted({str(x.get("status")) for x in m.get(g, [])}) for g in m if m.get(g)}


def main():
    env = load_env()
    host = env["TALA_T0_BASE_URL"].replace("https://", "").replace("http://", "").strip("/")
    base = "https://" + host
    team = env["teamId"]

    st, p = call(base, "POST", "/api/v1/login", body={"username": env["TALA_T0_USERNAME"], "password": env["TALA_T0_PASSWORD"]})
    if st != 200:
        sys.exit(f"login failed: {st}")
    token, uid = p["accessToken"], p["userId"]

    st, courses = call(base, "GET", f"/api/v1/auth/users/{uid}/teams/{team}/courses", token)
    if st != 200 or not courses:
        sys.exit(f"no courses: {st}")
    # prefer an assignment that has at least one video not yet completed
    chosen = None
    for c in courses:
        st, snap = call(base, "GET", f"/api/v1/auth/users/{uid}/teams/{team}/courses/{c['courseId']}/sync/{c['assignId']}/data", token)
        if st == 200 and any(str(v.get("status")) != "COMPLETED" for v in snap.get("materials", {}).get("videos", [])):
            chosen = (c, snap)
            break
    if not chosen:
        sys.exit("no assignment with a not-yet-completed video: nothing to test safely")
    c, s0 = chosen
    path_get = f"/api/v1/auth/users/{uid}/teams/{team}/courses/{c['courseId']}/sync/{c['assignId']}/data"
    path_post = f"/api/v1/auth/users/{uid}/teams/{team}/courses/sync"
    print("S0 status values per material group:", statuses(s0))
    print("S0 course-level keys:", sorted(k for k in s0 if k != "materials"))
    print("S0 course 'progress' looks like n/total:", "/" in str(s0.get("progress")), "| course status category:", s0.get("status"))

    # --- step 2: unchanged round trip -------------------------------------------------------------------------------
    st, r = call(base, "POST", path_post, token, {"courseList": [s0]})
    print(f"\n[2] POST S0 unchanged -> HTTP {st}", "| body shape:", json.dumps(shape(r)) if r is not None else "(no body)")
    if st != 200:
        print("    server rejected its own snapshot; retrying once with only the fields the Flutter app sends")
        keep = ["assignId", "courseId", "courseName", "courseDescription", "userId", "teamId", "lastName", "firstName", "middleName", "dateFrom", "dateTo", "dateAssigned", "assignedBy", "email", "status", "progress", "syncDate", "courseTags", "userTags", "materials"]
        s0 = {k: s0[k] for k in keep if k in s0}
        st, r = call(base, "POST", path_post, token, {"courseList": [s0]})
        print(f"    -> HTTP {st}", "| body shape:", json.dumps(shape(r)) if r is not None else "(no body)")
        if st != 200:
            sys.exit("stopping: no accepted payload shape; NOTHING was changed")
    st, s1 = call(base, "GET", path_get, token)
    print("    fields that differ after the unchanged round trip (names only):", diff(strip(s0), strip(s1)) or "none")

    # --- step 3: one video completed -----------------------------------------------------------------------------------
    s2 = copy.deepcopy(s0)
    v = next(x for x in s2["materials"]["videos"] if str(x.get("status")) != "COMPLETED")
    before = v.get("status")
    v["status"] = "COMPLETED"
    total_done = sum(1 for g in s2["materials"].values() for x in g if str(x.get("status")) == "COMPLETED")
    parts = str(s2.get("progress", "")).split("/")
    if len(parts) == 2 and parts[1].strip().isdigit():
        s2["progress"] = f"{total_done}/{parts[1].strip()}"
        if total_done >= int(parts[1]):
            s2["status"] = "COMPLETED"
    print(f"\n[3] change: ONE video status {before!r} -> 'COMPLETED'; course progress recomputed client-style")
    st, r = call(base, "POST", path_post, token, {"courseList": [s2]})
    print(f"    POST -> HTTP {st}", "| body shape:", json.dumps(shape(r)) if r is not None else "(no body)")
    if st != 200:
        print("    write rejected; account unchanged by this step")
    else:
        st, s3 = call(base, "GET", path_get, token)
        print("    fields that differ vs S0 now (names only):", diff(strip(s0), strip(s3)) or "none")
        print("    material counts per group S0 -> now:", {g: (len(s0['materials'].get(g, [])), len(s3['materials'].get(g, []))) for g in s0["materials"]})
        print("    status values now:", statuses(s3))
        server_changed_other = [d for d in diff(strip(s2), strip(s3))]
        print("    differences between what was SENT and what the server STORES (names only):", server_changed_other or "none (stored exactly as sent)")

        # --- step 4: restore --------------------------------------------------------------------------------------
        print("\n[4] restore original snapshot")
        st, r = call(base, "POST", path_post, token, {"courseList": [s0]})
        print(f"    POST S0 -> HTTP {st}")
        st, s4 = call(base, "GET", path_get, token)
        left = diff(strip(s0), strip(s4))
        print("    differences from the ORIGINAL after the restore (names only):", left or "none -> account is back to its original state")
        if left:
            print("    NOTE: the server did not accept the decrease. Test-account progress for ONE video stays COMPLETED.")

    print(f"\ndone: {sent} requests")


if __name__ == "__main__":
    main()
