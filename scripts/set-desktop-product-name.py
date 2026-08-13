from pathlib import Path
import json

p = Path(r"C:\Users\Administrator\AppData\Local\artemis\artemis-agent\apps\desktop\package.json")
d = json.loads(p.read_text(encoding="utf-8"))

d["name"] = "artemis"
d["productName"] = "Artemis"
d["author"] = "Artemis / lipey1"
d["description"] = "Artemis Desktop - native shell for the Artemis agent."
d["homepage"] = "https://github.com/lipey1/artemis-agent"

build = d.setdefault("build", {})
build["productName"] = "Artemis"
build["executableName"] = "Artemis"
build["appId"] = "com.lipey1.artemis"
build["artifactName"] = "Artemis-${version}-${os}-${arch}.${ext}"
build["copyright"] = "Copyright Â© 2026 Artemis / lipey1"
build["publish"] = [
    {"provider": "github", "owner": "lipey1", "repo": "artemis-desktop"}
]

for proto in build.get("protocols") or []:
    if isinstance(proto, dict) and "Artemis" in str(proto.get("name", "")):
        proto["name"] = "Artemis Protocol"

if isinstance(build.get("dmg"), dict):
    build["dmg"]["title"] = "Install Artemis"

mac = build.get("mac")
if isinstance(mac, dict):
    extend = mac.setdefault("extendInfo", {})
    extend["CFBundleDisplayName"] = "Artemis"
    extend["CFBundleExecutable"] = "Artemis"
    extend["CFBundleName"] = "Artemis"
    extend["NSAudioCaptureUsageDescription"] = "Artemis uses audio capture for voice conversations."
    extend["NSCameraUsageDescription"] = "Artemis uses the camera when a plugin or feature you enable requests it."
    extend["NSMicrophoneUsageDescription"] = "Artemis uses the microphone for voice input and voice conversations."

win = build.setdefault("win", {})
win["legalTrademarks"] = "Artemis"
# nsis-web â†’ stub .exe + .nsis.7z; portable zip from win-unpacked separately
win["target"] = [{"target": "nsis-web", "arch": ["x64"]}]

linux = build.setdefault("linux", {})
linux["maintainer"] = "Artemis / lipey1"
linux["synopsis"] = "Native desktop shell for Artemis."

nsis = build.setdefault("nsis", {})
nsis["shortcutName"] = "Artemis"
nsis["uninstallDisplayName"] = "Artemis"
nsis["oneClick"] = False
nsis["allowToChangeInstallationDirectory"] = True
nsis["differentialPackage"] = True

p.write_text(json.dumps(d, indent=2) + "\n", encoding="utf-8")
print("updated", p)
print(
    "name",
    d["name"],
    "productName",
    d["productName"],
    "executableName",
    build.get("executableName"),
    "appId",
    build.get("appId"),
    "version",
    d["version"],
)
