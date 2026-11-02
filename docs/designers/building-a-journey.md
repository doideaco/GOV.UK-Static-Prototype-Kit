# Build and edit a journey

[Designer guide](README.md) · Previous: [Your first prototype](getting-started.md) · Next: [Research and sharing](research-and-sharing.md)

For simple next pages and branches, you can also use [ordinary form actions or optional inline radio routing](routing-and-forms.md), with no YAML entry on those pages.

This walkthrough keeps the existing YAML approach. Start with the existing example and add one question. This exercise keeps the `/example/` routes and existing answer names, which avoids changing the sample's return and reset logic.

## Understand a question page

The name page uses an official GOV.UK component macro:

```njk
{% from "govuk/components/input/macro.njk" import govukInput %}
{{ govukInput({
  id: 'full-name',
  name: 'full-name',
  label: {text: 'What is your name?', isPageHeading: true, classes: 'govuk-label--l'},
  hint: {text: 'Use a made-up name for this prototype.'},
  attributes: {'data-required': 'Enter your name'}
}) }}
```

| Part | What to do with it |
| --- | --- |
| `label.text` | Write the question people see. |
| `hint.text` | Add helpful context without replacing the label. |
| `data-required` | Write the message shown when this required question is unanswered. |
| `name` | The saved answer's key. Other pages and branch rules refer to this exact spelling. |
| `id` | The control's identifier, used by labels and error links. Keep it unique on the page. |
| `classes` and `isPageHeading` | Keep the component's intended GOV.UK presentation and heading behaviour. |

Changing the question wording is different from changing the answer name. If you rename `full-name`, also update any summaries and scenarios that use it. If you rename `eligible`, the sample's check-your-answers return logic also needs a runtime change; ask for development support.

## Add a question: reason for the visit

We will add this step:

```text
Name → Reason for the visit → Eligibility → Check your answers
```

### 1. Create the page

Create `src/pages/example/visit-reason.njk` and paste this complete page:

```njk
---
layout: layouts/service.njk
title: Why would you like to visit?
permalink: /example/visit-reason/
back: /example/name/
---
{% from "govuk/components/input/macro.njk" import govukInput %}
{% from "govuk/components/button/macro.njk" import govukButton %}

<form data-journey action="{{ '/example/eligibility/' | url }}" novalidate>
  <div data-errors></div>

  {{ govukInput({
    id: 'visit-reason',
    name: 'visit-reason',
    label: {
      text: 'Why would you like to visit?',
      isPageHeading: true,
      classes: 'govuk-label--l'
    },
    hint: {text: 'Give a short, fictional reason for this prototype.'},
    attributes: {'data-required': 'Enter a reason for your visit'}
  }) }}

  {{ govukButton({text: 'Continue'}) }}
</form>
```

The form wrapper saves answers and handles navigation. `data-errors` provides a place for the error summary; the build adds it if missing. Keep `data-journey` for this YAML-based exercise. With a standard local form action or inline routing radios, that attribute is optional.

### 2. Connect it to the journey

In `src/data/journeys.yaml`, change the name step and add the new one immediately after it:

```yaml
      - path: /example/name/
        next: /example/visit-reason/
      - path: /example/visit-reason/
        next: /example/eligibility/
```

Keep the other steps, including the existing start, eligibility, summary and end pages. The indentation must match the surrounding `steps` list.

Two related edits keep the page markup consistent:

- In `src/pages/example/name.njk`, change the form's action from `/example/eligibility/` to `/example/visit-reason/`, retaining `| url`.
- In `src/pages/example/eligibility.njk`, change the front-matter `back` value to `/example/visit-reason/`.

The journey file decides where a working stateful form goes next. The form action and visible Back link should still describe the same intended journey.

### 3. Show the new answer in the summary

The existing `src/pages/example/check-answers.njk` creates summary rows from a list. Find the list beginning:

```njk
[['full-name','Name','name'],['eligible','Aged 18 or over','eligibility'],['interests','Interests','eligibility']]
```

Replace that list with:

```njk
[['full-name','Name','name'],['visit-reason','Reason for the visit','visit-reason'],['eligible','Aged 18 or over','eligibility'],['interests','Interests','eligibility']]
```

Each entry gives the saved answer key, the visible summary label and the name of its question route under `/example/`. The existing loop adds the answer binding and a **Change** link. Keep the loop around the list.

The sample's return logic supports this new question when the stored eligibility answer is `yes`. A completely new journey with different route or eligibility names needs the return logic in `src/assets/scripts/runtime.ts` adapted too; editing YAML alone does not generalise that logic.

### 4. Update fictional presets

In `src/data/scenarios.yaml`, add a `visit-reason` answer to each relevant scenario. For example:

```yaml
answers:
  full-name: Robin Example
  visit-reason: Learn about fictional woodland wildlife
  eligible: 'yes'
  interests: [walking]
```

This replaces that scenario's existing `answers` mapping, not the whole file. Keep its scenario ID, label and start route. If a preset does not contain an answer, its summary displays **Not provided**.

### 5. Try it

- Start with clear answers and check the new page appears after Name.
- Continue without answering; check the error summary and its link to the question.
- Enter a fictional reason, continue, and check it appears in the summary.
- Choose **Change** beside the reason, edit it and check you return to the summary with the updated answer.
- Try the ineligible route and the research scenarios too.
- Run `npm run check` before publishing.

The kit's browser tests target the original starter page order. Adding a step intentionally changes that order, so ask a developer to update the journey tests before expecting the full browser suite to pass. Do not remove checks just to get a green result.

## Change a branch

The existing eligibility step illustrates a branch:

```yaml
      - path: /example/eligibility/
        next:
          - when:
              field: eligible
              equals: 'yes'
            path: /example/check-answers/
          - otherwise: /example/ineligible/
```

Read this as: “If the answer saved as `eligible` is `yes`, go to check your answers. In every other case, go to the ineligible page.”

`field` must match the control's `name`, and `equals` must match its saved `value`, not necessarily its visible label. Keep `'yes'` and `'no'` quoted. Conditions are checked in order, and a branch list needs a final `otherwise` destination. Every destination must have a real page.

For complex combinations, ask for help with the supported `all`, `any`, `in`, `notEquals` and `exists` rules rather than putting executable code in YAML.

## Show an answer elsewhere

Use a browser answer binding:

```html
<p class="govuk-body">Thank you, <span data-answer="full-name">visitor</span>.</p>
```

The browser fills this after the page loads. The fallback text is visible without enhancement; once the runtime runs, a missing answer becomes **Not provided**. Nunjucks template variables cannot automatically read answers someone enters later in their browser.

For content shown only when a condition is true:

```html
<p class="govuk-body" data-show-when='{"field":"eligible","equals":"yes"}' hidden>
  You can continue with this fictional application.
</p>
```

This is checked on page load. It does not update live while someone changes a radio on the same page. Use official GOV.UK conditional components or ask for development help if that is the interaction you need.

## Habits that prevent broken journeys

- Keep internal links and asset addresses inside the `url` filter, for example `{{ '/example/start/' | url }}`. This makes them work under a GitHub repository path.
- Use official GOV.UK macros instead of drawing lookalike components or copying their generated HTML.
- Give each page a unique permalink ending in `/`.
- Change one route or field name at a time and update its references together.
- Use descriptive error messages that explain how to answer the question.
- Clear old answers after a structural change, so they do not mask a missing step.
