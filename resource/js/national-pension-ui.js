(() => {
  'use strict';
  const $ = id => document.getElementById(id), form = $('pension-form'), rows = $('history-rows');
  const money = n => `${(Math.round(n / 1000) / 10).toLocaleString('ko-KR', {maximumFractionDigits:1})}만원`;
  const exact = n => `${Math.round(n).toLocaleString('ko-KR')}원`;
  const estimate = n => `약 ${money(n)}`;
  let rowId = 0, isDemo = false, calculated = false;
  const empty = '<div class="np-empty"><span aria-hidden="true">↙</span><h3>먼저 내 조건을 입력해 주세요.</h3><p>과거 총합부터 시작해 보세요.<br>가상 예시로 계산 구조를 살펴볼 수도 있습니다.</p></div>';
  function dirty() {
    if (calculated) { $('results').innerHTML = '<p class="np-dirty">입력이 바뀌었습니다. 다시 비교하기를 눌러 주세요.</p>'; calculated = false; }
    $('form-error').hidden = true;
  }
  function updateTotal() {
    const sum = attr => [...rows.querySelectorAll(`[data-${attr}]`)].reduce((s,x) => s + (Number(x.value) || 0), 0);
    const months = sum('months'), paid = sum('paid'), remainingMonths = Number($('pastMonths').value) - months, remainingPaid = Number($('pastPaid').value) - paid;
    const over = remainingMonths < 0 || remainingPaid < 0;
    $('history-total').textContent = `상세 합계 ${months}개월 / ${exact(paid)} · 나머지 ${remainingMonths}개월 / ${exact(remainingPaid)}${over ? ' — 상세가 과거 총합을 초과했습니다. 총합 또는 상세를 수정하세요.' : ''}`;
    $('history-total').classList.toggle('np-warn', over);
  }
  function addYear(year = '', months = '', paid = '') {
    if (rows.children.length >= 60) throw Error('최대 60개 연도를 입력할 수 있습니다.');
    const id = ++rowId, div = document.createElement('div'); div.className = 'np-history-row';
    div.innerHTML = `<label for="year-${id}">연도<input data-year id="year-${id}" type="number" min="1988" max="2026" step="1" required></label><label for="months-${id}">개월<input data-months id="months-${id}" type="number" min="1" max="12" step="1" required></label><label for="paid-${id}">총 보험료 (원)<input data-paid id="paid-${id}" type="number" min="1" max="10000000000" step="1" required></label><button class="np-remove" type="button" aria-label="이 연도 상세 삭제">×</button>`;
    div.querySelector('[data-year]').value = year; div.querySelector('[data-months]').value = months; div.querySelector('[data-paid]').value = paid;
    div.querySelector('button').addEventListener('click', () => { div.remove(); updateTotal(); dirty(); isDemo = false; });
    rows.appendChild(div); updateTotal(); return div;
  }
  function ageHint() {
    try {
      const birth = NationalPension.parseMonth($('birth').value), now = NationalPension.parseMonth('2026-11');
      const age = Math.floor((now-birth)/12), normal = NationalPension.normalAge(Math.floor(birth/12));
      $('age-hint').textContent = `2026년 11월 현재 만 ${age}세 · 정상 만 ${normal}세 / 조기 ${normal-5}세 / 연기 ${normal+5}세`;
    } catch { $('age-hint').textContent = '생년월을 입력하면 정상 수급연령을 확인할 수 있습니다.'; }
  }
  function input() {
    const out = {asOf:'2026-11'};
    for (const id of ['pastMonths','pastPaid','futureMonths','premium','A','targetMin','targetMax']) out[id] = $(id).value === '' ? NaN : Number($(id).value);
    for (const id of ['birth','earlyEligible']) out[id] = $(id).value;
    out.continueTo65 = $('continueTo65').checked;
    out.history = [...rows.children].map(row => {
      const entry = {};
      for (const field of ['year','months','paid']) {
        const value = row.querySelector(`[data-${field}]`).value;
        if (value === '') throw Error('추가한 연도별 상세의 연도·개월·총 보험료를 모두 입력하거나 빈 행을 삭제하세요.');
        entry[field] = Number(value);
      }
      return entry;
    });
    return out;
  }
  function status(row) {
    if(row.status==='past') return '5년 조기 개시연령이 이미 지났습니다. 과거로 소급하는 시나리오는 표시하지 않습니다.';
    if(row.status==='income') return '조기 수령 소득요건 확인 필요. 선택 항목에서 요건 충족을 가정한 경우만 계산합니다.';
    if(row.status==='premium') return row.limit ? `월 총 보험료가 모형 범위 밖입니다. 허용 범위: ${exact(Math.ceil(row.limit.min))}~${exact(Math.floor(row.limit.max))}.` : '월 총 보험료가 모형의 소득 상·하한 범위 밖입니다. 입력액을 확인하세요.';
    if(row.status==='tenure') return `가입기간 ${row.months}개월. 최소 120개월까지 ${row.missing}개월 부족하여 월 연금을 계산하지 않습니다.`;
    return '계산 조건을 확인해 주세요.';
  }
  function targetItem(title, target, solution) {
    let main='', detail='';
    if(solution.status==='met') { main='이 모형에서 추가액 0원'; detail='재평가·법정 최고한도 적용 전 결과가 목표 이상입니다. 실제 충족 여부는 별도입니다.'; }
    else if(solution.status==='possible') { main=`월 +${estimate(solution.extra)}`; detail=`필요 월 총 보험료 ${estimate(solution.required)}. 추가 보험료 합계 ${estimate(solution.extraTotal)}. 실제 소득·가입조건 변경이 가능한 경우의 추정입니다.`; }
    else if(solution.status==='unreachable') { main='이 모형의 상한 내 목표 미달'; detail=`월 총 보험료 상한 ${exact(solution.maxPremium)}에서도 연금 ${estimate(solution.maximum)}, 월 ${estimate(solution.remaining)} 부족합니다.`; }
    else if(solution.status==='no-months') { main='추가 납부기간 없음'; detail=`이 계획에서는 월 ${estimate(solution.remaining)} 부족합니다. 금액만 추가할 수 있다고 가정하지 않습니다.`; }
    else { main='가입기간 확인 필요'; detail='120개월 미만은 보험료 금액을 올리는 것만으로 수급권이 생기지 않습니다.'; }
    return `<div class="np-target-item"><span class="np-target-label">${title} ${money(target)}/월</span><p class="np-target-value">${main}</p><p>${detail}</p></div>`;
  }
  function render(result, data) {
    const tableRows = result.rows.map(r => `<tr class="${r.key==='normal'?'np-normal':''}"><td><strong>${r.label}</strong><small>만 ${result.normalAge+(r.key==='early'?-5:r.key==='deferred'?5:0)}세 · ${NationalPension.monthText(r.claim)} 도달<br>${Math.round(r.multiplier*100)}% 기준</small></td>${r.status!=='ok'?`<td colspan="3" class="np-table-status">${status(r)}</td>`:`<td><b>${money(r.monthly)}</b><small>가입 ${r.months}개월${r.capCaution?'<br>법정 최고한도 별도 확인':''}</small></td><td>${money(r.gapMin)}<small>${r.gapMin===0?'모형상 부족 없음':'월 부족액'}</small></td><td>${money(r.gapMax)}<small>${r.gapMax===0?'모형상 부족 없음':'월 부족액'}</small></td>`}</tr>`).join('');
    const cards = result.rows.map(r => `<section class="np-target-card"><h4>${r.label}<span class="np-chip">${r.futureMonths===undefined?'조건 확인 필요':`${r.futureMonths}개월 계획`}</span></h4>${r.status!=='ok'?`<p class="np-target-intro np-warn">${status(r)}</p>`:`<div class="np-target-grid">${targetItem('최소',data.targetMin,r.targetMin)}${targetItem('최대',data.targetMax,r.targetMax)}</div>${r.capCaution?'<p class="np-warn np-help">법정 최고한도 확인에 추가 자료가 필요합니다. 표시액은 한도 적용 전입니다.</p>':''}`}</section>`).join('');
    const details = result.rows.filter(r=>r.futureMonths!==undefined).map(r=>`<li><b>${r.label}</b>: 미래 ${r.futureMonths}개월${r.lastMonth?` (${r.lastMonth}까지)`:''}, 미래 총 보험료 ${r.futurePaid===undefined?'계산 보류':estimate(r.futurePaid)}${r.B?`, 명목 합산 소득 추정 ${estimate(r.B)}/월 (법정 B 아님)`:''}${r.futureMonths<data.futureMonths?'. 연령·개시일 제한으로 입력 기간보다 짧게 반영.':''}</li>`).join('');
    const h = result.historyAnalysis;
    const reconstruction = h ? `<p>직접 입력한 상세 ${h.explicitMonths}개월 / ${exact(h.explicitPaid)}. 나머지 추정 ${h.remainingMonths}개월 / ${exact(h.remainingPaid)}.</p><p>과거 명목 소득 추정 ${estimate(h.proxyPastIncome)}/월. 남은 보험료는 모르는 개월에 균등 배분하고 최근부터 거꾸로 배치했습니다. 상세 입력은 총합과 해당 연도 가능 개월에서 차감했습니다.</p>` : '';
    $('results').innerHTML = `${isDemo?'<p class="np-demo-label">가상 예시입니다. 본인의 예상연금이 아닙니다.</p>':''}<div class="np-result-summary"><p>현재 만 ${result.age}세 · 정상 수급연령 <strong>만 ${result.normalAge}세</strong></p><p>금액 단위: <b>만원/월 · 약 1천원 단위 반올림</b></p><p><b>재평가·법정 최고한도 적용 전의 단순 추정</b><br>명목 소득을 사용하며, 법정 B값이나 2026년 구매력으로 환산한 결과가 아닙니다.</p></div>${h&&h.earlyRateCaution?'<p class="np-error">과거 보험료율 주의: 2005년 또는 그 이전 기간이 포함되어 있습니다. 사업장가입자 요율로 역산했으므로 2005년 7월 이전 지역가입 이력이 있다면 실제 요율과 달라 추정 오차가 특히 클 수 있습니다.</p>':''}${h&&h.highIncomeCaution?'<p class="np-error">납부액을 다시 확인해 주세요. 일부 연도에서 역산한 월 소득이 2026년 소득 상한보다도 큽니다. 납부액의 범위나 추정 배치가 맞지 않을 수 있습니다. 과거 소득을 현재 상한으로 임의 보정하지 않았습니다.</p>':''}<div class="np-table-wrap" tabindex="0" role="region" aria-label="수령 시점별 비교표, 좁은 화면에서는 가로로 스크롤하세요"><table class="np-table"><thead><tr><th scope="col">수령 시점</th><th scope="col">월 연금 단순 추정</th><th scope="col">최소 생활비<br>${money(data.targetMin)} 대비</th><th scope="col">최대 생활비<br>${money(data.targetMax)} 대비</th></tr></thead><tbody>${tableRows}</tbody></table></div><p class="np-result-note">좁은 화면에서는 표를 좌우로 밀어 보세요. <strong>공단 공식 예상액이 아닙니다.</strong> 실제 최고한도는 추가 소득자료로 확인해야 합니다. 세금·건강보험료·소득활동 감액·크레딧·부양가족연금은 제외합니다. 정상·전액 연기는 같은 납부 이력을 사용하고 조기는 개시 전까지만 납부합니다. 최소 가입기간은 120개월이며 소급 청구는 지원하지 않습니다.</p><section class="np-targets"><h3>이 단순모형에서 필요한 추가 납입 추정</h3><p class="np-target-intro">모두 <b>사업주 부담을 포함한 총 보험료</b>입니다. 예정 개월수를 유지한 조건부 역산이며, 실제 소득과 가입자격이 전제입니다. 원하는 금액을 자유롭게 더 내서 연금을 살 수 있다는 뜻이 아닙니다.</p>${cards}</section><details class="np-scenario-details"><summary>총합에서 어떻게 추정했는지 확인</summary><p>과거 총합 ${result.historyMonths}개월 / ${exact(result.pastPaid)}.</p>${reconstruction}<ul>${details}</ul><p>과거 사업장 보험료율: 1988~1992년 3%, 1993~1997년 6%, 1998~2025년 9%, 2026년 9.5%. 지역가입자는 2005년 7월 이전 경로가 다릅니다.</p><p>현재 계산의 미래 보험료율은 9.5% 고정입니다. 실제 법의 2027~2033년 매년 0.5%p 인상(최종 13%)은 반영하지 않습니다. 2026년 소득 한도 41만~659만원도 고정하며 미래 한도는 미정입니다.</p></details>`;
  }
  function run(scroll=true) {
    $('form-error').hidden=true;
    try { const data=input(), result=NationalPension.calculate(data); render(result,data); calculated=true; if(scroll) $('result-title').focus({preventScroll:false}); }
    catch(e) { $('form-error').textContent=e.message; $('form-error').hidden=false; $('results').innerHTML='<p class="np-dirty">입력 오류를 수정한 후 다시 계산해 주세요. 이전 결과는 표시하지 않습니다.</p>'; calculated=false; }
  }
  form.addEventListener('submit', e=>{e.preventDefault();run();});
  form.addEventListener('invalid', e=>{ if(rows.contains(e.target)) $('history-details').open=true; dirty(); }, true);
  form.addEventListener('input',()=>{dirty();updateTotal();ageHint();isDemo=false;});
  form.addEventListener('change',()=>{dirty();updateTotal();ageHint();isDemo=false;});
  $('add-year').addEventListener('click',()=>{try {dirty();isDemo=false;addYear().querySelector('input').focus();} catch(e) {$('form-error').textContent=e.message;$('form-error').hidden=false;}});
  $('demo-button').addEventListener('click',()=>{
    form.reset();rows.replaceChildren();
    const example={birth:'1985-06',pastMonths:130,pastPaid:35250000,futureMonths:240,premium:300000,A:3193511,targetMin:1500000,targetMax:2500000};
    for(const [key,value] of Object.entries(example))$(key).value=value;
    addYear(2026,10,2850000); isDemo=true;ageHint();run(false);
  });
  $('reset-button').addEventListener('click',()=>{form.reset();rows.replaceChildren();form.querySelectorAll('details').forEach(d=>d.open=false);updateTotal();ageHint();$('form-error').hidden=true;$('results').innerHTML=empty;calculated=false;isDemo=false;$('birth').focus();});
  ageHint();updateTotal();
})();
