"""Launch the built app in a temporary iOS simulator; compile-only checks miss launch traps."""
import json
import os
import pathlib
import plistlib
import re
import signal
import subprocess
import time
import urllib.request

def run(*args, timeout=180):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=timeout).stdout

output = pathlib.Path("qa-output")
output.mkdir(exist_ok=True)
products = pathlib.Path("/tmp/foodbank-ios-build/Build/Products/Debug-iphonesimulator")
app = next(products.glob("*.app"))
assert (app / "FoodbankNutritionRules.bundle" / "korean_nutrition_rules_v1.json").is_file(), "Nutrition dictionary must be packaged in the app"
with (app / "Info.plist").open("rb") as stream:
    identifier = plistlib.load(stream)["CFBundleIdentifier"]

runtimes = [r for r in json.loads(run("xcrun", "simctl", "list", "runtimes", "--json"))["runtimes"]
            if r.get("isAvailable") and ".iOS-" in r["identifier"]]
assert runtimes, "An iOS simulator runtime is required"
runtime = max(runtimes, key=lambda r: tuple(int(v) for v in r["version"].split(".")))
types = json.loads(run("xcrun", "simctl", "list", "devicetypes", "--json"))["devicetypes"]
phones = [d for d in types if d["name"].startswith("iPhone") and "Duo" not in d["name"]]
device_type = next((d for d in phones if d["name"] == "iPhone 17 Pro"), phones[-1])
udid = run("xcrun", "simctl", "create", "Foodbank Launch Check", device_type["identifier"], runtime["identifier"]).strip()
metro = None
log = (output / "ios-launch-metro.log").open("w")
try:
    run("xcrun", "simctl", "boot", udid)
    run("xcrun", "simctl", "bootstatus", udid, "-b", timeout=300)
    metro = subprocess.Popen(["npx", "expo", "start", "--localhost", "--port", "8081"],
        stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    for attempt in range(60):
        try:
            if urllib.request.urlopen("http://127.0.0.1:8081/status", timeout=2).status == 200:
                break
        except Exception:
            time.sleep(1)
    else:
        raise RuntimeError("Metro did not start")
    # Warm the exact entry point used by the generated native AppDelegate.
    urllib.request.urlopen("http://127.0.0.1:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false", timeout=180).read()
    run("xcrun", "simctl", "install", udid, str(app))
    launch = run("xcrun", "simctl", "launch", "--terminate-running-process", udid, identifier)
    (output / "ios-launch-result.txt").write_text(launch)
    match = re.search(r":\s*(\d+)\s*$", launch.strip())
    assert match, "Simulator must report the launched process ID"
    pid = int(match.group(1))
    for _ in range(12):
        time.sleep(1)
        os.kill(pid, 0)
    run("xcrun", "simctl", "io", udid, "screenshot", str(output / "ios-launch.png"))
    print(f"Native iOS launch passed on {device_type['name']} / iOS {runtime['version']}: {identifier}")
finally:
    if metro is not None:
        try:
            os.killpg(metro.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    log.close()
    subprocess.run(["xcrun", "simctl", "shutdown", udid], capture_output=True, timeout=60)
    subprocess.run(["xcrun", "simctl", "delete", udid], capture_output=True, timeout=60)
