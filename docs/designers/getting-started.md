# Your first prototype

[Designer guide](README.md) · Next: [Build and edit a journey](building-a-journey.md)

The quickest way to learn the kit is to run the example, change a heading and try the journey again. Leave route names and answer names alone for this first exercise.

## Before you start

You need:

- Node.js 24, which includes npm, installed on your computer.
- A text editor and a terminal.
- A copy of this repository. For your team's work, use your own repository rather than pushing edits to the shared kit.
- Access to GitHub if you want to publish. You can work locally before setting up publishing.

If installation or Git is unfamiliar, ask a developer or another designer to help prepare your local folder and repository. After setup, most day-to-day edits happen in the small set of files listed in the [designer guide](README.md).

**Choose repository visibility deliberately.** A public repository exposes its source content, history and screenshots even if its deployed prototype is encrypted. Use a private source repository for designs you intend to withhold; encryption cannot undo previous public disclosure.

## 1. Open and run your copy

Open a terminal in the project folder. If you are just trying the shared starter, you can get a local copy with:

```sh
git clone https://github.com/doideaco/GOV.UK-Static-Prototype-Kit.git
cd GOV.UK-Static-Prototype-Kit
```

If you already have your team's copy, open that folder instead. Then run:

```sh
npm install
npm run dev
```

`npm install` downloads the kit's dependencies. You normally only repeat it when setting up a new copy or after dependencies change. `npm run dev` starts the local preview and watches your edits.

Open **http://localhost:8080/** in your browser. Keep the terminal running while you edit. To stop it, return to the terminal and press **Ctrl+C**.

The localhost address is on your computer. It is not a sharing link for participants.

## 2. Try the unedited journey

From the home page, choose **Open the starter journey**. Try both routes:

```text
Start → Name → Aged 18 or over?
                    ├─ Yes → Check your answers → Confirmation
                    └─ No  → You cannot use this service
```

Use an invented name. On check your answers, change it and check that the updated answer appears. Try **Clear prototype answers** so you know how to reset between attempts.

## 3. Change some content

Open [`src/pages/example/start.njk`](../../src/pages/example/start.njk). Find:

```html
<h1 class="govuk-heading-xl">Apply for a countryside visit</h1>
```

Change only the words between the tags. For example:

```html
<h1 class="govuk-heading-xl">Book a guided nature walk</h1>
```

Save the file. The preview rebuilds; refresh the browser if it does not update automatically.

The block at the top of the page is its **front matter**:

```yaml
---
layout: layouts/service.njk
title: Apply for a countryside visit
permalink: /example/start/
---
```

Update `title` to match the new wording. It is used in the browser tab; it does not automatically change the visible heading. Keep `layout` and `permalink` unchanged for now.

Use single quotes if a YAML value contains punctuation such as a colon:

```yaml
title: 'Nature walks: before you start'
```

## 4. Give the prototype an identity

Open [`src/data/site.yaml`](../../src/data/site.yaml). Change these values for your own prototype:

```yaml
name: Book a guided nature walk
prototypeId: nature-walk-prototype
schemaVersion: 1
storage: session
resetOnStart: false
```

- `name` appears in the shared service header and page titles.
- `prototypeId` keeps this prototype's saved answers separate from other prototypes. Use a unique name with lowercase letters, numbers and hyphens.
- `schemaVersion` can stay at `1` initially.
- `storage: session` is the recommended starting point for ordinary research sessions.

The service name, page title and visible heading are separate pieces of content. Change all relevant pieces when renaming a service. The home page also contains starter-specific wording in `src/pages/index.njk` that you may want to replace.

## 5. Check your change

Try the page at desktop and narrow browser widths. Tab through its links and buttons. Confirm that headings, hint text and the browser title make sense.

Before recording or sharing a version, run:

```sh
npm run check
```

If the terminal reports a problem, correct it before publishing. This command checks templates, configuration and other technical behaviour; it does not replace a content or accessibility review.

## A normal editing session

1. Start `npm run dev`.
2. Make one small change in `src/`.
3. Save and try it in the browser.
4. Clear old answers when they would make the test misleading.
5. Review the change with your team and record it in Git.

With a GUI Git tool, recording normally means reviewing the changed files, writing a commit message and pushing. The equivalent terminal commands are:

```sh
git add src
git commit -m "Update nature walk start page"
git push origin main
```

Review what you stage and push to your own team's remote. Pushing to `main` starts the deployment workflow; it needs the encryption secret configured before it can succeed. [Research and sharing](research-and-sharing.md) explains that setup.

## If you get stuck

| What you see | What to check |
| --- | --- |
| `npm` is not recognised | Node.js/npm may not be installed or your terminal needs reopening. |
| The browser cannot open localhost | Check that `npm run dev` is still running and use the address printed in the terminal. |
| Your change disappears | Make sure you edited a file in `src/`, not generated output. |
| A YAML error | Check indentation, use spaces rather than tabs, and quote text containing a colon. |
| Old answers keep appearing | Use **Clear prototype answers** before trying the journey again. |
| Another service appears in the header | Change `name` in `src/data/site.yaml`; it is separate from the page heading. |

When asking for help, share the file you changed and the relevant error message. Do not share real participant data or the encryption passphrase in an issue or chat.
