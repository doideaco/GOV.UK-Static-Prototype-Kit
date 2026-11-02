# Research and sharing

[Designer guide](README.md) · Previous: [Build and edit a journey](building-a-journey.md)

Before sharing, decide which version people should see, which fictional answers they should start with and whether answers should remain for a later visit.

## Prepare a research version

Keep changes small and record a version your team can refer to. Publishing changes updates the same site, so avoid pushing changes to `main` during an active research session. If two versions need to stay available at the same time, agree a separate repository or deployment arrangement with a developer; the kit does not automatically create research-version links.

Before a session:

- Walk through every route you intend to test, including ineligible and error states.
- Check that summary **Change** links return to the intended place.
- Try a narrow browser width and keyboard-only navigation.
- Check headings, labels, hints and error messages with your team.
- Use invented names and answers. Do not ask participants to enter real personal information.
- Run `npm run check`. Ask a developer to run/update the relevant browser tests if the journey structure changed.

## Start people at a useful point

A **scenario** is a named set of fictional answers and a page to start on. It is useful when a session needs to begin at a summary or a particular branch.

The starter includes `eligible-applicant` and `ineligible-applicant`. To add one, open `src/data/scenarios.yaml` and add a new top-level entry:

```yaml
returning-visitor:
  label: Returning visitor (fictional)
  start: /example/check-answers/
  answers:
    full-name: Alex Sample
    eligible: 'yes'
    interests: [wildlife]
```

The keys under `answers` must match the form control names. If you added the question from the [journey exercise](building-a-journey.md), include its `visit-reason` answer too. `start` must point to an existing page.

Open the scenario locally:

```text
http://localhost:8080/example/start/?scenario=returning-visitor
```

For a published prototype, append the same page path and query to the full published base URL, including its repository path. Do not replace the published hostname with localhost.

Opening a scenario replaces the saved answers and moves to its start page. The query parameter disappears after application so refreshing does not reset the participant's work. Reopen the original scenario link to deliberately start that preset again. **Clear prototype answers** removes the saved answers and active-scenario marker.

Scenarios are not participant accounts or research records. The scenario ID can appear in a sharing URL; do not put names or other sensitive information in it. Scenario definitions are visible in source, and in ordinary unencrypted output. Encrypted export protects the definitions inside its payload, but cannot hide a public source repository.

## Choose whether answers survive a later visit

Edit `src/data/site.yaml`:

| Research need | Setting |
| --- | --- |
| Keep answers through a normal tab session | `storage: session` — the default. |
| Let someone leave and return in the same browser profile | `storage: local`. |
| Reset when the sample Start page is opened | `resetOnStart: true`. |

For a resumable fictional journey:

```yaml
storage: local
resetOnStart: false
```

Save, rebuild and redeploy to change the published behaviour. Answers do not travel between devices, browser profiles or participants. Local storage can be shared by tabs on the same origin; use **Clear prototype answers** between participants who share a browser. The prototype author does not receive the saved answers as research results.

Browser settings can block or remove storage. A browser may also restore a closed tab's session storage, so do not rely on closing a tab to erase answers. Clear them explicitly.

### What happens when an encrypted prototype is locked?

- **Clear prototype answers** removes the answers but leaves that tab unlocked.
- **Lock prototype** removes that tab's remembered unlock key **and its answers**, including answers saved with `storage: local`.
- Closing and returning later may require unlocking again, even if fictional local-storage answers are still available. Browser restoration behaviour varies; use the lock action when finishing on a shared device.

There is currently no “lock but keep my answers” option. Other unlocked tabs keep their own session keys. Saved answers are readable browser data: export encryption protects the published prototype, not answers entered during a session.

## Publish your prototype

The first setup needs permission to manage your team's GitHub repository. Ask a repository administrator to help if you cannot see the settings.

### First time only

1. In your own repository, open **Settings → Secrets and variables → Actions → Secrets**.
2. Choose **New repository secret**.
3. Name it exactly `ENCRYPTION_PASSPHRASE`. Use a long, unique, randomly generated passphrase of at least 20 characters. Keep it in an appropriate password manager and do not reuse a personal password.
4. Under **Settings → Pages → Build and deployment**, select **GitHub Actions**.
5. If an Actions variable called `PROTOTYPE_PUBLISH_MODE` already exists, remove it or set it to `encrypted`. No mode variable is required for the default encrypted publication.

Do not put the passphrase in a repository variable, `site.yaml`, source code, a commit, a scenario URL or a screenshot. The optional `publicDemoGate` in site.yaml is a separate convenience screen; it is not the encryption setup and should normally stay disabled.

### Each time you share an updated version

1. Save your changes and check the journey locally.
2. Commit and push the reviewed changes to your repository's `main` branch.
3. Open GitHub's **Actions** tab and find **Deploy GitHub Pages**. Wait for it to succeed; a pushed commit is not proof that publishing completed.
4. Open the URL from that deployment and try it in a fresh/private browser window where the prototype has not already been unlocked.
5. Check the unlock screen, passphrase, scenario links and full journey before sending the link to participants.

The URL is specific to your team's repository or configured domain. Copy it from the successful deployment instead of guessing it. Share the passphrase separately from the link, following your organisation's research practice.

If the credential is missing or shorter than 20 characters, encrypted deployment stops. It does not silently publish plaintext. **A failed deployment leaves the previous published version in place**; it does not take that version offline or protect material already published publicly. Other checks run separately, so review the **Checks** workflow too; the current deployment workflow does not wait for it.

Changing the secret and deploying again changes the passphrase for the new build. Every build also refreshes its salt, so people may need to unlock again after an update. Neither action can revoke a copy someone has already downloaded and decrypted.

## Preview encryption before publishing

You can try the encrypted experience locally:

```sh
npm run build:encrypted
npm run preview:encrypted
```

The build asks for a passphrase with input hidden. Nothing appearing while you type is expected. Stop `npm run dev` with **Ctrl+C** before starting this preview: both servers normally use port 8080.

Open the local preview address and try unlocking, changing pages and locking. This is a root-path preview. If your team is checking a repository-subpath build, ask a developer to use the [encrypted export guide](../encrypted-export.md).

An encrypted preview is a built snapshot, not a live editing session. After editing source, rebuild it to see the change. Use `npm run dev` again for ordinary editing. Never upload `_site/` when you intend to share the encrypted export; its publishing folder is `_encrypted/`.

## When you need a developer or hosting specialist

Ask for support when you need:

- A new service structure with different reset and check-your-answers return routes.
- Complex validation, uploads, data submitted to a server or real accounts.
- Custom scripts, dynamic file loading, embeds or other assets that need checking in encrypted mode.
- Several independently available research versions.
- Real personal data, confidential research or protected government material.

Encrypted static publishing is not organisational authentication. Public source/history, offline password guessing, shared browser origins and untrusted scripts still matter. Use approved authenticated hosting for sensitive work. The [security guidance](../../SECURITY.md) and [encrypted export guide](../encrypted-export.md) explain those boundaries for your technical colleagues.

## Quick recovery guide

| Problem | Next step |
| --- | --- |
| Someone sees old answers | Clear prototype answers or reapply the intended scenario; check for another tab using the same local storage. |
| A scenario opens the wrong state | Check its saved answer keys and start route. Reopening the original scenario URL deliberately replaces answers. |
| Published changes are missing | Check the latest deployment succeeded and that you are using its URL. Refresh and unlock again if necessary. |
| Deployment says the credential is missing | Add `ENCRYPTION_PASSPHRASE` as an Actions repository **secret**, then rerun deployment. |
| A passphrase no longer works after an update | Check the correct passphrase for the deployed version with the person managing the repository secret. Do not paste it into a public issue. |
| A new component or route breaks a browser test | Ask a developer to update the relevant test to reflect the intended journey, then rerun it. |
