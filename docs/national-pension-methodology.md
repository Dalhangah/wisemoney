# 국민연금 시나리오 계산기

Verified rules: 2026-11-08. Public entry: `app/national-pension-calculator.html`.

## Scope

This is a pre-retirement, pre-tax educational scenario, not an NPS benefit quotation. It uses explicit past calendar-year insured months and an externally supplied revalued past average standard monthly income. Past total premiums are recorded for reference and never used to infer income. The same combined career B applies to all historical coefficient terms.

Normal monthly amount before limits is the sum of each year's insured months multiplied by its annual coefficient expression, divided by 2,880, for total tenure of at least 120 months. This exactly combines the 10-to-20-year payment percentage and post-20-year duration factor without double-counting service.

- 1988–1998: 2.4 × (A + 0.75B).
- 1999–2007: 1.8 × (A + B).
- 2008–2025: [1.5 − 0.015 × (year − 2008)] × (A + B).
- From 2026: 1.29 × (A + B).

Future monthly income is fixed total premium divided by that calendar year's rate. Rate is 9.5% in 2026, rising by 0.5 percentage points annually until 13% in 2033. Employee half-share is supported only where the plan does not assume post-60 voluntary continued contributions. For post-60 plans, total-premium entry is required.

## Explicit simplifications

- Inputs share one monetary basis. Defaults are fixed 2026-value scenarios with future revaluation factor 1 and no inflation. Actual future A, revaluation, and income limits are unknown.
- Income limits are fixed at the July 2026–June 2027 limits of KRW 410,000–6,590,000; this is not a claim about future statutory limits.
- Month resolution, not exact dates. The displayed month is when the age is reached, not a guaranteed first payment date.
- Future contributions stop at 60 unless eligible voluntary continuation is explicitly assumed; all contributions also stop before the applicable pension commencement. Deferral uses the normal scenario's contribution record unchanged.
- Early pension requires the user's explicit income-eligibility assumption. Five-year early starts already in the past are not retrospectively calculated.
- If either the underlying normal amount or adjusted illustration exceeds career B, the cap could matter. Without the final-five-year revalued average income, monthly benefit, gaps, and reverse calculations are withheld. The final-five-year value is not silently assumed to equal B.
- Excludes credits, under-18 special cases, dependent supplement, earnings-related benefit reductions, tax, health insurance, partial deferral, and special historical eligibility cases.
- Target solving varies a fixed premium over the already specified valid future months. All modeled months must stay within the frozen income bounds. This is a mathematical scenario conditional on eligible income/insurance changes, not permission to freely purchase benefits or a calculation of 추납/반납.

## Sources

- [NPS benefit formula](https://nps.or.kr/pnsinfo/ntpsklg/getOHAF0048M0.do?menuId=MN24001117&tab=tab2)
- [NPS old-age pension rules](https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0056M0.do)
- [NPS 2026 expected pension table](https://www.nps.or.kr/comm/quick/getOHAH0011P0.do)
- [NPS contribution rates](https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0038M0.do)
- [NPS dated income limits](https://www.nps.or.kr/pnsgdnc/newgdnc/getOHAE0001M1.do?menuId=MN24000897&pstId=ZZ202600000000000147)
- [National Pension Act, Article 53](https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&lsId=001781)

## Verification

Run `node --test tests/national-pension.test.cjs` (Node's built-in test runner, no dependencies).

19 tests cover birthyear boundaries, contribution rates, historical coefficients, 119/120/239/240/241-month tenure boundaries, common career B, unchanged benefit when past total premiums vary, employee half-share equivalence, early/normal/continued-enrollment cutoffs, missing and contradictory inputs, fixed-premium bounds, target round-trip solving, unattainable targets, and cap guards.

The 620-row reference fixture contains only the standard publicly stated income/premium/pension table, no personal records. Seven tenure columns yield 4,340 comparisons. The constant-income fixture uses its stated 2026-first-entrant assumption and the constant-income cap. All results match the reference after 10-won truncation (maximum unrounded difference 9.96625 won). This fixture does not validate an individual's forecast.

Browser QA covered home toolbox linking, disabled legacy tool preservation, demo, repeated calculation, missing-B error, stale-result removal, reset, and desktop / 390px / 320px layouts. Mobile checks used actual 390px and 320px iframe viewports; result tables scroll internally without body overflow. No real-device Safari test was performed.

No user inputs are persisted or transmitted. The new calculator has no analytics, storage, backend, or external script dependencies. The existing pension-switching calculator remains disabled and unchanged.
