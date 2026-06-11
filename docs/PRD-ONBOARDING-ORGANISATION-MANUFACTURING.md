# PRODUCT REQUIREMENTS DOCUMENT
## Onboarding Flow: Organisation Setup, Manufacturing Gate, and First-Run Product Tour

**Version:** 1.0  
**Date:** 2026-06-11  
**Status:** Draft  
**Owner:** Product / UX / Platform

---

## 1. Purpose

Refine the first-login and sign-up onboarding flow so a new user:

1. Feels welcomed immediately.
2. Creates or requests access to an organisation with minimal friction.
3. Chooses their organisation type(s) from a clear list.
4. Makes one irreversible platform decision for manufacturing.
5. Sees a confident product handoff message.
6. Receives a short guided animation tour of the core UI surfaces.

This onboarding must feel like a platform setup experience, not a generic form.

---

## 2. Current State

The app already has a basic access-request / organisation creation screen in `src/pages/RequestAccess.tsx`. It allows:

- Requesting access to an existing organisation.
- Creating a new organisation.
- Refreshing memberships after approval.

The current experience is functional, but it does not yet:

- Guide the user through a polished first-run journey.
- Explain organisational operating type(s) clearly.
- Treat manufacturing as a one-time platform decision.
- Provide a strong “welcome / confidence” moment.
- Introduce the app through a short animated tour.

---

## 3. Product Goal

Turn onboarding into a three-stage product experience:

1. Setup the organisation.
2. Lock in the organisation’s operating model.
3. Welcome the user into the platform and show the key entry points.

The experience should reduce confusion, especially around manufacturing availability, while making the product feel intentional and premium.

---

## 4. Core Principle

**Manufacturing is not just another tag. It is a platform capability.**

If manufacturing is not enabled at organisation setup:

- Manufacturing routes should remain unavailable.
- Manufacturing data entry should stay hidden.
- Manufacturing-specific assumptions such as raw material / finished good flags should not appear in the normal onboarding flow.

This decision must be clearly communicated as irreversible.

---

## 5. User Flow

### Stage 1: Welcome

When a user signs up or logs in for the first time and has no organisation access:

- Show a welcoming intro screen.
- Explain that they are about to set up their workspace.
- Offer two paths:
  - Join an existing organisation.
  - Create a new organisation.

### Stage 2: Organisation Setup

If the user creates a new organisation:

- Ask for organisation name and basic profile data.
- Ask for organisation type(s) using multi-select chips or toggles.
- Allow selecting multiple general business types:
  - Wholesaler
  - Trader
  - Project
  - Sales
  - Service

### Stage 3: Manufacturing Decision

Show manufacturing as a separate section below the general organisation types.

- Default: `NO`
- Copy must state that this cannot be changed later.
- The user must understand that manufacturing availability is controlled by this decision.
- If `NO`, manufacturing modules stay hidden.
- If `YES`, manufacturing modules are enabled for the organisation.

### Stage 4: Organisation Details

After capability selection:

- Collect the remaining organisation details.
- Save the organisation.
- Save the selected operating model.

### Stage 5: Confidence Handoff

After organisation creation completes:

- Show the message: **Welcome to ONE. The super ONE**
- The tone should be confident and reassuring.
- This screen is a handoff, not a tutorial.

### Stage 6: Animated Product Tour

Show three short onboarding animations:

1. Quick Access Toolbar
2. Side Menu
3. Settings / Module Settings

These should be short, visually clear, and skippable after first completion.

---

## 6. Information Architecture

### 6.1 Organisation Types

Allow multi-select for:

- Wholesaler
- Trader
- Project
- Sales
- Service

These should behave like flexible labels for the organisation.

### 6.2 Manufacturing

Manufacturing must be shown separately from the general organisation types because it changes the available product surface.

Rules:

- Default value: `NO`
- Copy: “Manufacturing cannot be changed later.”
- If enabled, manufacturing features become available.
- If disabled, hide manufacturing-specific app routes and data entry affordances.

### 6.3 Manufacturing-Dependent UI

If the organisation has manufacturing disabled:

- Hide manufacturing sidebar group.
- Hide manufacturing dashboard routes.
- Hide BOM, Job Card, Production Schedule, Production Entry, Custom Units, Custom Fields, and Activity Log access.
- Hide manufacturing-specific item flags where they are only relevant to manufacturing workflows.

---

## 7. UX Requirements

### 7.1 Welcome Screen

The first screen should:

- Use a friendly, confident headline.
- Explain the next step in one short paragraph.
- Minimize cognitive load.

### 7.2 Organisation Type Selection

The organisation type selector should:

- Allow multiple selections.
- Show selected items clearly.
- Stay compact and easy to scan.

### 7.3 Manufacturing Decision

This section should:

- Look visually separated from general organisation types.
- Use a locked, high-attention explanation.
- Show the default state as `NO`.
- Warn the user that it cannot be changed later.

### 7.4 Completion State

After save:

- Show a strong completion message.
- Reinforce the product identity with: **Welcome to ONE. The super ONE**
- Transition into the product tour smoothly.

### 7.5 First-Run Product Tour

The three onboarding animations should:

- Be short.
- Focus on the most useful navigation surfaces.
- Feel like guided motion, not decoration.
- Use motion to reveal where the user starts working.

---

## 8. Animation Direction

Use the existing app’s design language, but make the motion feel deliberate and polished.

### 8.1 Quick Access Toolbar

Animation should explain:

- New quote
- New DC
- Help
- Logout

Motion idea:

- Toolbar slides in.
- Primary actions pulse once.
- Focus moves across the buttons left to right.

### 8.2 Side Menu

Animation should explain:

- Navigation hierarchy
- Main sections
- Manufacturing visibility when enabled

Motion idea:

- Sidebar expands from collapsed to open.
- Key sections highlight in sequence.
- Manufacturing appears only if enabled for the organisation.

### 8.3 Settings / Module Settings

Animation should explain:

- Where module settings live.
- How the organisation’s product surface can be controlled.
- Which module features are available.

Motion idea:

- Settings panel opens.
- Module cards fade in.
- One card is spotlighted to show module control.

---

## 9. Manufacturing Rules

### 9.1 Irreversibility

The manufacturing decision is a one-time setup choice.

The UI must state this clearly before confirmation.

### 9.2 Feature Gating

If manufacturing is disabled:

- The app must not surface manufacturing routes.
- The app must not invite users into manufacturing workflows.
- The app must not show manufacturing-specific setup prompts.

### 9.3 Simplified Item Master

Because manufacturing is gated at organisation setup:

- The “raw material” and “is manufactured” mental model should only appear where relevant.
- If manufacturing is disabled, avoid forcing users through manufacturing-specific item semantics.

### 9.4 Data Model Note

The onboarding flow should persist:

- Organisation type selections
- Manufacturing enabled flag
- First-run completion state

---

## 10. Screens

### Screen 1: First Login / Sign-Up Welcome

Goal:

- Set the tone.
- Direct the user into organisation setup.

### Screen 2: Organisation Setup

Goal:

- Capture organisation name and type(s).
- Capture manufacturing decision.

### Screen 3: Confirmation / Welcome

Goal:

- Confirm setup.
- Build confidence.
- Transition to product tour.

### Screen 4: Quick Access Tour

Goal:

- Show top toolbar actions.

### Screen 5: Side Menu Tour

Goal:

- Show navigation structure.

### Screen 6: Settings / Module Settings Tour

Goal:

- Show where product configuration lives.

---

## 11. Acceptance Criteria

The onboarding is complete when:

1. A new user can create an organisation with multiple organisation types.
2. Manufacturing is presented as a separate, irreversible `NO` / `YES` decision.
3. `NO` is the default for manufacturing.
4. The UI clearly warns that manufacturing cannot be changed later.
5. Users see a completion screen that says: `Welcome to ONE. The super ONE`.
6. The app shows 3 onboarding animations after setup.
7. If manufacturing is disabled, manufacturing routes and workflows stay hidden.
8. The flow feels polished and intentional, not like a basic form.

---

## 12. Open Questions

1. Should organisation creation always happen before access requests, or should the user choose one path first?
2. Should the manufacturing decision be a hard lock in the database or only a UI lock with admin override?
3. Should the product tour be shown only once per organisation, or once per user?
4. Should the animations be skippable immediately, or after the first slide finishes?
5. Should manufacturing-disabled organisations still see a read-only teaser of the manufacturing module, or no trace at all?

---

## 13. Implementation Notes

- Reuse the existing onboarding entry points in `src/pages/RequestAccess.tsx`.
- Keep the organisation setup lightweight.
- Make the manufacturing gate explicit and irreversible in copy.
- Use motion as explanation, not decoration.
- Keep the end state consistent with the rest of the product shell:
  - quick access toolbar
  - sidebar
  - settings / module settings

---

## 14. Summary

This onboarding should feel like the user is stepping into a serious system:

- clear setup
- clear capability choice
- clear confidence
- clear product introduction

The manufacturing choice needs special handling because it changes the product surface. The rest of the onboarding should reduce friction and make the platform feel trustworthy, premium, and easy to adopt.
