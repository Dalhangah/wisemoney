(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NationalPension = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const RULES = Object.freeze({ checked: '2026-11-08', A: 3193511, lower: 410000, upper: 6590000 });
  const ym = (year, month) => year * 12 + month - 1;
  const parseMonth = value => { const m = /^(\d{4})-(\d{2})$/.exec(value || ''); if (!m || +m[2] < 1 || +m[2] > 12) throw Error('연월을 올바르게 입력해 주세요.'); return ym(+m[1], +m[2]); };
  const monthText = n => `${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, '0')}`;
  const normalAge = y => y <= 1952 ? 60 : y <= 1956 ? 61 : y <= 1960 ? 62 : y <= 1964 ? 63 : y <= 1968 ? 64 : 65;
  const rate = y => Math.min(0.13, 0.095 + Math.max(0, y - 2026) * 0.005);
  const coeff = y => y <= 1998 ? [2.4, 1.8] : y <= 2007 ? [1.8, 1.8] : y <= 2025 ? [1.5 - 0.015 * (y - 2008), 1.5 - 0.015 * (y - 2008)] : [1.29, 1.29];
  function finite(n, name, min, max, integer = false) { if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw Error(`${name} 입력을 확인해 주세요.`); }
  function validate(input) {
    const now = parseMonth(input.asOf), birth = parseMonth(input.birth), birthYear = Math.floor(birth / 12);
    if (now < ym(2026, 7)) throw Error('이 버전은 2026년 7월 이후 계획용입니다. 과거 시점 계산은 지원하지 않습니다.');
    if (birth >= now || now - birth < 18 * 12) throw Error('만 18세 이상 계획만 지원합니다.');
    const age = normalAge(birthYear), normal = birth + age * 12;
    if (now >= normal) throw Error('이미 정상 수급연령에 도달한 경우는 공단의 개별 조회가 필요합니다. 이 도구는 수급 전 계획용입니다.');
    finite(input.A, 'A값', 1, 100000000);
    finite(input.pastPaid, '기납부 총액', 0, 10000000000);
    finite(input.pastMonths, '기납부 개월', 0, 600, true);
    finite(input.futureMonths, '앞으로 납부할 개월', 0, 600, true);
    finite(input.premium, '월 보험료', 0, 10000000);
    finite(input.targetMin, '최소 생활비', 0, 100000000);
    finite(input.targetMax, '최대 생활비', input.targetMin, 100000000);
    if (!['total', 'employee'].includes(input.premiumBasis)) throw Error('보험료 기준을 선택해 주세요.');
    if (!['yes', 'no', 'unknown'].includes(input.earlyEligible)) throw Error('조기연금 소득요건을 선택해 주세요.');
    if (!Array.isArray(input.history)) throw Error('연도별 가입개월을 입력해 주세요.');
    let pastMonths = 0, aWeight = 0, bWeight = 0;
    const years = new Set();
    input.history.forEach(row => {
      finite(row.year, '가입연도', 1988, Math.floor(now / 12), true);
      finite(row.months, '연도별 개월', 1, 12, true);
      if (years.has(row.year)) throw Error(`${row.year}년이 중복되었습니다.`);
      years.add(row.year);
      // This planner deliberately supports ordinary age-18+ records only.
      const eligibleStart = Math.max(ym(row.year, 1), birth + 18 * 12);
      const eligibleEnd = Math.min(ym(row.year + 1, 1), now, birth + 65 * 12);
      if (row.months > Math.max(0, eligibleEnd - eligibleStart)) throw Error(`${row.year}년 가입개월이 생년월·계산 기준월과 맞지 않습니다. 만 18세 미만 특례는 지원하지 않습니다.`);
      const c = coeff(row.year); pastMonths += row.months; aWeight += c[0] * row.months; bWeight += c[1] * row.months;
    });
    if (pastMonths !== input.pastMonths) throw Error(`연도별 합계 ${pastMonths}개월과 기납부 기간 ${input.pastMonths}개월을 맞춰 주세요.`);
    if (pastMonths) finite(input.pastB, '재평가 후 과거 B값', 1, 100000000);
    if (!pastMonths && input.pastPaid > 0) throw Error('기납부 기간이 0개월이면 기납부 총액도 0원이어야 합니다.');
    if (input.futureMonths && !input.premium) throw Error('납부 예정 기간이 있으면 월 보험료를 입력해 주세요.');
    if (input.premiumBasis === 'employee' && input.continueTo65 && Math.min(now + input.futureMonths, normal) > Math.max(now, birth + 60 * 12)) throw Error('60세 이후 임의계속가입은 사업장가입자 본인 절반 부담으로 계산하지 않습니다. 전체 보험료 기준을 선택해 계획을 다시 입력해 주세요.');
    return { now, birth, age, normal, pastMonths, aWeight, bWeight };
  }
  function schedule(input, context, claim) {
    const end = Math.min(context.now + input.futureMonths, context.birth + (input.continueTo65 ? 65 : 60) * 12, claim);
    const months = [];
    for (let m = context.now; m < end; m++) months.push({ month: m, year: Math.floor(m / 12), rate: rate(Math.floor(m / 12)) });
    return months;
  }
  function bounds(months) {
    if (!months.length) return { min: 0, max: 0 };
    return { min: Math.max(...months.map(m => RULES.lower * m.rate)), max: Math.min(...months.map(m => RULES.upper * m.rate)) };
  }
  function amount(input, c, months, totalPremium, multiplier) {
    const p = c.pastMonths + months.length;
    if (p < 120) return { eligible: false, months: p, missing: 120 - p };
    const incomeSum = months.reduce((sum, m) => sum + totalPremium / m.rate, 0);
    const B = ((input.pastB || 0) * c.pastMonths + incomeSum) / p;
    const aWeight = c.aWeight + 1.29 * months.length, bWeight = c.bWeight + 1.29 * months.length;
    const normalBeforeCap = (input.A * aWeight + B * bWeight) / 2880;
    return { eligible: true, months: p, B, normalBeforeCap, monthly: normalBeforeCap * multiplier, capNeedsReview: Math.max(normalBeforeCap, normalBeforeCap * multiplier) > B };
  }
  function solve(input, c, months, totalPremium, multiplier, target, current) {
    if (!current.eligible) return { status: 'tenure' };
    if (current.capNeedsReview) return { status: 'cap' };
    if (current.monthly >= target) return { status: 'met', extra: 0, required: totalPremium * (input.premiumBasis === 'employee' ? 0.5 : 1), maximum: current.monthly, remaining: 0 };
    if (!months.length) return { status: 'no-months', maximum: current.monthly, remaining: target - current.monthly };
    const ceiling = bounds(months).max, best = amount(input, c, months, ceiling, multiplier);
    if (best.capNeedsReview) return { status: 'cap' };
    if (best.monthly + 0.001 < target) return { status: 'unreachable', maximum: best.monthly, remaining: target - best.monthly, maxPremium: ceiling };
    let lo = totalPremium, hi = ceiling;
    for (let i = 0; i < 70; i++) { const mid = (lo + hi) / 2; if (amount(input, c, months, mid, multiplier).monthly < target) lo = mid; else hi = mid; }
    const share = input.premiumBasis === 'employee' ? 0.5 : 1;
    return { status: 'possible', extra: (hi - totalPremium) * share, required: hi * share, maximum: best.monthly, remaining: 0, extraTotal: (hi - totalPremium) * share * months.length };
  }
  function calculate(input) {
    const c = validate(input), share = input.premiumBasis === 'employee' ? 0.5 : 1, totalPremium = input.premium / share;
    const normalMonths = schedule(input, c, c.normal);
    const specs = [ { key:'early', label:'5년 조기', claim:c.normal - 60, multiplier:0.7 }, { key:'normal', label:'정상 수령', claim:c.normal, multiplier:1 }, { key:'deferred', label:'5년 연기', claim:c.normal + 60, multiplier:1.36 } ];
    const rows = specs.map(spec => {
      if (spec.claim < c.now && spec.key === 'early') return { ...spec, status:'past' };
      if (spec.key === 'early' && input.earlyEligible !== 'yes') return { ...spec, status:'income' };
      // Deferral holds the same contribution record as the normal scenario.
      const months = spec.key === 'early' ? schedule(input, c, spec.claim) : normalMonths;
      const limit = bounds(months);
      if (months.length && (totalPremium < limit.min - 0.01 || totalPremium > limit.max + 0.01)) return { ...spec, status:'premium', limit:{ min:limit.min * share, max:limit.max * share }, futureMonths:months.length };
      const value = amount(input, c, months, totalPremium, spec.multiplier);
      const base = { ...spec, ...value, futureMonths:months.length, futurePaid:input.premium * months.length, lastMonth:months.length ? monthText(months[months.length-1].month) : null };
      if (!value.eligible) return { ...base, status:'tenure' };
      return { ...base, status: value.capNeedsReview ? 'cap' : 'ok', gapMin:Math.max(0,input.targetMin-value.monthly), gapMax:Math.max(0,input.targetMax-value.monthly), surplusMin:Math.max(0,value.monthly-input.targetMin), surplusMax:Math.max(0,value.monthly-input.targetMax), targetMin:solve(input,c,months,totalPremium,spec.multiplier,input.targetMin,value), targetMax:solve(input,c,months,totalPremium,spec.multiplier,input.targetMax,value) };
    });
    return { rows, age:Math.floor((c.now-c.birth)/12), normalAge:c.age, normalMonth:monthText(c.normal), requestedFutureMonths:input.futureMonths, premiumBasis:input.premiumBasis, pastPaid:input.pastPaid, historyMonths:c.pastMonths, asOf:input.asOf };
  }
  return { RULES, normalAge, rate, coeff, parseMonth, monthText, validate, calculate, amount, schedule, bounds };
});
