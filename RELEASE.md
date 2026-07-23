# Publishing a new S2000 Gauges release

This is a plain-language guide for cutting a new version of the
standalone Android APK. You do **not** need Android Studio, a JDK, or
any build tools on your computer — GitHub builds the APK for you in
the cloud whenever a new version tag is created. In fact, you don't
need a computer at all: the tag can be created straight from a web
browser on a phone or tablet (Option A below).

> **Prerequisite for either option:** the Repl must be connected to
> GitHub (open the Replit Git pane → "Connect to GitHub") so the code
> lives in a GitHub repository — the APK build runs on GitHub Actions.

If you've never done this before, start with
["Option A — from any web browser (no PC needed)"](#option-a--from-any-web-browser-no-pc-needed);
it's the easiest path and works from any device.

---

## Option A — from any web browser (no PC needed)

You can publish a new version entirely from a browser — even from the
tablet running the gauges. GitHub's "Draft a new release" flow creates
the version tag for you, which fires the exact same build workflow as
a command-line tag push.

1. Open the repository on **github.com** and sign in.
2. Tap **Releases** (on the repo's main page) → **Draft a new
   release**.
3. Under **Choose a tag**, type the new version (e.g. `v1.6` — always
   a lowercase `v`) and tap **Create new tag on publish**.
4. Tap **Publish release** — this creates the tag and starts the APK
   build automatically.
5. Watch progress in the **Actions** tab (see
   ["Where to watch the build run"](#where-to-watch-the-build-run)
   below). About 5–10 minutes later the download button in the gauge
   app flips from "preparing" to the live APK.

That's the whole thing — no Git, no terminal, no computer.

---

## What this gets you

When a new tag is pushed, GitHub Actions automatically:

1. Builds a fresh `app-release.apk` from the current code.
2. Commits that APK back into `public/downloads/app-release.apk`.
3. Attaches the APK to a GitHub Release matching the tag.

The next time the dashboard server is restarted (or your deployed
Replit app refreshes), the in-app download button flips from
"preparing" to **"Android App vX.Y · NN MB"** and your friends can
tap it to install the new version. Phones and tablets that already
have the app installed simply re-install on top.

---

## Option B — from a computer with Git

Prefer the command line, or already have the repo cloned? The four
commands below do exactly the same thing as Option A.

### First-time setup (do this once)

You need:

- **Git** on your computer. Easiest:
  - Mac: open Terminal, type `git --version`, follow the install
    prompt.
  - Windows: install [Git for Windows](https://git-scm.com/download/win)
    and accept the defaults.
  - Linux: `sudo apt install git` (or your distro's equivalent).
- A **GitHub account** that can push to this repository.
- One-time GitHub sign-in on the command line. The first time you
  push, Git will pop up a browser window asking you to log in to
  GitHub — just click through. After that it remembers you forever.
- A **clone** of this repository on your computer. In Terminal /
  Command Prompt:

  ```bash
  git clone https://github.com/<your-username>/<your-repo>.git
  cd <your-repo>
  ```

  Replace `<your-username>` and `<your-repo>` with the values from
  the green **Code** button on the repository's GitHub page.

That's it. You only do this once.

---

### The 4 commands to release a new version

Open Terminal / Command Prompt, change into the repo folder, and run
these four commands. Replace `v1.6` with whatever the next version
should be (`v1.7`, `v2.0`, etc. — always start with a lowercase `v`).

```bash
git pull                        # pull down the latest code
git tag v1.6                    # create a tag named "v1.6" locally
git push                        # push your latest commits (if any)
git push origin v1.6            # push the tag itself — this is what fires the build
```

What each one does, in one sentence:

| Command | What it does |
|---|---|
| `git pull` | Downloads any changes other people have pushed since you last pulled. |
| `git tag v1.6` | Marks this exact version of the code with the label `v1.6`. |
| `git push` | Uploads any of your own commits to GitHub. |
| `git push origin v1.6` | Uploads the tag — and **this** is what tells GitHub to build a new APK. |

That's it. You're done. The build runs in the cloud; you can close
the terminal and walk away.

---

## Where to watch the build run

1. Open your repository on GitHub in a browser.
2. Click the **Actions** tab at the top.
3. Find the run named **"Build Android APK"** with your tag (e.g.
   `v1.6`). It's usually at the top of the list.
4. Click into it to watch progress.

What you'll see:

- A **yellow dot** spinning means the build is running.
- A **green check mark** means it worked. The new APK is now
  committed to the repo and attached to the matching release.
- A **red X** means it failed. Click the run to see the logs;
  usually one of the steps near the bottom turned red. See
  ["What to do if something goes wrong"](#what-to-do-if-something-goes-wrong)
  below.

**Expected runtime:** about 5–10 minutes the first time, faster on
subsequent runs because GitHub caches the Android tools.

---

## How users get the new APK

There's nothing extra to do. The workflow auto-commits
`public/downloads/app-release.apk` back to the default branch with
the message *"Refresh bundled Android APK (v1.6) [skip ci]"*. The
running dashboard server picks up that file the next time it's
restarted, and the in-app download button flips from "preparing" to
the new version automatically.

If you're hosting on Replit, the deployed app may need a restart /
re-deploy for the file change to take effect. Just hit **Deploy →
Redeploy** on your Replit project.

---

## What to do if something goes wrong

**Red X on the build:**

- **"missing signing secrets"** in the build output → that's not an
  error, just a warning. The APK is still produced, just signed with
  the Android debug key (still installable as a sideload). To get a
  real release-signed APK, follow ["Optional: signed-APK
  setup"](#optional-signed-apk-setup) below.
- **First-ever run is slow or fails halfway** with timeouts → the
  Android SDK tools weren't cached yet. Re-run the workflow:
  Actions → "Build Android APK" → click the failed run → **Re-run
  all jobs** (top right). The second run uses the cache and
  usually succeeds.
- **"tag already exists"** when you `git tag v1.6` → that version
  has been used before. Pick the next one (`v1.7`).
- Any other red step → click the step name to expand its log; the
  actual error message is usually in red near the bottom. Search the
  message in the project's GitHub Issues; if you can't find it, open
  a new issue and paste the failing step's log.

**Build succeeded but the in-app download still says "preparing":**

- The dashboard server caches the APK file at startup. Restart the
  server (on Replit: Deploy → Redeploy; on a Pi: `sudo systemctl
  restart kpro-gauges`). The button should flip to the new version
  within a few seconds.

---

## Optional: signed-APK setup

By default the workflow signs the APK with the standard Android
**debug key** when no real signing keys are configured. That's fine
for sideloading — friends can install it from the in-app download
button without issues. The only downsides:

- Some MDM / enterprise device managers refuse debug-signed APKs.
- Android cosmetically labels the install as "from an unverified
  developer."

To produce a properly-signed release APK, generate a keystore
**once** and add four GitHub Secrets to the repository:

1. On any computer with Java installed, run:

   ```bash
   keytool -genkeypair -v \
     -keystore kpro-gauges-release.keystore \
     -alias kpro-gauges -keyalg RSA -keysize 2048 -validity 10000
   ```

   Pick a strong store-password and key-password. Write them down
   somewhere safe — losing the keystore means future versions can't
   replace older ones on devices.

2. Convert the keystore to base64:

   ```bash
   base64 -w0 kpro-gauges-release.keystore > keystore.b64
   ```

   (On macOS: `base64 -i kpro-gauges-release.keystore > keystore.b64`.)

3. On GitHub: open your repository → **Settings → Secrets and
   variables → Actions → New repository secret**. Add these four,
   one at a time, with these exact names:

   | Secret name | Value |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | The full contents of `keystore.b64` (one long line). |
   | `ANDROID_KEYSTORE_PASSWORD` | The store-password you picked. |
   | `ANDROID_KEY_ALIAS` | `kpro-gauges` (or whatever alias you used in step 1). |
   | `ANDROID_KEY_PASSWORD` | The key-password you picked. |

4. Done. The next tag push uses the real key automatically; missing
   any secret silently falls back to the debug key (the build still
   succeeds).

Keep the original `kpro-gauges-release.keystore` file safe (a
password manager attachment is a good spot). It is **not** in git
and never should be.
