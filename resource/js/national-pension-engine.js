(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NationalPension = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const RULES = Object.freeze({ version:'0.2', checked:'2026-11-09', A:3193511, lower:410000, upper:6590000, futureRate:0.095 });
  const ym = (year, month) => year * 12 + month - 1;
  const parseMonth = value => { const m = /^(\d{4})-(\d{2})$/.exec(value || ''); if (!m || +m[2] < 1 || +m[2] > 12) throw Error('연월을 올바르게 입력해 주세요.'); return ym(+m[1], +m[2]); };
  const monthText = n => `${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, '0')}`;
  const normalAge = y => y <= 1952 ? 60 : y <= 1956 ? 61 : y <= 1960 ? 62 : y <= 1964 ? 63 : y <= 1968 ? 64 : 65;
  const coeff = y => y <= 1998 ? [2.4,1.8] : y <= 2007 ? [1.8,1.8] : y <= 2025 ? [1.5-0.015*(y-2008),1.5-0.015*(y-2008)] : [1.29,1.29];
  // Historical reconstruction explicitly assumes WORKPLACE total-premium rates.
  // Regional/voluntary histories (especially before July 2005) can differ.
  const historicalRate = y => y <= 1992 ? 0.03 : y <= 1997 ? 0.06 : y <= 2025 ? 0.09 : 0.095;
  // ACTIVE MODEL: future payments use 2026's rate, NOT the future-law schedule.
  const rate = _year => RULES.futureRate;
  /* FUTURE UPDATE ROADMAP ONLY -- NOT EXECUTED.
     Actual enacted rates: 2027 10%, 2028 10.5%, 2029 11%, 2030 11.5%,
     2031 12%, 2032 12.5%, 2033 and later 13%.
     Before enabling, update visible assumptions, income bounds, historical
     input range, and tests together. Do not silently activate this function.
     const scheduledFutureRate = year => Math.min(0.13, 0.095 + Math.max(0, year - 2026) * 0.005);
  */
  function finite(n,name,min,max,integer=false) { if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n))) throw Error(`${name} 입력을 확인해 주세요.`); }
  function capacity(year,c) { return Math.max(0,Math.min(ym(year+1,1),c.now,c.birth+65*12)-Math.max(ym(year,1),ym(1988,1),c.birth+18*12)); }
  function reconstructHistory(input,c) {
    if(!Array.isArray(input.history)||input.history.length>60) throw Error('연도별 입력을 확인해 주세요.');
    const annual = new Map(); let explicitMonths=0,explicitPaid=0;
    for(const row of input.history) {
      finite(row.year,'가입연도',1988,Math.floor(c.now/12),true);
      finite(row.months,'연도별 개월',1,12,true);
      finite(row.paid,'연도별 합산 납부액',1,10000000000);
      if(annual.has(row.year)) throw Error(`${row.year}년이 중복되었습니다. 같은 해의 이력은 한 줄로 합쳐 주세요.`);
      if(row.months>capacity(row.year,c)) throw Error(`${row.year}년 가입개월이 생년월·기준월과 맞지 않습니다. 기준월 이후 또는 만 18세 미만 특례 기간은 지원하지 않습니다.`);
      annual.set(row.year,{year:row.year,knownMonths:row.months,knownPaid:row.paid,estimatedMonths:0,estimatedPaid:0,rate:historicalRate(row.year)});
      explicitMonths+=row.months; explicitPaid+=row.paid;
    }
    const remainingMonths=input.pastMonths-explicitMonths,remainingPaid=input.pastPaid-explicitPaid;
    if(remainingMonths<0) throw Error('연도별 가입개월의 합계가 전체 가입개월을 초과합니다. 상세 입력은 전체의 일부입니다.');
    if(remainingPaid<0) throw Error('연도별 납부액의 합계가 전체 납부총액을 초과합니다. 상세 입력은 전체의 일부입니다.');
    if(remainingMonths===0&&remainingPaid!==0) throw Error('연도별 개월이 전체와 같으면 연도별 금액도 전체 납부총액과 같아야 합니다.');
    if(remainingMonths>0&&remainingPaid<=0) throw Error('미입력 가입개월이 남았지만 남은 납부액이 없습니다. 전체·상세 입력을 확인해 주세요. 크레딧은 이 모형에서 제외합니다.');
    // Unknown timing is a FICTIONAL latest-backwards allocation, not recovered history.
    // Explicit months reserve calendar slots first; amounts and months are never added twice.
    let unallocated=remainingMonths;
    for(let year=Math.floor(c.now/12);year>=1988&&unallocated>0;year--) {
      const row=annual.get(year)||{year,knownMonths:0,knownPaid:0,estimatedMonths:0,estimatedPaid:0,rate:historicalRate(year)};
      const n=Math.min(unallocated,capacity(year,c)-row.knownMonths);
      if(n>0) { row.estimatedMonths=n; row.estimatedPaid=remainingPaid*n/remainingMonths; annual.set(year,row); unallocated-=n; }
    }
    if(unallocated>0) throw Error('전체 가입개월이 생년월·기준월상 가능한 기간보다 많습니다. 만 18세 미만 특례·크레딧은 별도 확인해 주세요.');
    const allocated=[...annual.values()].sort((a,b)=>a.year-b.year);
    let pastIncomeSum=0,aWeight=0,bWeight=0;
    for(const row of allocated) {
      const months=row.knownMonths+row.estimatedMonths,coefficient=coeff(row.year);
      // Premium / total rate gives income-months; no revaluation or cap rewriting.
      pastIncomeSum+=(row.knownPaid+row.estimatedPaid)/row.rate;
      aWeight+=coefficient[0]*months; bWeight+=coefficient[1]*months;
    }
    return {explicitMonths,explicitPaid,remainingMonths,remainingPaid,allocated,pastIncomeSum,aWeight,bWeight,proxyPastIncome:input.pastMonths?pastIncomeSum/input.pastMonths:0,earlyRateCaution:allocated.some(r=>r.year<=2005),highIncomeCaution:allocated.some(r=>(r.knownPaid+r.estimatedPaid)/r.rate/(r.knownMonths+r.estimatedMonths)>RULES.upper),earliestYear:allocated.length?allocated[0].year:null};
  }
  function validate(input) {
    const now=parseMonth(input.asOf),birth=parseMonth(input.birth),birthYear=Math.floor(birth/12);
    if(now<ym(2026,7)||now>=ym(2027,1)) throw Error('이 간편 버전의 계산 기준월은 2026년 7~12월만 지원합니다. 2027년 이후 규칙은 아직 활성화하지 않았습니다.');
    if(birth>=now||now-birth<18*12) throw Error('만 18세 이상 계획만 지원합니다.');
    const age=normalAge(birthYear),normal=birth+age*12;
    if(now>=normal) throw Error('이미 정상 수급연령에 도달한 경우는 공단의 개별 조회가 필요합니다. 이 도구는 수급 전 계획용입니다.');
    finite(input.A,'A값',1,100000000); finite(input.pastPaid,'전체 납부총액',0,10000000000);
    finite(input.pastMonths,'전체 가입개월',0,600,true); finite(input.futureMonths,'앞으로 납부할 개월',0,600,true);
    finite(input.premium,'전체 월 보험료',0,10000000); finite(input.targetMin,'최소 생활비',0,100000000); finite(input.targetMax,'최대 생활비',input.targetMin,100000000);
    if(!['yes','no','unknown'].includes(input.earlyEligible)) throw Error('조기연금 소득요건을 선택해 주세요.');
    if((input.pastMonths===0)!==(input.pastPaid===0)) throw Error('기납부 이력이 없으면 가입개월과 납부총액 모두 0으로, 이력이 있으면 모두 양수로 입력해 주세요.');
    if(input.futureMonths&&!input.premium) throw Error('납부 예정 기간이 있으면 월 보험료를 입력해 주세요.');
    const c={now,birth,age,normal,pastMonths:input.pastMonths};
    c.historyAnalysis=reconstructHistory(input,c); c.pastIncomeSum=c.historyAnalysis.pastIncomeSum;c.aWeight=c.historyAnalysis.aWeight;c.bWeight=c.historyAnalysis.bWeight;
    return c;
  }
  function schedule(input,c,claim) {
    const end=Math.min(c.now+input.futureMonths,c.birth+(input.continueTo65?65:60)*12,claim),months=[];
    for(let m=c.now;m<end;m++) months.push({month:m,year:Math.floor(m/12),rate:rate(Math.floor(m/12))});
    return months;
  }
  function bounds(months) { return months.length?{min:RULES.lower*RULES.futureRate,max:RULES.upper*RULES.futureRate}:{min:0,max:0}; }
  function amount(input,c,months,totalPremium,multiplier) {
    const p=c.pastMonths+months.length;
    if(p<120) return {eligible:false,months:p,missing:120-p};
    const incomeSum=months.reduce((sum,m)=>sum+totalPremium/m.rate,0),B=(c.pastIncomeSum+incomeSum)/p;
    const normalBeforeCap=(input.A*(c.aWeight+1.29*months.length)+B*(c.bWeight+1.29*months.length))/2880;
    // B is a NOMINAL INCOME PROXY, not statutory revalued B. Never assert the legal cap.
    // All amounts are pre-revaluation / pre-cap illustrations only.
    return {eligible:true,months:p,B,normalBeforeCap,monthly:normalBeforeCap*multiplier,capCaution:Math.max(normalBeforeCap,normalBeforeCap*multiplier)>B};
  }
  function solve(input,c,months,totalPremium,multiplier,target,current) {
    if(!current.eligible) return {status:'tenure'};
    if(current.monthly>=target) return {status:'met',extra:0,required:totalPremium,maximum:current.monthly,remaining:0};
    if(!months.length) return {status:'no-months',maximum:current.monthly,remaining:target-current.monthly};
    const ceiling=bounds(months).max,best=amount(input,c,months,ceiling,multiplier);
    if(best.monthly+0.001<target) return {status:'unreachable',maximum:best.monthly,remaining:target-best.monthly,maxPremium:ceiling};
    let lo=totalPremium,hi=ceiling;
    for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(amount(input,c,months,mid,multiplier).monthly<target)lo=mid;else hi=mid;}
    return {status:'possible',extra:hi-totalPremium,required:hi,maximum:best.monthly,remaining:0,extraTotal:(hi-totalPremium)*months.length};
  }
  function calculate(input) {
    const c=validate(input),normalMonths=schedule(input,c,c.normal),totalPremium=input.premium;
    const specs=[{key:'early',label:'5년 조기',claim:c.normal-60,multiplier:0.7},{key:'normal',label:'정상 수령',claim:c.normal,multiplier:1},{key:'deferred',label:'5년 연기',claim:c.normal+60,multiplier:1.36}];
    const rows=specs.map(spec=>{
      if(spec.claim<c.now&&spec.key==='early')return {...spec,status:'past'};
      if(spec.key==='early'&&input.earlyEligible!=='yes')return {...spec,status:'income'};
      const months=spec.key==='early'?schedule(input,c,spec.claim):normalMonths,limit=bounds(months);
      if(months.length&&(totalPremium<limit.min-0.01||totalPremium>limit.max+0.01))return {...spec,status:'premium',limit,futureMonths:months.length};
      const value=amount(input,c,months,totalPremium,spec.multiplier),base={...spec,...value,futureMonths:months.length,futurePaid:input.premium*months.length,lastMonth:months.length?monthText(months[months.length-1].month):null};
      if(!value.eligible)return {...base,status:'tenure'};
      return {...base,status:'ok',gapMin:Math.max(0,input.targetMin-value.monthly),gapMax:Math.max(0,input.targetMax-value.monthly),targetMin:solve(input,c,months,totalPremium,spec.multiplier,input.targetMin,value),targetMax:solve(input,c,months,totalPremium,spec.multiplier,input.targetMax,value)};
    });
    return {rows,age:Math.floor((c.now-c.birth)/12),normalAge:c.age,normalMonth:monthText(c.normal),requestedFutureMonths:input.futureMonths,pastPaid:input.pastPaid,historyMonths:c.pastMonths,asOf:input.asOf,historyAnalysis:c.historyAnalysis};
  }
  return {RULES,normalAge,rate,historicalRate,coeff,parseMonth,monthText,validate,reconstructHistory,capacity,calculate,amount,schedule,bounds};
});
