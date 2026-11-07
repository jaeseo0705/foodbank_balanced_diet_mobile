"""Prefer the newest installed stable Xcode so native checks catch current SDK requirements."""
import pathlib
import plistlib
import re
import subprocess

candidates = []
for app in pathlib.Path("/Applications").glob("Xcode*.app"):
    if "beta" in app.name.lower():
        continue
    try:
        with (app / "Contents" / "Info.plist").open("rb") as stream:
            version = plistlib.load(stream)["CFBundleShortVersionString"]
        numbers = tuple(int(part) for part in re.findall(r"\d+", version))
        candidates.append((numbers, app))
    except (OSError, KeyError, plistlib.InvalidFileException):
        pass
if candidates:
    version, app = max(candidates, key=lambda item: item[0])
    subprocess.run(["sudo", "xcode-select", "--switch", str(app / "Contents" / "Developer")], check=True)
    print("Selected Xcode", ".".join(map(str, version)))
subprocess.run(["xcodebuild", "-version"], check=True)
