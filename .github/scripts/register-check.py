# Copy of the compose hardening check `hosh-deploy register` runs on the box (hosh-migration
# scripts/hosh-deploy, do_register), so CI fails before the box would refuse the compose.
#   docker compose ... config --format json | python3 .github/scripts/register-check.py <service> <BIND>
import json, sys
svc, bind = sys.argv[1], sys.argv[2]
d = json.load(sys.stdin); bad = []
if svc not in d.get("services", {}): bad.append("service %s not in compose" % svc)
for name, s in d.get("services", {}).items():
    p = name + ": "
    u = str(s.get("user", "")).split(":")[0]
    if u in ("", "0", "root"): bad.append(p + "user must be non-root")
    if not s.get("read_only"): bad.append(p + "read_only: true required")
    if "ALL" not in (s.get("cap_drop") or []): bad.append(p + "cap_drop: [ALL] required")
    if s.get("cap_add"): bad.append(p + "cap_add not allowed")
    if not any(o.replace(" ", "") in ("no-new-privileges:true", "no-new-privileges") for o in (s.get("security_opt") or [])): bad.append(p + "no-new-privileges required")
    if s.get("privileged"): bad.append(p + "privileged not allowed")
    for k in ("network_mode", "pid", "ipc", "userns_mode", "uts"):
        if str(s.get(k, "")).startswith("host"): bad.append(p + k + ": host not allowed")
    if s.get("devices"): bad.append(p + "devices not allowed")
    for v in s.get("volumes") or []:
        if v.get("type") not in ("volume", "tmpfs"): bad.append(p + "only named volumes/tmpfs (got %s %s)" % (v.get("type"), v.get("source")))
    for pt in s.get("ports") or []:
        if pt.get("host_ip") not in ("127.0.0.1", "::1"): bad.append(p + "ports must bind 127.0.0.1")
        elif "%s:%s" % (pt.get("host_ip"), pt.get("published")) != bind: bad.append(p + "published %s:%s != BIND %s" % (pt.get("host_ip"), pt.get("published"), bind))
    if not s.get("healthcheck") or s["healthcheck"].get("disable"): bad.append(p + "healthcheck required")
print("\n".join("  ✗ " + b for b in bad) if bad else "  ✓ hardened (non-root, read-only, cap_drop ALL, no-new-privileges, no host access, loopback port, healthcheck)")
sys.exit(1 if bad else 0)
