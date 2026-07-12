A web application that helps both **full-time employees** and **freelancers** understand where they stand against the market using **live salary/rate research** and an **anonymous community dataset**.

---

# Problem

People rarely know if they're being paid fairly.

- Employees don't know whether they're underpaid compared to others with similar experience.
- Freelancers often quote rates based on guesswork instead of market data.
- Existing salary websites are often outdated, lack transparency, or don't explain how they arrive at their numbers.

The goal is to provide a **credible, data-backed answer** in under 30 seconds.

---

# Core Value Proposition

Enter your:

- Role
- City
- Experience
- Salary (Full-time) or Hourly Rate (Freelance)

Receive:

- Your percentile
- Market salary/rate band
- AI-recommended negotiation number
- Confidence score
- Sources used for calculation
- Shareable result card

---

# Two Modes

## 1. Full-time Employee

### Inputs

- Role
- City
- Years of experience
- Current CTC (Annual Salary)
- Optional: Company size

### Output

Example:

> You earn more than **35%** of Product Designers in Bangalore.

Market Salary Band:

₹18–22 LPA

Suggested Target Salary:

₹21 LPA

Includes:

- Salary percentile
- Suggested salary to negotiate
- Confidence score
- Sources

Potential data sources:

- Glassdoor
- AmbitionBox
- LinkedIn Jobs
- Levels.fyi (where applicable)

---

## 2. Freelancer / Contractor

### Inputs

- Role
- City
- Years of experience
- Hourly (or project) rate

### Output

Example:

> You charge less than **78%** of React freelancers in Bangalore.

Fair Market Rate:

₹1700–₹2000/hr

Suggested Quote:

₹1850/hr

Includes:

- Percentile
- Recommended rate
- Confidence score
- Sources

Potential sources:

- Upwork
- Toptal
- Arc.dev
- Fiverr
- Freelancer
- Other freelance marketplaces

---

# Tech Stack

## Frontend

- React
- Vite
- Tailwind CSS
- Cloudflare Pages

---

## Backend

Hermes Agent

Responsibilities:

- Research live market data
- Blend external + community data
- Calculate percentile
- Generate recommendation
- Generate shareable card

---

## Data Sources

### Live Research

Use Linkup to research:

- Salary reports
- Job boards
- Freelance platforms
- Market averages

Store:

- Source
- Median
- Min
- Max
- Date
- Confidence

---

### Anonymous Community Pool

Use Convex.

Every user submission is stored anonymously.

Example schema:

```ts
Submission {
  employmentType
  role
  city
  experience
  salaryOrRate
  createdAt
}
```

No personally identifiable information is required.

As the dataset grows, percentile accuracy improves.

---

# Percentile Engine

Merge two datasets:

1. External market research
2. Anonymous community submissions

Initially:

- 70% External
- 30% Community

As community grows:

- Gradually increase community weighting.

Calculate:

- Percentile
- Median
- Fair range
- Suggested negotiation number

---

# Hermes AI Prompt

Given:

- Employment Type
- Role
- City
- Experience
- Salary/Rate
- Market distribution

Return:

- Percentile
- Fair salary/rate band
- Suggested negotiation number
- Confidence score
- Explanation

Example:

```text
Fair Band

₹1700–₹2000/hr

Suggested Quote

₹1850/hr

Confidence

82%

Reason

Most comparable freelancers charge between ₹1700–₹2000/hr.
```

---

# Memory

If the user returns later:

Old:

₹1200/hr

New:

₹1800/hr

Show:

Previous percentile

↓

Current percentile

Example:

22nd percentile

↓

64th percentile

Users can track salary growth over time.

---

# Shareable Result Card

Example

```
AM I UNDERPAID?

Product Designer

Bangalore

4.5 Years

Current Salary

₹15 LPA

You earn more than

35%

of comparable professionals.

Market Range

₹18–22 LPA

Suggested Target

₹21 LPA

Confidence

82%

Sources

Glassdoor
AmbitionBox
LinkedIn Jobs

Community Pool

2,341 submissions

Check Yours

amIunderpaid.app
```

The card should be downloadable and easily shareable.

---

# Weekly Report (Cron)

Every week generate reports like:

- Product Designers in Bangalore
- React Developers in Hyderabad
- UI Designers in Delhi
- Data Analysts in Mumbai

Publish automatically.

Benefits:

- SEO
- Repeat traffic
- Community engagement

---

# Analytics Dashboard

Track:

- Total checks
- Pool size
- Cities
- Roles
- Median salary
- Median freelance rate
- Weekly growth
- Most searched roles

Display a live community counter.

Example:

> 2,341 salary checks completed

---

# User Flow

Landing Page

↓

Choose:

- Full-time
- Freelancer

↓

Fill 30-second form

↓

Hermes researches live market data

↓

Convex stores anonymous submission

↓

AI calculates percentile

↓

Result card generated

↓

User shares card

↓

More users join

↓

Community dataset becomes stronger

---

# Demo Flow

1. Open application.
2. Select Full-time or Freelancer.
3. Enter role, city, experience, and salary/rate.
4. Hermes performs live research.
5. Convex stores anonymous submission.
6. AI calculates percentile.
7. Result card is generated with cited sources.
8. Refresh analytics dashboard to show the community pool increasing.

---

# Success Metrics

- 50+ salary/rate checks
- 10+ cards shared
- Growing anonymous dataset
- Weekly report published
- High confidence scores backed by transparent sources

---

# Why This Can Win

- Solves a real problem for both employees and freelancers.
- Demonstrates live research instead of static salary tables.
- Uses an improving community dataset.
- Produces highly shareable results.
- Clear viral loop: every shared card drives more submissions, improving the dataset and increasing product value over time.