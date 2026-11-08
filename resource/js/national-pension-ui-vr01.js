(() => {
  'use strict';
  const $ = id => document.getElementById(id), form = $('pension-form'), rows = $('history-rows');
  const money = n => `${Math.round(n / 1000).toLocaleString('ko-KR')}천원`;
  const exact = n => `${Math.round(n).toLocaleString('ko-KR')}원`;
  const estimate = n => `약 ${money(n)}`;
  let rowId = 0, isDemo = false, calculated = false;
  const empty = '<div class="np-empty"><span aria-hidden="true">↙</span><h3>먼저 내 조건을 입력해 주세요.</h3><p>기록이 없는 항목은 추측해서 채우지 마세요.<br>가상 예시로 계산 구조부터 살펴볼 수 있습니다.</p></div>';
  function dirty() { if (calculated) { $('results').innerHTML = '<p class="np-dirty">입력이 바뀌었습니다. 다시 비교하기를 눌러 주세요.</p>'; calculated = false; } $('form-error').hidden = true; }
  function updateTotal() { const total = [...rows.querySelectorAll('[data-months]')].reduce((s,x) => s + (+x.value || 0),0); $('history-total').textContent = `연도별 합계 ${total}개월`; }
  function addYear(year = '', months = 12) {
    if (rows.children.length >= 60) throw Error('최대 60개 연도를 입력할 수 있습니다.');
    const id = ++rowId, div = document.createElement('div'); div.className = 'np-history-row';
    div.innerHTML = `<label for="year-${id}">가입연도<input data-year id="year-${id}" type="number" min="1988" max="2100" step="1" required></label><label for="months-${id}">가입개월<input data-months id="months-${id}" type="number" min="1" max="12" step="1" required></label><button class="np-remove" type="button" aria-label="이 가입연도 삭제">×</button>`;
    div.querySelector('[data-year]').value = year; div.querySelector('[data-months]').value = months;
    div.querySelector('button').addEventListener('click', () => { div.remove(); updateTotal(); dirty(); }); rows.appendChild(div); updateTotal(); return div;
  }
  function ageHint() { try { const birth = NationalPension.parseMonth($('birth').value), now = NationalPension.parseMonth($('asOf').value); const age = Math.floor((now-birth)/12), normal = NationalPension.normalAge(Math.floor(birth/12)); $('age-hint').textContent = `기준월 현재 만 ${age}세 · 정상 만 ${normal}세 / 조기 ${normal-5}세 / 연기 ${normal+5}세`; } catch { $('age-hint').textContent = '생년월을 입력하면 정상 수급연령을 확인할 수 있습니다.'; } }
  function input() { const out = {}; for (const id of ['pastMonths','pastPaid','pastB','futureMonths','premium','A','targetMin','targetMax']) out[id] = $(id).value === '' ? NaN : Number($(id).value); for (const id of ['birth','asOf','premiumBasis','earlyEligible']) out[id] = $(id).value; out.continueTo65 = $('continueTo65').checked; out.history = [...rows.children].map(row => ({year:Number(row.querySelector('[data-year]').value), months:Number(row.querySelector('[data-months]').value)})); return out; }
  function status(row) { if(row.status==='past') return '5년 조기 개시연령이 이미 지났습니다. 과거로 소급하는 시나리오는 표시하지 않습니다.'; if(row.status==='income') return '조기 수령 소득요건 확인 필요. 조건을 충족한다고 가정할 때만 계산합니다.'; if(row.status==='premium') return `현재 고정 월 납부액이 모델 범위 밖입니다. 이 기간의 허용 범위: ${exact(Math.ceil(row.limit.min))}~${exact(Math.floor(row.limit.max))}.`; if(row.status==='tenure') return `가입기간 ${row.months}개월. 최소 120개월까지 ${row.missing}개월 부족하여 월 연금을 계산하지 않습니다.`; if(row.status==='cap') return '최고한도 확인 필요: 최종 5년의 재평가 평균소득 자료가 없어 월액·부족액·역산을 보류했습니다.'; return ''; }
  function targetItem(title, target, solution, share) {
    let main='', detail='';
    if(solution.status==='met') { main='추가액 0원'; detail='입력한 목표 이상입니다. 세후 충족 여부는 별도입니다.'; }
    else if(solution.status==='possible') { main=`월 +${estimate(solution.extra)}`; detail=`필요 총 월 납부액 ${estimate(solution.required)}. 해당 기간 추가 부담 합계 ${estimate(solution.extraTotal)}. 실제 소득·가입조건 변경이 가능한 경우의 역산입니다.`; }
    else if(solution.status==='unreachable') { main='가정한 상한 내 달성 불가'; detail=`고정 월 납부 상한 ${exact(solution.maxPremium*share)}에서도 연금 ${estimate(solution.maximum)}, 월 ${estimate(solution.remaining)} 부족합니다.`; }
    else if(solution.status==='no-months') { main='추가 납부기간 없음'; detail=`이 계획으로는 월 ${estimate(solution.remaining)}이 부족합니다. 금액만 추가할 수 있다고 가정하지 않습니다.`; }
    else if(solution.status==='cap') { main='최고한도 확인 필요'; detail='최종 5년 재평가 평균소득을 확인하기 전에는 추가액을 역산하지 않습니다.'; }
    else { main='가입기간 확인 필요'; detail='120개월 미만은 보험료 금액을 올리는 것만으로 수급권이 생기지 않습니다.'; }
    return `<div class="np-target-item"><span class="np-target-label">${title} ${money(target)}/월</span><p class="np-target-value">${main}</p><p>${detail}</p></div>`;
  }
  function render(result, data) {
    const share = data.premiumBasis==='employee'?0.5:1, basis = share===0.5?'사업장 본인 부담분':'사업주 부담을 포함한 전체 보험료';
    const tableRows = result.rows.map(r => `<tr class="${r.key==='normal'?'np-normal':''}"><td><strong>${r.label}</strong><small>만 ${result.normalAge+(r.key==='early'?-5:r.key==='deferred'?5:0)}세 · ${NationalPension.monthText(r.claim)} 도달<br>${Math.round(r.multiplier*100)}% 기준</small></td>${r.status!=='ok'?`<td colspan="3" class="np-table-status">${status(r)}</td>`:`<td><b>${money(r.monthly)}</b><small>가입 ${r.months}개월</small></td><td>${money(r.gapMin)}<small>${r.gapMin===0?'부족 없음':'월 부족액'}</small></td><td>${money(r.gapMax)}<small>${r.gapMax===0?'부족 없음':'월 부족액'}</small></td>`}</tr>`).join('');
    const cards = result.rows.map(r => `<section class="np-target-card"><h4>${r.label}<span class="np-chip">${r.futureMonths ?? 0}개월 계획</span></h4>${r.status!=='ok'?`<p class="np-target-intro np-warn">${status(r)}</p>`:`<div class="np-target-grid">${targetItem('최소',data.targetMin,r.targetMin,share)}${targetItem('최대',data.targetMax,r.targetMax,share)}</div>`}</section>`).join('');
    const details = result.rows.filter(r=>r.futureMonths!==undefined).map(r=>`<li><b>${r.label}</b>: 미래 ${r.futureMonths}개월${r.lastMonth?` (${r.lastMonth}까지)`:''}, 미래 부담액 ${r.futurePaid===undefined?'계산 보류':estimate(r.futurePaid)}${r.B?`, 합산 B ${estimate(r.B)}/월`:''}${r.futureMonths<data.futureMonths?'. 입력한 기간보다 짧게 반영: 연령·개시일 제한.':''}</li>`).join('');
    $('results').innerHTML = `${isDemo?'<p class="np-demo-label">가상 예시입니다. 본인의 예상연금이 아닙니다.</p>':''}<div class="np-result-summary"><p>현재 만 ${result.age}세 · 정상 수급연령 <strong>만 ${result.normalAge}세</strong></p><p>금액 단위: <b>천원/월 · 세전</b><br><small>약 1천원 단위 반올림. 실제 지급액의 원 단위 정확성을 의미하지 않습니다.</small></p></div><div class="np-table-wrap" tabindex="0" role="region" aria-label="수령 시점별 비교표, 좁은 화면에서는 가로로 스크롤하세요"><table class="np-table"><thead><tr><th scope="col">수령 시점</th><th scope="col">월 연금 시나리오</th><th scope="col">최소 생활비<br>${money(data.targetMin)} 대비</th><th scope="col">최대 생활비<br>${money(data.targetMax)} 대비</th></tr></thead><tbody>${tableRows}</tbody></table></div><p class="np-result-note">좁은 화면에서는 비교표를 좌우로 밀어 생활비 부족액까지 확인하세요.<br><strong>가정 시나리오이며 공단 예상액이 아닙니다.</strong> 조기·정상·연기 모두 감액·세금·건강보험료·부양가족연금을 제외합니다. 소득 상·하한과 가치기준은 고정했습니다. 조기·연기는 월액만 비교하며 평생 누적 수령액의 유불리를 판단하지 않습니다.</p><section class="np-targets"><h3>목표까지, 월 얼마나 더?</h3><p class="np-target-intro">표시 기준: <b>${basis}</b>. 예정 기간을 늘리지 않고 고정 월 납부액만 높이는 조건부 역산입니다. 납부 권한이나 실제 증액 가능성을 보장하지 않습니다.</p>${cards}</section><details class="np-scenario-details"><summary>반영한 납부기간과 금액 확인</summary><p>기납부 ${result.historyMonths}개월 / 입력한 과거 총 납부액 ${estimate(result.pastPaid)} (연금 산식에 미사용). 과거 총액과 미래 보험료의 부담 기준이 다르면 두 금액을 더하지 마세요.</p><ul>${details}</ul><p>미래 신청 월수는 ${data.futureMonths}개월이며, 나이·수령 시점별 유효기간까지만 사용했습니다. 미래 보험료율은 연도별로 적용합니다.</p></details>`;
  }
  function run(scroll=true) { $('form-error').hidden=true; try { const data=input(), result=NationalPension.calculate(data); render(result,data); calculated=true; if(scroll) $('result-title').focus({preventScroll:false}); } catch(e) { $('form-error').textContent=e.message; $('form-error').hidden=false; $('results').innerHTML='<p class="np-dirty">입력 오류를 수정한 후 다시 계산해 주세요. 이전 결과는 표시하지 않습니다.</p>';calculated=false; } }
  form.addEventListener('submit', e=>{e.preventDefault();run();});
  form.addEventListener('input',()=>{dirty();updateTotal();ageHint();isDemo=false;});
  form.addEventListener('change',()=>{dirty();ageHint();isDemo=false;});
  $('add-year').addEventListener('click',()=>{dirty();addYear().querySelector('input').focus();});
  $('add-range').addEventListener('click',()=>{try{const start=Number($('range-start').value),end=Number($('range-end').value),current=Number($('asOf').value.slice(0,4));if(!Number.isInteger(start)||!Number.isInteger(end)||start<1988||end>=current||end<start||end-start>59)throw Error('1988년부터 계산 기준월의 전년도까지, 올바른 범위를 입력하세요.');const existing=new Set([...rows.querySelectorAll('[data-year]')].map(x=>Number(x.value)));for(let y=start;y<=end;y++)if(!existing.has(y))addYear(y,12);dirty();updateTotal();}catch(e){$('form-error').textContent=e.message;$('form-error').hidden=false;}});
  $('demo-button').addEventListener('click',()=>{form.reset();rows.replaceChildren();const example={birth:'1985-06',asOf:'2026-11',pastMonths:120,pastPaid:32400000,pastB:3000000,futureMonths:240,premium:300000,A:3193511,targetMin:1500000,targetMax:2500000,earlyEligible:'yes',premiumBasis:'total'};for(const [key,value] of Object.entries(example))$(key).value=value;for(let y=2016;y<=2025;y++)addYear(y,12);isDemo=true;ageHint();run(false);});
  $('reset-button').addEventListener('click',()=>{form.reset();rows.replaceChildren();updateTotal();ageHint();$('form-error').hidden=true;$('results').innerHTML=empty;calculated=false;isDemo=false;$('birth').focus();});
  ageHint();
})();
