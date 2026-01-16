# Content Guidelines

This document provides guidelines for writing text in Forma extensions.

---

## Tone of Voice

### Brand Principles

Our voice is: **confident, optimistic, accessible, curious, and human**.

### Voice Continuum

Find the sweet spot in the center - avoid extremes.

| Too Little | Just Right | Too Much |
|------------|------------|----------|
| Indecisive | **CONFIDENT** | Arrogant |
| Passive | **OPTIMISTIC** | Unrealistic |
| Academic | **ACCESSIBLE** | Simplistic |
| Detached | **CURIOUS** | Nosy |
| Impersonal | **HUMAN** | Glib |

### Message Types

Depending on context, messages should be:

- **Informative** - Clearly explain what's happening
- **Educational** - Help users learn
- **Supportive** - Especially when something went wrong
- **Motivational** - Encourage next steps

---

## Writing Basics

### US English Spelling

Use American English spelling throughout:

| Correct | Incorrect |
|---------|-----------|
| Color | Colour |
| Center | Centre |
| Optimize | Optimise |
| Analyze | Analyse |

### Active Voice

In active voice, the sentence's subject performs the action.

| Correct (Active) | Incorrect (Passive) |
|------------------|---------------------|
| Administrators can invite more members. | More members can be invited by administrators. |
| Click Generate to create a floorplate. | A floorplate can be created by clicking Generate. |
| Select a building to analyze. | A building should be selected for analysis. |

### Capitalization

**Use sentence case** as the default in product UI. Only the first word is capitalized.

| Correct | Incorrect |
|---------|-----------|
| Invite project member | Invite Project Member |
| Generate floorplate | Generate Floorplate |
| Unit configuration | Unit Configuration |
| Learn more | Learn More |

**Exceptions (use Title Case):**
- Spelling out acronyms
- Branded names
- Extension names
- API names

---

## Content Patterns

### Button Labels

Use action verbs that describe what will happen:

| Good | Avoid |
|------|-------|
| Generate | OK |
| Save | Submit |
| Cancel | Close |
| Export | Done |

### Error Messages

Be supportive and helpful:

| Good | Avoid |
|------|-------|
| Select a building to generate the floorplate. | Error: No building selected. |
| The building is too small for this configuration. | Invalid input. |
| Try adjusting the unit sizes to fit. | Operation failed. |

### Loading States

Be informative about what's happening:

| Good | Avoid |
|------|-------|
| Generating floorplate... | Please wait... |
| Saving to project... | Loading... |
| Analyzing building... | Processing... |

### Empty States

Guide users on what to do:

| Good | Avoid |
|------|-------|
| Select a building to start generating floorplates. | No data. |
| No saved floorplates yet. Generate one to get started. | Empty. |

---

## Do's and Don'ts

### Do

- Keep text concise and scannable
- Use clear, simple language
- Write in active voice
- Use sentence case
- Be helpful in error messages
- Guide users to next actions

### Don't

| Don't | Why |
|-------|-----|
| Use ALL CAPS | Feels like shouting |
| Use emojis | Not appropriate for professional UI |
| Use jargon | Not accessible to all users |
| Use passive voice | Less clear and direct |
| Use Title Case (except exceptions) | Not consistent with standards |
| Use vague messages | Not helpful to users |

---

## Labels and Placeholders

### Input Labels

| Good | Avoid |
|------|-------|
| Corridor width | Enter Corridor Width |
| Number of stories | Stories (number) |
| Unit area | Area (sq m) |

### Placeholder Text

| Good | Avoid |
|------|-------|
| Enter value | Type here... |
| Select option | Choose one |
| 0.00 | Value |

### Unit Suffixes

Always show units with numeric inputs:

```
[  1.83  ] m
[  54.8  ] m²
[   20   ] %
```

---

## Specific Terminology

### This Extension

| Term | Usage |
|------|-------|
| Floorplate | The generated floor layout |
| Unit | A residential unit (studio, 1BR, etc.) |
| Core | Building core (stairs, elevators) |
| Corridor | Central hallway |
| GSF | Gross Square Feet |
| NRSF | Net Rentable Square Feet |
| Efficiency | NRSF / GSF ratio |

### Forma Terminology

| Term | Usage |
|------|-------|
| Extension | A plugin/add-on for Forma |
| Canvas | The 3D view area |
| Panel | UI container on left or right |
| Element | Any object in the project |
| Path | Reference to an element |

---

## Accessibility

### Screen Readers

- Use descriptive button labels
- Provide alt text for icons
- Use semantic HTML structure

### Clarity

- Avoid color-only indicators
- Provide text alternatives
- Use clear visual hierarchy

---

## Source

Extracted from:
- `Text Guidelines/Tone of voice.pdf`
- `Text Guidelines/Basics.pdf`
- `Text Guidelines/Grammar and mechanics.pdf`
- `Text Guidelines/Content patterns.pdf`
