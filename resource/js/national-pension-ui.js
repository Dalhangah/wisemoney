(() => {
  'use strict';
  const $ = id => document.getElementById(id), form = $('pension-form'), rows = $('history-rows');
  const money = n => `${(Math.round(n / 1000) / 10).toLocaleString('ko-KR', {maximumFractionDigits:1})}만원`;
  const exact = n => `${Math.round(n).toLocaleString('ko-KR')}원`;
  const estimate = n => `약 ${money(n)}`;
  const labels = {early:'5년 일찍 받기', normal:'정해진 나이에 받기', deferred:'5년 늦게 받기'};
  const monthLabel = n => `${Math.floor(n / 12)}년 ${n % 12 + 1}월`;
  let rowId = 0, isDemo = false, calculated = false;
  const empty = '<div class="np-empty"><span aria-hidden="true">↙</span><h3>먼저 내 정보를 입력해 주세요.</h3><p>‘예시로 계산해 보기’를 눌러<br>어떻게 나오는지 먼저 볼 수도 있어요.</p></div>';
  function dirty() {
    if (calculated) { $('results').innerHTML = '<p class="np-dirty">입력이 바뀌었어요. ‘언제 얼마나 받을지 보기’를 다시 눌러 주세요.</p>'; calculated = false; }
    $('calculation-notes').hidden = true;
    $('form-error').hidden = true;
  }
  function updateTotal() {
    const sum = attr => [...rows.querySelectorAll(`[data-${attr}]`)].reduce((s,x) => s + (Number(x.value) || 0), 0);
    const months = sum('months'), paid = sum('paid'), remainingMonths = Number($('pastMonths').value) - months, remainingPaid = Number($('pastPaid').value) - paid;
    const over = remainingMonths < 0 || remainingPaid < 0;
    $('history-total').textContent = `적어 준 기록 ${months}개월 / ${exact(paid)} · 나머지 ${remainingMonths}개월 / ${exact(remainingPaid)}${over ? '. 기록의 합이 위 총합보다 커요. 기간과 금액을 다시 확인해 주세요.' : ''}`;
    $('history-total').classList.toggle('np-warn', over);
  }
  function addYear(year = '', months = '', paid = '') {
    if (rows.children.length >= 60) throw Error('연도별 기록은 60줄까지 넣을 수 있어요.');
    const id = ++rowId, div = document.createElement('div'); div.className = 'np-history-row';
    div.innerHTML = `<label for="year-${id}">연도<input data-year id="year-${id}" type="number" min="1988" max="2026" step="1" required></label><label for="months-${id}">개월<input data-months id="months-${id}" type="number" min="1" max="12" step="1" required></label><label for="paid-${id}">낸 총 보험료 (원)<input data-paid id="paid-${id}" type="number" min="1" max="10000000000" step="1" required></label><button class="np-remove" type="button" aria-label="이 연도 기록 지우기">×</button>`;
    div.querySelector('[data-year]').value = year; div.querySelector('[data-months]').value = months; div.querySelector('[data-paid]').value = paid;
    div.querySelector('button').addEventListener('click', () => { div.remove(); updateTotal(); dirty(); isDemo = false; });
    rows.appendChild(div); updateTotal(); return div;
  }
  function ageHint() {
    try {
      const birth = NationalPension.parseMonth($('birth').value), now = NationalPension.parseMonth('2026-11');
      const age = Math.floor((now-birth)/12), normal = NationalPension.normalAge(Math.floor(birth/12));
      $('age-hint').textContent = `지금 만 ${age}세 · 정해진 나이 ${normal}세 / 5년 일찍 ${normal-5}세 / 5년 늦게 ${normal+5}세`;
    } catch { $('age-hint').textContent = '태어난 해와 달을 입력하면 연금 받는 나이를 알려 드려요.'; }
  }
  function input() {
    const out = {asOf:'2026-11'};
    for (const id of ['pastMonths','pastPaid','futureMonths','premium','targetMin','targetMax']) out[id] = $(id).value === '' ? NaN : Number($(id).value);
    for (const id of ['birth','earlyEligible']) out[id] = $(id).value;
    out.continueTo65 = $('continueTo65').checked;
    out.history = [...rows.children].map(row => {
      const entry = {};
      for (const field of ['year','months','paid']) {
        const value = row.querySelector(`[data-${field}]`).value;
        if (value === '') throw Error('추가한 줄에는 연도, 개월, 낸 돈을 모두 적어 주세요. 모르는 기록은 ×를 눌러 지워 주세요.');
        entry[field] = Number(value);
      }
      return entry;
    });
    return out;
  }
  function status(row) {
    if(row.status==='past') return '5년 일찍 받는 나이가 이미 지났어요. 과거로 돌아가 받는 경우는 계산하지 않아요.';
    if(row.status==='income') return '일찍 받기 위한 소득 조건을 확인해 주세요. 입력창의 선택 항목에서 조건을 갖췄다고 선택하면 계산할 수 있어요.';
    if(row.status==='premium') return row.limit ? `매달 낼 총 보험료를 ${exact(Math.ceil(row.limit.min))}~${exact(Math.floor(row.limit.max))} 사이로 입력해 주세요. 이 계산기가 다루는 범위예요.` : '매달 낼 총 보험료가 이 계산기의 범위를 벗어났어요. 금액을 확인해 주세요.';
    if(row.status==='tenure') return `가입기간이 ${row.months}개월이에요. 연금을 받으려면 120개월이 필요해 ${row.missing}개월이 모자라요.`;
    return '입력한 조건을 다시 확인해 주세요.';
  }
  function targetItem(title, target, solution) {
    let main='', detail='';
    if(solution.status==='met') { main='계산상 더 낼 돈 0원'; detail='이 계산에서는 목표 이상이에요. 실제 받을 돈은 달라질 수 있어요.'; }
    else if(solution.status==='possible') { main=`매달 ${estimate(solution.extra)} 더`; detail=`매달 총 ${estimate(solution.required)}를 내는 경우예요. 앞으로 더 내는 돈은 모두 합쳐 ${estimate(solution.extraTotal)}예요.`; }
    else if(solution.status==='unreachable') { main='최대로 내도 목표에 모자라요'; detail=`이 계산의 월 보험료 한도인 ${exact(solution.maxPremium)}를 내도 연금은 ${estimate(solution.maximum)}예요. 매달 ${estimate(solution.remaining)}가 모자라요.`; }
    else if(solution.status==='no-months') { main='앞으로 낼 기간이 없어요'; detail=`이 계획에서는 매달 ${estimate(solution.remaining)}가 모자라요.`; }
    else { main='가입기간을 먼저 확인해 주세요'; detail='가입기간이 120개월보다 짧으면 보험료만 늘려서 연금을 받을 수는 없어요.'; }
    return `<div class="np-target-item"><span class="np-target-label">${title} 생활비 ${money(target)}/월</span><p class="np-target-value">${main}</p><p>${detail}</p></div>`;
  }
  function render(result, data) {
    const tableRows = result.rows.map(r => `<tr class="${r.key==='normal'?'np-normal':''}"><td><strong>${labels[r.key]}</strong><small>만 ${result.normalAge+(r.key==='early'?-5:r.key==='deferred'?5:0)}세<br>${monthLabel(r.claim)}</small></td>${r.status!=='ok'?`<td colspan="3" class="np-table-status">${status(r)}</td>`:`<td><b>${money(r.monthly)}</b><small>가입 ${r.months}개월${r.capCaution?'<br>실제 연금 한도 확인 필요':''}</small></td><td>${money(r.gapMin)}<small>${r.gapMin===0?'계산상 모자라지 않아요':'매달 모자란 돈'}</small></td><td>${money(r.gapMax)}<small>${r.gapMax===0?'계산상 모자라지 않아요':'매달 모자란 돈'}</small></td>`}</tr>`).join('');
    const cards = result.rows.map(r => `<section class="np-target-card"><h4>${labels[r.key]}<span class="np-chip">${r.futureMonths===undefined?'조건 확인 필요':`앞으로 ${r.futureMonths}개월 납부`}</span></h4>${r.status!=='ok'?`<p class="np-target-intro np-warn">${status(r)}</p>`:`<div class="np-target-grid">${targetItem('최소',data.targetMin,r.targetMin)}${targetItem('최대',data.targetMax,r.targetMax)}</div>`}</section>`).join('');
    const details = result.rows.filter(r=>r.futureMonths!==undefined).map(r=>`<li><b>${labels[r.key]}</b>: 앞으로 ${r.futureMonths}개월${r.lastMonth?` (${monthLabel(NationalPension.parseMonth(r.lastMonth))}까지)` : ''}, 낼 돈 합계 ${r.futurePaid===undefined?'조건 확인 필요':estimate(r.futurePaid)}${r.B?`. 보험료로 추정한 평균 월소득 ${estimate(r.B)} (법정 B값과 달라요)`:''}${r.futureMonths<data.futureMonths?'. 낼 수 있는 나이와 연금 받는 때에 맞춰 입력한 기간보다 짧게 계산했어요.':''}</li>`).join('');
    const h = result.historyAnalysis;
    const reconstruction = h ? `<p>적어 준 연도별 기록: ${h.explicitMonths}개월 / ${exact(h.explicitPaid)}<br>기록을 몰라 나눠 계산한 부분: ${h.remainingMonths}개월 / ${exact(h.remainingPaid)}</p><p>예전 평균 월소득은 ${estimate(h.proxyPastIncome)}로 추정했어요. 당시 금액 그대로이며 지금 가치로 바꾸지 않았어요.</p>` : '';
    const cautions = `${h&&h.earlyRateCaution?'<p class="np-warn">2005년 또는 그 이전 기록이 있어요. 2005년 7월 전에 지역가입자로 낸 기록이 있다면 보험료율이 달라 오차가 클 수 있어요.</p>':''}${h&&h.highIncomeCaution?'<p class="np-warn">일부 기록의 추정 소득이 2026년 소득 상한보다 높아요. 총 납부액과 연도별 기록을 확인해 주세요.</p><p>모르는 기간을 나눠 채운 가정 때문에 높게 나올 수도 있어요. 과거 소득을 현재 상한에 맞춰 낮추지는 않았어요.</p>':''}`;
    $('results').innerHTML = `${isDemo?'<p class="np-demo-label">예시 결과예요. 내 예상연금은 아니에요.</p>':''}<div class="np-result-summary"><p>지금 만 ${result.age}세 · 연금 받는 정해진 나이 <strong>만 ${result.normalAge}세</strong></p><p>금액은 <b>한 달 기준</b>이며, 약 1천원 단위로 반올림했어요.</p><p class="np-help">세전 참고액 · 실제 지급액과 다를 수 있어요.</p></div><div class="np-table-wrap" tabindex="0" role="region" aria-label="연금을 받는 시기별 비교표. 좁은 화면에서는 좌우로 밀어 보세요."><table class="np-table"><thead><tr><th scope="col">받는 시기</th><th scope="col">매달 받을 연금<br>참고용 추정액</th><th scope="col">최소 생활비<br>${money(data.targetMin)}까지<br>모자란 돈</th><th scope="col">최대 생활비<br>${money(data.targetMax)}까지<br>모자란 돈</th></tr></thead><tbody>${tableRows}</tbody></table></div><p class="np-result-note">좁은 화면에서는 표를 좌우로 밀어 보세요.</p><section class="np-targets"><h3>생활비 목표에 맞추려면<br>얼마를 더 내야 할까?</h3><p class="np-target-intro">지금 계획에서 매달 내는 보험료를 늘려 본 계산이에요. 회사에서 내 주는 돈도 포함해요. 실제로 더 낼 수 있는지는 소득과 가입 조건을 확인해야 해요.</p>${cards}</section>`;
    $('record-explanation').innerHTML = `<details class="np-scenario-details"${cautions?' open':''}><summary>내 기록이 계산에 어떻게 쓰였나요?</summary>${cautions}<p>지금까지 가입한 기간과 낸 돈: ${result.historyMonths}개월 / ${exact(result.pastPaid)}</p>${reconstruction}<ul>${details}</ul></details>`;
    $('a-basis-year').textContent = NationalPension.RULES.AYear;
    $('a-basis-amount').textContent = exact(NationalPension.RULES.A);
    $('a-basis-period').textContent = NationalPension.RULES.APeriod;
    $('a-basis-source').href = NationalPension.RULES.ASource;
    $('a-period-source').href = NationalPension.RULES.APeriodSource;
    $('rules-checked').textContent = NationalPension.RULES.checked.replaceAll('-', '.');
    $('calculation-notes').hidden = false;
  }
  function run(scroll=true) {
    $('form-error').hidden=true;
    try { const data=input(), result=NationalPension.calculate(data); render(result,data); calculated=true; if(scroll) $('result-title').focus({preventScroll:false}); }
    catch(e) { $('form-error').textContent=e.message; $('form-error').hidden=false; $('results').innerHTML='<p class="np-dirty">입력한 내용을 고친 뒤 다시 계산해 주세요.</p>'; $('calculation-notes').hidden=true; calculated=false; }
  }
  form.addEventListener('submit', e=>{e.preventDefault();run();});
  form.addEventListener('invalid', e=>{ if(rows.contains(e.target)) $('history-details').open=true; dirty(); }, true);
  form.addEventListener('input',()=>{dirty();updateTotal();ageHint();isDemo=false;});
  form.addEventListener('change',()=>{dirty();updateTotal();ageHint();isDemo=false;});
  $('add-year').addEventListener('click',()=>{try {dirty();isDemo=false;addYear().querySelector('input').focus();} catch(e) {$('form-error').textContent=e.message;$('form-error').hidden=false;}});
  $('demo-button').addEventListener('click',()=>{
    form.reset();rows.replaceChildren();
    const example={birth:'1985-06',pastMonths:130,pastPaid:35250000,futureMonths:240,premium:300000,targetMin:1500000,targetMax:2500000};
    for(const [key,value] of Object.entries(example))$(key).value=value;
    addYear(2026,10,2850000); isDemo=true;ageHint();run(false);
  });
  $('reset-button').addEventListener('click',()=>{form.reset();rows.replaceChildren();form.querySelectorAll('details').forEach(d=>d.open=false);updateTotal();ageHint();$('form-error').hidden=true;$('results').innerHTML=empty;$('calculation-notes').hidden=true;calculated=false;isDemo=false;$('birth').focus();});
  ageHint();updateTotal();
})();
