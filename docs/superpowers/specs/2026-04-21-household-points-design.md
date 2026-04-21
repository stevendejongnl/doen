# Household Points System Design

**Goal:** Add a household point ledger to Doen so chores can earn points, be outsourced, and be traded with optional non-point rewards.

## Summary

This feature turns household tasks into a small internal economy. Each person in a household has a visible point balance, every task carries a point value based on priority, and people can offer tasks to others instead of doing them themselves.

The system stays simple on purpose: balances are public to the household, debt is just a negative balance, offers stay open until accepted or withdrawn, and the original owner must confirm a transfer before it becomes final.

## Goals

- Track points per household member.
- Assign task values from priority using a fixed scale: 1 / 2 / 3 / 5 points.
- Let people outsource a task by creating a household offer.
- Support optional non-point rewards like beer or pizza as part of an offer.
- Allow negative balances so debt can be carried and repaid later.
- Show balances and offers to all household members.

## Non-goals

- No auctions, bidding wars, or automatic expiration.
- No separate debt tokens or IOU objects.
- No private balances by default.
- No hidden or one-sided task transfers.

## Core rules

### 1. Points

- Every task has a point value.
- Priority determines the value:
  - low = 2 points
  - medium = 3 points
  - high = 5 points
  - none/default = 1 point
- Completing a task credits those points to the person who did the work.

### 2. Balances

- Every household member has a visible running balance.
- Balances can go below zero.
- A negative balance represents debt that must be repaid by earning points later.

### 3. Offers

- A task can be posted as an offer to the household.
- An offer includes:
  - the task
  - the point value
  - an optional reward note, such as "pizza" or "beer"
- Offers move through these states: `open -> requested -> approved/rejected`.
- Rejected offers can either be reopened or closed by the owner.

### 4. Acceptance and confirmation

- Any household member can accept an open offer.
- The first acceptance locks the offer to that person.
- The original owner gets a notification and must approve or reject the acceptance.
- If approved, the task and its point value transfer to the accepted person.
- If rejected, the owner chooses whether the offer returns to open or closes.

### 5. Visibility

- Balances are visible to the whole household.
- Open offers are visible to the whole household.
- Reward notes are visible on the offer so the trade terms are explicit.

## User flow

1. A user creates a task with a priority.
2. The system assigns the task its point value.
3. The user either keeps the task or offers it to the household.
4. Another household member accepts the offer.
5. The original owner approves or rejects the acceptance.
6. If approved, the accepting member gets the task and the points/debt shift in the ledger.

## Data model

The implementation should extend the existing household/project structure rather than inventing a parallel app.

Suggested entities:

- **Point balance**: one row per person per household context, or a ledger derived from transactions.
- **Point transaction**: a record for every earn, spend, transfer, or debt adjustment.
- **Task offer**: links a task to an offer state, optional reward note, and the accepted user.

The exact schema can be chosen during implementation, but it must support:

- current balance lookup
- transaction history
- offer status tracking
- accepted-by and approved-by tracking

## UI expectations

- Show household balances in the household view.
- Show task point value wherever tasks are listed or edited.
- Add an "offer task" action on task detail or task row views.
- Show open offers in a shared household feed or notifications area.
- Show an approval action to the task owner when someone accepts an offer.

## Notifications

- Notify the household when a new offer is posted.
- Notify the original owner when someone accepts an offer.
- Notify the accepting member when the owner approves or rejects the offer.

## Acceptance criteria

- A task priority maps to a fixed point value.
- Completing a task updates the doer's balance.
- A household member can post a task as an offer with an optional reward note.
- A household member can accept an offer, but the owner must confirm it before transfer.
- Balances are visible to the household and can go negative.
- Offers remain open until accepted, withdrawn, approved, rejected, or explicitly closed after rejection.
