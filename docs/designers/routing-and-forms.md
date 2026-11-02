# Choose your form routing

[Designer guide](README.md) · [Build and edit a journey](building-a-journey.md)

Routing decides which page opens after someone submits a form. You can use any of the three approaches below on different pages of the same prototype. Existing YAML journeys keep working; the inline shortcuts are optional.

Start `npm run dev` and open **http://localhost:8080/routing/** to try the working examples. The files are in [`src/pages/routing/`](../../src/pages/routing).

| What you need | Use |
| --- | --- |
| Always continue to one next page | An ordinary form `action`. |
| Ask where someone wants to go, without saving an answer | Navigation radios with `name: 'redirect'`. |
| Save an answer and branch from it | A normal answer name/value plus `data-next` on radio options. |
| Combine several answers or keep the whole journey in one place | The existing `journeys.yaml` rules. |

All destinations must be generated pages in this prototype. The build checks them and handles your GitHub repository path. Every style waits for **Continue**; selecting a radio does not immediately navigate.

## 1. Standard form actions

For a fixed next page, use an ordinary form. No YAML entry and no `data-journey` attribute are needed on that page.

```njk
{% from "govuk/components/input/macro.njk" import govukInput %}
{% from "govuk/components/button/macro.njk" import govukButton %}

<form action="{{ '/example/eligibility/' | url }}">
  {{ govukInput({
    id: 'full-name',
    name: 'full-name',
    label: {text: 'What is your name?', isPageHeading: true, classes: 'govuk-label--l'},
    attributes: {'data-required': 'Enter your name'}
  }) }}
  {{ govukButton({text: 'Continue'}) }}
</form>
```

The kit saves and restores named answers and adds a place for validation errors if one is missing. `data-required` still supplies your error message. Standard forms with local page actions are enhanced automatically; browser answers continue to use the storage option in site.yaml. Native HTML constraints such as `required` and `pattern` retain normal browser validation unless you author `novalidate`. Use `data-required` for the kit’s GOV.UK-style required-answer message; do not also add native `required` if you want that message rather than the browser’s validation prompt.

To use this on an existing YAML-controlled page, first remove **that page's `next` rule** from YAML (or remove that step if it is no longer needed). Otherwise the existing YAML remains the routing source. Keep other journey steps intact.

Continue to use the `url` filter for form actions. Browser-relative actions such as `../eligibility/` are also supported and resolved from the current page's URL, but explicit filtered paths are often easier to read and move between folders.

## 2. Navigation radios

Use this for a question such as “What do you want to do?” when the choice only selects a destination. It follows the authoring pattern of [x-govuk/prototype-navigation-radios](https://github.com/x-govuk/prototype-navigation-radios), implemented here in the static runtime; you do not install that plugin in this kit.

```njk
{% from "govuk/components/radios/macro.njk" import govukRadios %}
{% from "govuk/components/button/macro.njk" import govukButton %}

<form>
  {{ govukRadios({
    name: 'redirect',
    fieldset: {
      legend: {text: 'What do you want to do?', isPageHeading: true, classes: 'govuk-fieldset__legend--l'}
    },
    items: [
      {text: 'Start an application', value: '/example/start/'},
      {text: 'Try the routing examples', value: '/routing/'}
    ]
  }) }}
  {{ govukButton({text: 'Continue'}) }}
</form>
```

Use the exact reserved name `redirect`. Each option's `value` is a destination. The choice is **not saved as an answer** and is not restored from answer storage. Other named fields in the same form are still saved. Use the next approach if you need to show the selected answer later.

Write logical paths without the repository prefix in these values. The kit validates and prefixes them when navigating. You may also use already-prefixed paths produced by `| url`, but each resulting option value must be unique.

If nothing is selected, the kit shows **Select an option**, links to the radio group and focuses the error summary. To customise that message, add `attributes: {'data-required': 'Select what you want to do'}` to the first radio item.

## 3. Answer-preserving radio routes

Keep the answer as a meaningful value, and put its destination in `data-next`:

```njk
{% from "govuk/components/radios/macro.njk" import govukRadios %}
{% from "govuk/components/button/macro.njk" import govukButton %}

<form>
  {{ govukRadios({
    name: 'visit-approved',
    fieldset: {
      legend: {text: 'Can this visit go ahead?', isPageHeading: true, classes: 'govuk-fieldset__legend--l'}
    },
    items: [
      {text: 'Yes', value: 'yes', attributes: {'data-next': '/routing/yes/'} },
      {text: 'No', value: 'no', attributes: {'data-next': '/routing/no/'} }
    ]
  }) }}
  {{ govukButton({text: 'Continue'}) }}
</form>
```

This saves `yes` or `no` under `visit-approved`, so it works with answer bindings, scenario presets, reloads and Back navigation. Destinations are metadata, not part of the saved answer.

Every option needs a `data-next` destination, unless the form has an `action` to use as the fallback for options without one. For example, you can set `action="{{ '/routing/no/' | url }}"` and put `data-next` only on the Yes option. The question still requires a selection before continuing.

Only one radio group per form can control inline routing. You may include other questions, but use YAML when the next page depends on a combination of answers. `data-next` is supported on radio inputs, not checkboxes, selects or buttons.

## 4. Existing YAML routing

Keep `src/data/journeys.yaml` when it suits your journey. For example:

```yaml
      - path: /example/eligibility/
        next:
          - when:
              field: eligible
              equals: 'yes'
            path: /example/check-answers/
          - otherwise: /example/ineligible/
```

The starter's YAML forms and their `data-journey` attributes still work. A form with no action can explicitly use `data-journey` to opt into a YAML next rule. The existing branch operators are unchanged.

A YAML-controlled form may keep a form action as a fallback, but that action must match one of its YAML destinations. YAML decides the enhanced next page. The build rejects an action pointing somewhere unrelated.

## Avoid conflicting instructions

- Do not add inline radio routes to a page that already has a YAML `next` rule. Remove that page's rule first if you are switching approaches.
- Do not combine the reserved `redirect` name with `data-next` on the same group.
- Give routing options nonempty, unique values. Every target needs a real generated page.
- A page-level YAML rule cannot control several enhanced forms. Use separate per-form actions or inline routes if a page needs more than one form.
- Use one form action rather than button-level `formaction` overrides; enhanced forms reject those overrides so the route stays unambiguous.

The error includes the page route and form number so you can find what to fix. A route typo should fail the build rather than quietly send a participant to a 404.

## What stays the same

- You still author questions with official GOV.UK component macros.
- Answers still use the configured session/local storage and clear/reset actions.
- The sample check-your-answers return logic remains specific to its starter routes and `eligible` answer. These shortcuts do not automatically create a new summary or generalise change-answer behaviour.
- Stateful forms require JavaScript. Static content remains readable where practical; forms are not a backend submission service.
- Routing works in the ordinary site and encrypted export. Publishing encryption does not encrypt saved browser answers.

For a form that must be handled by your own script or use native submission, add `data-native` to the form. The kit will not attach its routing, validation, saving or restoration to that form. Unmarked external-action forms and unmarked forms without an action or routing radios are also left alone. Do not use native submissions to collect real participant data through this static prototype.
