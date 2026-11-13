#!/bin/bash
# Builds the downloadable Mochiboard.zip (Apple chip + Intel) and publishes it as a GitHub Release, with the release video when there is one.
#   ./make-release.sh          build + publish the version in VERSION
#   ./make-release.sh --dry    build the zip only
# People download it from https://github.com/jessawolfe-ux/mochiboard/releases/latest/download/Mochiboard.zip
set -e
cd "$(dirname "$0")"
V="$(cat VERSION)"; OUT=build/release; APP="$OUT/Mochiboard.app"
rm -rf "$OUT" && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
echo "  Building Mochiboard $V for Apple chip and Intel Macs…"
build() { swiftc -O -target "$1-apple-macos13" Sources/Mochiboard.swift -o "$OUT/bin-$1" 2>/dev/null || {
  printf '' > build/empty.modulemap
  printf '{ "version": 0, "case-sensitive": "false", "roots": [ { "type": "file", "name": "/Library/Developer/CommandLineTools/usr/include/swift/module.modulemap", "external-contents": "%s/build/empty.modulemap" } ] }' "$PWD" > build/overlay.yaml
  swiftc -O -target "$1-apple-macos13" -vfsoverlay build/overlay.yaml Sources/Mochiboard.swift -o "$OUT/bin-$1"; }; }
build arm64; build x86_64
lipo -create "$OUT/bin-arm64" "$OUT/bin-x86_64" -output "$APP/Contents/MacOS/Mochiboard"
cp -R web "$APP/Contents/Resources/web"; find "$APP" -name .DS_Store -delete
cp assets/Mochiboard.icns "$APP/Contents/Resources/Mochiboard.icns"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Mochiboard</string>
  <key>CFBundleDisplayName</key><string>Mochiboard</string>
  <key>CFBundleIdentifier</key><string>io.github.jessawolfe-ux.mochiboard</string>
  <key>CFBundleExecutable</key><string>Mochiboard</string>
  <key>CFBundleIconFile</key><string>Mochiboard</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$V</string>
  <key>CFBundleVersion</key><string>$V</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSMicrophoneUsageDescription</key><string>Mochiboard records voice memos onto your board.</string>
  <key>NSCameraUsageDescription</key><string>Mochiboard records videos of you onto your board, only when you press Start recording.</string>
  <key>NSSpeechRecognitionUsageDescription</key><string>Mochi writes out your voice memos on your Mac, so you can search and sort them.</string>
</dict></plist>
PLIST
# sign with Jessa's Developer ID when this Mac has it, then have Apple notarize it, so it opens on first double-click everywhere
ID="Developer ID Application: Jessica Wolfe (WAK79U5DU8)"; SIGNED=
if security find-identity -v -p codesigning 2>/dev/null | grep -q "$ID"; then
  codesign --force --deep --options runtime --timestamp --entitlements assets/Mochiboard.entitlements --sign "$ID" "$APP"; SIGNED=1
else codesign --force --deep --sign - "$APP"; echo "  (no Developer ID on this Mac: ad-hoc signed, so the first open needs Open Anyway)"; fi
( cd "$OUT" && /usr/bin/ditto -c -k --keepParent Mochiboard.app Mochiboard.zip )
if [ -n "$SIGNED" ] && [ "${1:-}" != "--dry" ]; then
  echo "  Sending to Apple's notary service (usually a few minutes)…"
  xcrun notarytool submit "$OUT/Mochiboard.zip" --keychain-profile mochiboard --wait
  xcrun stapler staple "$APP"
  rm "$OUT/Mochiboard.zip"; ( cd "$OUT" && /usr/bin/ditto -c -k --keepParent Mochiboard.app Mochiboard.zip )   # zip again with Apple's ticket stapled in
  spctl --assess --type execute -v "$APP" && echo "  ✓ Notarized and stapled"
fi
echo "  ✓ $OUT/Mochiboard.zip ($(du -h "$OUT/Mochiboard.zip" | cut -f1))"
[ "${1:-}" = "--dry" ] && exit 0
# release notes: the newest section of WHATSNEW.md
NOTES="$(awk '/^## /{n++} n==1 && /^- /' WHATSNEW.md)"
# the release video goes on the release too: "Mochiboard 1.10 (wide).mp4" (+ "(thumbnail).png" beside it) from ~/Desktop/Posts & videos,
# or VIDEO=/path/to/video.mp4 [THUMB=/path/to/thumb.png]; NOVIDEO=1 skips it. Patch versions (1.10.1) only get one if a video names that exact version.
VV="${V%.0}"; MEDIA=(); TOP=""
[ -z "${NOVIDEO:-}" ] && [ -z "${VIDEO:-}" ] && VIDEO="$(ls -t "$HOME/Desktop/Posts & videos"/*/"Mochiboard $VV (wide).mp4" 2>/dev/null | head -1)"
if [ -z "${NOVIDEO:-}" ] && [ -f "${VIDEO:-}" ]; then
  [ -z "${THUMB:-}" ] && THUMB="${VIDEO% (wide).mp4} (thumbnail).png"
  cp "$VIDEO" "$OUT/Mochiboard-$VV-whats-new.mp4"; MEDIA+=("$OUT/Mochiboard-$VV-whats-new.mp4")
  DL="https://github.com/jessawolfe-ux/mochiboard/releases/download/v$V"
  MIN=$( { ffmpeg -i "$VIDEO" 2>&1 || true; } | awk -F'[:,. ]+' '/Duration:/{printf "%d:%02d", $3*60+$4, $5; exit}')
  if [ -f "$THUMB" ]; then
    cp "$THUMB" "$OUT/Mochiboard-$VV-whats-new.png"; MEDIA+=("$OUT/Mochiboard-$VV-whats-new.png")
    TOP="[![What's new in Mochiboard $VV: watch the video]($DL/Mochiboard-$VV-whats-new.png)]($DL/Mochiboard-$VV-whats-new.mp4)

"
  fi
  TOP="$TOP**▶ [Watch what's new in $VV]($DL/Mochiboard-$VV-whats-new.mp4)**${MIN:+ ($MIN)}

"
  echo "  ✓ Video: $(basename "$VIDEO")"
else echo "  (no release video for $VV: put \"Mochiboard $VV (wide).mp4\" in ~/Desktop/Posts & videos, or VIDEO=/path)"; fi
git push -q origin "$(git branch --show-current)" 2>/dev/null || true   # the tag must point at this branch's commit (stable for a fix, main for a new version), not whatever the default branch has
gh release create "v$V" "$OUT/Mochiboard.zip" "${MEDIA[@]}" --target "$(git branch --show-current)" --title "Mochiboard $V" --notes "$TOP$NOTES

$( [ -n "$SIGNED" ] && echo "**Mac:** Mochiboard.zip below. Unzip it, drag Mochiboard into Applications, and open it. It’s signed and notarized with Apple, so it opens like any Mac app." || echo "**Mac:** Mochiboard.zip below. Unzip it and drag Mochiboard into Applications. The first time, your Mac says it “could not verify Mochiboard is free of malware”: that’s because this build isn’t notarized by Apple. On macOS 15: double-click it once, click Done, then System Settings → Privacy & Security → scroll to Security → **Open Anyway**. On macOS 13/14: right-click → **Open**. Once." )

**Windows:** Mochiboard-Setup.exe below (it appears a few minutes after this release). Open it and follow the steps. If Edge holds the download, choose Keep from its … menu; if Windows says it “protected your PC”, click More info, then Run anyway."
echo "  ✓ Published v$V"
