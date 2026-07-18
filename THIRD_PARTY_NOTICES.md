# Third-party notices

Draftill includes or depends on third-party software. Third-party components are not covered by the Draftill Source-Available Commercial Use License; their original licenses control those components.

## Runtime components

| Component | Purpose | License | Source |
| --- | --- | --- | --- |
| Electron | Desktop application runtime | MIT | https://github.com/electron/electron |
| Chromium | Browser engine embedded by Electron | Multiple open-source licenses | https://www.chromium.org/chromium-projects/ |
| Node.js | JavaScript runtime embedded by Electron | MIT and bundled third-party notices | https://github.com/nodejs/node |
| llama.cpp / ggml | Optional local AI inference runtime | MIT | https://github.com/ggml-org/llama.cpp |

The packaged Windows application includes Electron's `LICENSE.electron.txt` and `LICENSES.chromium.html` notices. The llama.cpp MIT license is reproduced in `third_party/llama.cpp-LICENSE.txt`.

## JavaScript production dependencies

The production dependency report in `third_party/npm-production-licenses.md` records package name, installed version, declared license, and source repository for the dependency tree used to prepare version 0.4.15.

The report found MIT, ISC, MPL-2.0, BSD-3-Clause, and Apache-2.0 licensed packages. Each package remains governed by its complete upstream license text. Source distributions installed through npm include those license files in their package directories.

## AI models

Draftill does not redistribute downloaded AI model weights in this repository or installer. Models downloaded by a user may have separate licenses, acceptable-use policies, or restrictions. Users are responsible for reviewing the terms of each model they download.

## No relicensing

References to third-party components do not imply that their authors endorse Draftill. Nothing in Draftill's first-party license limits permissions independently granted by a third-party license for that third-party component.
