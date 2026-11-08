# 국민연금 간편 시나리오 계산기 v0.2

Public entry: `app/national-pension-calculator.html`. This document describes the implemented v0.2 model, not an official NPS quotation. The previous methodology is preserved in `docs/national-pension-methodology-vr01.md`; the previous page is `app/national-pension-calculator VR.0.1.html`.

## Purpose and input basis

The main inputs are birth month, aggregate past insured months and paid premiums, future contribution months and fixed monthly premium, A, and minimum/maximum monthly living-cost targets. **All premiums are total insurance premiums including the employer share.** Employee-only amounts are not automatically doubled. The UI fixes the baseline at November 2026: past history ends in October, future contributions start in November. The engine accepts July–December 2026 for its supported 2026 rules, but the UI does not expose a baseline selector.

The optional yearly history consists of year, insured months, and total premiums for that year. These are **subsets of the aggregate past totals, never additional contributions**. Optional post-60 continuation defaults to false; early-income eligibility defaults to unknown. No externally supplied past B is required.

A defaults to KRW 3,193,511, the published basis for benefit-trigger dates December 2025–November 2026. It represents the applicable average across all insured people, not the individual's income. Future A remains unknown; the entered A is held fixed.

## Conserving totals and reconstructing missing history

1. Validate aggregate months and premium totals. A zero history requires both totals to be zero; positive months require positive premiums.
2. Validate explicit annual entries: complete positive months and premiums, unique years, and months within the modeled calendar capacity. Annual capacity is bounded by January 1988, age 18, age 65, and the baseline month. Under-18 special cases and credits are unsupported.
3. Subtract explicit months **and** explicit premiums from their respective aggregate totals. Neither remainder may be negative. If no months remain, no premiums may remain; if months remain, a positive premium remainder is required.
4. Reserve the explicit months in each year's capacity. Allocate remaining months from the newest eligible year backwards, using only capacity left after explicit entries. Reject totals exceeding available capacity.
5. Divide remaining premiums equally per unspecified month and allocate them in proportion to those estimated months. Explicit annual premium totals are retained unchanged.

This is an **artificial latest-backwards allocation**, not recovery of the person's actual work record. It assumes a consecutive recent history for unknown periods, subject to explicit annual reservations and age/calendar limits. Actual gaps, employment type and income changes may produce very different results. Annual entries do not identify exact months within a year. The UI immediately shows explicit sums and the remaining aggregate months/premiums, and flags excess detail. Blank added rows must be completed or deleted.

For example, the clearly labeled fictional demo has 130 total past months and KRW 35,250,000 total past premiums. Its explicit 2026 row is 10 months and KRW 2,850,000. The unknown remainder is exactly 120 months and KRW 32,400,000; it is not added a second time.

## Historical premium-to-income proxy

For each historical year, total premiums divided by the assumed total premium rate produce an income-month sum. These rates assume **workplace insurance**:

- 1988–1992: 3%.
- 1993–1997: 6%.
- 1998–2025: 9%.
- 2026: 9.5%.

Regional insurance had a different rate path before July 2005. The engine conservatively sets `earlyRateCaution` for any allocated year up to and including 2005; annual data alone cannot determine which part of 2005 is represented. The workplace assumption can materially distort reconstructed income for regional or other differing histories. Past income is not clamped to the current 2026 income bounds.

**The reconstructed historical income is nominal, unrevalued, and only a proxy. It is not statutory revalued B and is not expressed in 2026 purchasing power.** The model does not repair that limitation by silently assuming a revaluation factor or claiming all historical money has a common purchasing-power basis. Future income and the entered A/targets are held fixed numerically. Living-cost gaps are therefore illustrative amount comparisons, not purchasing-power or future affordability forecasts.

## Formula and shared career proxy

Let the combined career proxy B equal the historical reconstructed income-month sum plus the modeled future income-month sum, divided by total insured months. The same common career proxy is used in every year's coefficient expression; past and future do not receive separate B values.

For total tenure of at least 120 months, sum each year's insured months multiplied by its coefficient expression and divide by 2,880 to obtain the normal monthly formula amount before omitted adjustments:

- 1988–1998: 2.4 × (A + 0.75B).
- 1999–2007: 1.8 × (A + B).
- 2008–2025: [1.5 − 0.015 × (year − 2008)] × (A + B).
- From 2026: 1.29 × (A + B).

The 2,880 denominator combines the annual-to-monthly conversion and the 10–20-year payment percentage / post-20-year duration factor without counting tenure twice. Historical premium-rate periods differ from pension-formula coefficient periods and must not be conflated.

## Future rate and income bounds: deliberately frozen

The active engine fixes the future total insurance rate at **9.5% for every modeled future month**. Future monthly income is the entered fixed total premium divided by 0.095. The model fixes standard monthly income bounds at KRW 410,000–6,590,000, the July 2026–June 2027 limits. Consequently, where future contributions are present, the modeled fixed total monthly premium range is KRW 38,950–626,050. Actual future income bounds are unknown.

Actual enacted rates rise to 10% in 2027, 10.5% in 2028, 11% in 2029, 11.5% in 2030, 12% in 2031, 12.5% in 2032, and 13% from 2033. **This schedule is not active in v0.2.** It appears only as a commented future-update roadmap in the engine. Any future activation must coordinate visible assumptions, income bounds, supported input dates and tests; the comment does not change current outputs.

## Timing, eligibility and scenario comparisons

- This is a pre-retirement model for people at least 18 and below their normal pension age. Already-normal-age cases require individualized NPS inquiry.
- Normal pension age is 60 for birth years through 1952; 61 for 1953–1956; 62 for 1957–1960; 63 for 1961–1964; 64 for 1965–1968; and 65 for 1969 onwards.
- Contributions start at the baseline and stop before the earliest of the requested period's end, the applicable age limit (60 by default, at most 65 with explicit continued-enrollment assumption), and pension commencement.
- Five-year early commencement cuts off contributions before that early commencement. It uses 70% of its own shorter-history formula amount. Income eligibility must explicitly be assumed satisfied; unknown or no suppresses the early result. Early dates already in the past are not calculated retrospectively.
- Five-year full deferral uses **exactly the normal scenario's contribution history**, with a 136% multiplier. It does not add five years of payments. Partial deferral is excluded.
- Under 120 total insured months, benefits and target solutions are withheld; raising premium alone does not establish tenure eligibility.
- Timing uses months, not exact dates. The stated month is the age-attainment month, not a guaranteed first payment date. Monthly amounts do not establish which claiming choice maximizes lifetime benefits.

## Legal cap and other omitted adjustments

All displayed formula amounts, gaps and reverse solutions are **before statutory income revaluation and the actual legal pension cap**, as well as tax, health-insurance charges, earnings-related pension reductions, credits, dependents' supplement, and special eligibility cases.

The actual Article 53 cap needs additional data, including the relevant revalued income records. v0.2 does not pretend the nominal proxy B establishes that cap. A heuristic `capCaution` is raised when the larger of the unadjusted formula amount and scenario-adjusted amount exceeds proxy B. It is only a prompt to check the real cap, not a legal cap test. A false flag does not prove no cap applies. Unlike v0.1, this flag does not block outputs or reverse solutions; all remain explicitly uncapped illustrations.

## Conditional reverse calculation

The section is titled “이 단순모형에서 필요한 추가 납입 추정”. It holds the valid future contribution months unchanged and solves for a higher constant **total** monthly premium within the frozen income bounds. The engine uses a bounded numerical search. No user data is sent elsewhere to obtain a solution.

- `met`: the current uncapped model amount already meets the target; modeled extra premium is zero.
- `possible`: a premium within the model ceiling reaches the target; show required total monthly premium, incremental monthly premium, and total incremental premiums over the same future months.
- `unreachable`: even the model ceiling misses the target; show “이 모형의 상한 내 목표 미달”, ceiling premium, maximum model amount and remaining gap.
- `no-months`: there are no valid future months over which to increase premiums; show the remaining modeled gap.

These statuses are conditional mathematical results, **not real-world promises of eligibility, attainability or permission to buy pension benefits freely**. Actual insurable income and enrollment conditions must support changes. This is not a calculation of permitted 추납, 반납 or arrears payments. Even a model target match may not survive legal-cap, revaluation and net-payment adjustments.

## Sources

The implementation's source set includes the following public NPS/law pages. A source link documents the legal reference; it does not validate an individual's modeled history or forecast.

- [NPS benefit formula](https://nps.or.kr/pnsinfo/ntpsklg/getOHAF0048M0.do?menuId=MN24001117&tab=tab2)
- [NPS old-age, early and deferred pension rules](https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0056M0.do)
- [NPS A and expected pension table](https://www.nps.or.kr/comm/quick/getOHAH0011P0.do)
- [NPS contribution-rate history](https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0103M0.do)
- [NPS contribution rates](https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0038M0.do)
- [NPS 2026 income limits](https://www.nps.or.kr/pnsgdnc/newgdnc/getOHAE0001M1.do?menuId=MN24000897&pstId=ZZ202600000000000147)
- [National Pension Act, including Article 53](https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&lsId=001781)

## Verification and privacy

Calculation inputs remain in the browser and are not stored or transmitted by the calculator. The calculation logic uses no storage, backend or analytics. Published examples are fictional, not personal records.

## Completed verification (v0.2)

`node --test tests/national-pension.test.cjs tests/national-pension.test-vr01.cjs` passes all 43 tests: 24 current-model tests and 19 archived-model regression tests. Current tests include 200 randomized subset-conservation cases, annual capacity and duplicate/overage guards, fixed future rates, historical coefficients, conditional solver round-trips, and 4,340 reference cells under the fixture’s own constant-income/cap assumptions. These comparisons validate formula regression, not the simplified personal forecast.

Independent read-only review found no financial implementation blocker for the prominently disclosed simplified model. A plausibility warning was added when an inferred annual monthly income exceeds even the 2026 income ceiling; historical income is not silently clamped. The 2005 caution is conditional because annual records do not identify the half-year.

Browser QA passed aggregate-only entry, demo, optional eligibility, annual months and amount overages, duplicate years, stale-result removal, reset, archived navigation and archived demo. Desktop and actual 390px/320px iframe viewports were inspected; body content does not overflow, and the comparison table scrolls internally. These were browser viewport checks, not a real-device Safari test.
