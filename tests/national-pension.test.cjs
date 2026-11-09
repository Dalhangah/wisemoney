const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const e = require('../resource/js/national-pension-engine.js');
const base = () => ({birth:'1985-06',asOf:'2026-11',pastMonths:130,pastPaid:35250000,futureMonths:240,premium:300000,targetMin:1500000,targetMax:2500000,earlyEligible:'yes',continueTo65:false,history:[]});
const close = (a,b,tol=1e-6) => assert.ok(Math.abs(a-b)<tol, `${a} != ${b}`);
const normal = x => e.calculate(x).rows[1];
function conserved(x) {
  const c=e.validate(x),h=c.historyAnalysis;
  assert.equal(h.allocated.reduce((s,r)=>s+r.knownMonths+r.estimatedMonths,0),x.pastMonths);
  close(h.allocated.reduce((s,r)=>s+r.knownPaid+r.estimatedPaid,0),x.pastPaid,.001);
  assert.equal(h.explicitMonths+h.remainingMonths,x.pastMonths);
  close(h.explicitPaid+h.remainingPaid,x.pastPaid);
  for(const r of h.allocated) assert.ok(r.knownMonths+r.estimatedMonths<=e.capacity(r.year,c));
  return h;
}
test('birthyear pension age thresholds',()=>{for(const [y,a] of [[1952,60],[1953,61],[1956,61],[1957,62],[1960,62],[1961,63],[1964,63],[1965,64],[1968,64],[1969,65],[2000,65]])assert.equal(e.normalAge(y),a);});
test('active future rate stays 9.5%; staged law exists only as disabled roadmap',()=>{
  for(let y=2026;y<2100;y++)close(e.rate(y),.095);
  assert.equal(e.scheduledFutureRate,undefined);
  const src=fs.readFileSync(require.resolve('../resource/js/national-pension-engine.js'),'utf8');
  assert.match(src,/\/\* FUTURE UPDATE ROADMAP ONLY[\s\S]*const scheduledFutureRate[\s\S]*\*\//);
});
test('workplace historical rate and benefit coefficient boundaries',()=>{
  for(const [year,rate] of [[1988,.03],[1992,.03],[1993,.06],[1997,.06],[1998,.09],[2025,.09],[2026,.095]])close(e.historicalRate(year),rate);
  assert.deepEqual(e.coeff(1988),[2.4,1.8]);assert.deepEqual(e.coeff(1998),[2.4,1.8]);assert.deepEqual(e.coeff(1999),[1.8,1.8]);assert.deepEqual(e.coeff(2007),[1.8,1.8]);close(e.coeff(2008)[0],1.5);close(e.coeff(2025)[0],1.245);assert.deepEqual(e.coeff(2026),[1.29,1.29]);
});
test('only past total months and total paid are required',()=>{const x=base(),r=normal(x),h=conserved(x);assert.equal(r.status,'ok');assert.equal(h.explicitMonths,0);assert.equal(h.remainingMonths,130);assert.equal(h.allocated[0].year,2016);assert.equal(h.allocated.at(-1).year,2026);assert.equal(h.allocated.at(-1).estimatedMonths,10);assert.ok(!('pastB' in x));assert.ok(!('premiumBasis' in x));});
test('optional annual records are subsets, never additions',()=>{const x=base();x.history=[{year:2026,months:10,paid:2850000}];const h=conserved(x);assert.equal(h.explicitMonths,10);assert.equal(h.remainingMonths,120);assert.equal(h.remainingPaid,32400000);close(h.proxyPastIncome,3000000);assert.equal(h.allocated.at(-1).estimatedMonths,0);assert.equal(normal(x).months,353);});
test('partial known year reserves slots, remaining allocation conserves amounts',()=>{const x=base();x.history=[{year:2026,months:5,paid:1425000}];const h=conserved(x),y=h.allocated.at(-1);assert.equal(y.estimatedMonths,5);assert.equal(y.knownMonths,5);assert.equal(h.remainingMonths,125);});
test('independent total-month and total-amount overages rejected',()=>{
  let x=base();x.pastMonths=5;x.history=[{year:2026,months:6,paid:1000}];assert.throws(()=>e.calculate(x),/가입개월의 합계/);
  x=base();x.history=[{year:2026,months:1,paid:x.pastPaid+1}];assert.throws(()=>e.calculate(x),/납부액의 합계/);
});
test('duplicate annual rows and incompatible zero remainders rejected',()=>{
  let x=base();x.history=[{year:2025,months:1,paid:1},{year:2025,months:1,paid:1}];assert.throws(()=>e.calculate(x),/중복/);
  x=base();x.pastMonths=10;x.history=[{year:2026,months:10,paid:x.pastPaid-1}];assert.throws(()=>e.calculate(x),/금액도/);
  x=base();x.history=[{year:2026,months:1,paid:x.pastPaid}];assert.throws(()=>e.calculate(x),/남은 납부액/);
});
test('all-known history computes income from each rate; row order is immaterial',()=>{
  const x=base();x.birth='1964-01';x.futureMonths=0;x.history=Array.from({length:10},(_,i)=>({year:1992+i,months:12,paid:12*(2000000+i*100000)*e.historicalRate(1992+i)}));x.pastMonths=120;x.pastPaid=x.history.reduce((s,r)=>s+r.paid,0);
  const h=conserved(x);assert.equal(h.remainingMonths,0);assert.equal(h.remainingPaid,0);close(h.proxyPastIncome,2450000);const a=normal(x);x.history.reverse();close(normal(x).monthly,a.monthly);assert.equal(h.earlyRateCaution,true);
});
test('unknown calendar allocation cannot exceed possible age or years',()=>{let x=base();x.birth='2008-01';x.pastMonths=11;assert.throws(()=>e.calculate(x),/가능한 기간/);x.pastMonths=10;assert.equal(conserved(x).allocated[0].estimatedMonths,10);x=base();x.history=[{year:2026,months:11,paid:100}];assert.throws(()=>e.calculate(x),/가입개월/);x.history=[{year:2000,months:1,paid:100}];assert.throws(()=>e.calculate(x),/가입개월/);x.history=[{year:2027,months:1,paid:100}];assert.throws(()=>e.calculate(x),/가입연도/);});
test('random valid subset histories preserve totals and calendar capacity',()=>{let seed=91;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);for(let i=0;i<200;i++){const x=base();x.pastMonths=60+Math.floor(rand()*180);x.pastPaid=1000000+Math.floor(rand()*50000000);const known=1+Math.floor(rand()*9),paid=Math.floor(x.pastPaid*rand()*.8)+1;x.history=[{year:2026,months:known,paid}];conserved(x);}});
test('period factor counted once at 119/120/240/241 month thresholds',()=>{for(const P of [0,119,120,121,239,240,241,360,480]){const B=3000000,A=3193511,c={pastMonths:P,pastIncomeSum:P*B,aWeight:P*1.29,bWeight:P*1.29},got=e.amount({A},c,[],0,1);if(P<120)assert.equal(got.eligible,false);else close(got.monthly,1.29*(A+B)*P/2880);}});
test('legacy A plus 0.75B uses the same whole-career nominal proxy',()=>{const x=base();x.birth='1964-01';x.futureMonths=0;x.pastMonths=120;x.history=[{year:1988,months:12,paid:1080000},{year:1999,months:12,paid:3240000},...Array.from({length:8},(_,i)=>({year:2008+i,months:12,paid:3240000}))];x.pastPaid=x.history.reduce((s,r)=>s+r.paid,0);const c=e.validate(x),B=c.pastIncomeSum/120;close(B,3000000);close(normal(x).monthly,(e.RULES.A*c.aWeight+B*c.bWeight)/2880);});
test('changed premiums change nominal proxy; no revaluation or hidden income clamp',()=>{const a=base(),b=base();b.pastPaid*=2;assert.ok(normal(b).monthly>normal(a).monthly);const x=base();x.pastPaid=1000000000;x.futureMonths=0;assert.ok(conserved(x).proxyPastIncome>e.RULES.upper);assert.equal(conserved(x).highIncomeCaution,true);});
test('legal cap is explicitly not computed from nominal proxy',()=>{const P=360,B=410000,A=3193511,r=e.amount({A},{pastMonths:P,pastIncomeSum:P*B,aWeight:P*1.29,bWeight:P*1.29},[],0,1);assert.ok(r.monthly>B);assert.equal(r.capCaution,true);close(r.monthly,1.29*(A+B)*P/2880);});
test('normal/deferred same history; early contributions stop before own start',()=>{const x=base();x.continueTo65=true;x.futureMonths=360;const [a,n,d]=e.calculate(x).rows;assert.equal(n.futureMonths-a.futureMonths,60);assert.equal(n.futureMonths,d.futureMonths);close(d.monthly,n.monthly*1.36);assert.ok(a.monthly<n.monthly*.7);assert.equal(a.lastMonth,'2045-05');assert.equal(n.lastMonth,'2050-05');});
test('default contributions stop at 60',()=>{const [a,n,d]=e.calculate(base()).rows;assert.equal(n.futureMonths,223);assert.equal(a.futureMonths,n.futureMonths);close(a.monthly,n.monthly*.7);close(d.monthly,n.monthly*1.36);});
test('early eligibility and already-past full five-year early date',()=>{for(const eligibility of ['unknown','no']){const x=base();x.earlyEligible=eligibility;assert.equal(e.calculate(x).rows[0].status,'income');}const x=base();x.birth='1965-01';assert.equal(e.calculate(x).rows[0].status,'past');x.birth='1967-11';assert.notEqual(e.calculate(x).rows[0].status,'past');});
test('invalid dates, inconsistent totals and nonfinite numbers rejected',()=>{
  for(const s of ['2026-13','bad','2026-00'])assert.throws(()=>e.parseMonth(s));
  for(const [key,value] of [['birth','1950-01'],['birth','2010-01'],['asOf','2027-01'],['pastPaid',-1],['pastMonths',1.5],['futureMonths',.5],['premium',-1],['targetMax',0],['earlyEligible','maybe']]){const x=base();x[key]=value;assert.throws(()=>e.calculate(x),`${key}`);}
  for(const [months,paid] of [[0,1],[1,0]]){const x=base();x.pastMonths=months;x.pastPaid=paid;assert.throws(()=>e.calculate(x));}
  const x=base();x.premium=0;assert.throws(()=>e.calculate(x),/월 보험료/);
});
test('future premium bounds use explicitly frozen 2026 rules',()=>{let x=base();x.premium=38949;let r=normal(x);assert.equal(r.status,'premium');close(r.limit.min,38950);x.premium=626051;assert.equal(normal(x).status,'premium');x.premium=38950;assert.equal(normal(x).status,'ok');x.premium=626050;assert.equal(normal(x).status,'ok');});
test('conditional target solve roundtrips and cannot exceed modeled cap',()=>{const x=base(),r=e.calculate(x).rows[2];assert.equal(r.targetMin.status,'possible');x.premium=r.targetMin.required;close(e.calculate(x).rows[2].monthly,x.targetMin,.01);assert.ok(x.premium<=626050);assert.equal(r.targetMax.status,'unreachable');assert.ok(r.targetMax.remaining>0);close(r.targetMin.extraTotal,r.targetMin.extra*r.futureMonths);});
test('no future period, met targets, and tenure below 120 remain distinct',()=>{let x=base();x.futureMonths=0;x.targetMin=0;x.targetMax=1000000;let r=normal(x);assert.equal(r.targetMin.status,'met');assert.equal(r.targetMax.status,'no-months');x.pastMonths=119;r=normal(x);assert.equal(r.status,'tenure');assert.equal(r.missing,1);x.pastMonths=0;x.pastPaid=0;assert.equal(normal(x).status,'tenure');});
test('4340 reference cells regress formula only under original constant-income assumptions',()=>{const rows=JSON.parse(fs.readFileSync(__dirname+'/reference-table.json','utf8'));assert.equal(rows.length,620);const years=[10,15,20,25,30,35,40];let count=0;for(const row of rows){const B=row.values[1];for(let i=0;i<years.length;i++){const P=years[i]*12,raw=e.amount({A:3193511},{pastMonths:P,pastIncomeSum:P*B,aWeight:P*1.29,bWeight:P*1.29},[],0,1).monthly;/* Fixture's constant-income legal cap is known here. App does NOT assume this for users. */assert.ok(Math.abs(Math.min(B,raw)-row.values[i+3])<10.01,`sheet row ${row.row}, ${years[i]} years`);count++;}}assert.equal(count,4340);});
test('archive uses dedicated immutable assets and current page links encoded filename',()=>{const dir=__dirname+'/..',archive=fs.readFileSync(dir+'/app/national-pension-calculator VR.0.1.html','utf8'),live=fs.readFileSync(dir+'/app/national-pension-calculator.html','utf8');for(const file of ['national-pension-engine-vr01.js','national-pension-ui-vr01.js','national-pension-vr01.css']){assert.ok(archive.includes(file));assert.ok(fs.existsSync(dir+'/resource/'+(file.endsWith('.css')?'css':'js')+'/'+file));}assert.ok(live.includes('national-pension-calculator%20VR.0.1.html'));assert.ok(!live.includes('id="pastB"'));assert.ok(!live.includes('id="premiumBasis"'));});

test('developer-set A is mandatory internally and cannot be overridden by form data',()=>{const x=base(),expected=normal(x);for(const A of [1,99999999,NaN,Infinity,undefined]){x.A=A;const actual=normal(x);close(actual.monthly,expected.monthly);assert.deepEqual(actual.targetMin,expected.targetMin);assert.deepEqual(actual.targetMax,expected.targetMax);}assert.equal(e.RULES.A,3193511);assert.equal(e.RULES.AYear,2026);assert.ok(Object.isFrozen(e.RULES));assert.equal(e.RULES.ASource,'https://www.nps.or.kr/comm/quick/getOHAH0011P0.do');});
test('UI has four input groups, no A input, and A explanation follows results',()=>{
 const html=fs.readFileSync(__dirname+'/../app/national-pension-calculator.html','utf8');
 const ui=fs.readFileSync(__dirname+'/../resource/js/national-pension-ui.js','utf8');
 assert.equal((html.match(/<fieldset>/g)||[]).length,4);
 assert.ok(!html.includes('id="A"'));
 assert.ok(!ui.includes("$('A')"));
 assert.ok(html.indexOf('id="calculation-notes"')>html.indexOf('id="results"'));
 assert.match(html,/id="calculation-notes"[^>]*hidden/);
 for(const key of ['A','AYear','APeriod','ASource','APeriodSource'])assert.ok(ui.includes('NationalPension.RULES.'+key));
 assert.ok(html.includes('aria-describedby="birth-help age-hint"'));
 assert.ok(html.includes('id="form-error" class="np-error" role="alert"'));
 assert.ok(html.includes('v03'));
});
