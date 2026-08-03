const $=id=>document.getElementById(id);
const KEY="tripLogSapporoV2";
const EMPTY_DEFAULTS={
 trip:{name:"여행 데이터를 불러와 주세요",start:"2026-08-08",end:"2026-08-14",booking:"",currency:"¥"},
 flights:[],schedules:{},packing:[],outfits:[],budget:0,expenses:[],
 stayInfo:{stayName:"",room:"",address:"",bookingCode:"",mapCode:"",mapUrl:"",guestFormUrl:"",checkinNote:"",checkoutNote:"",guestNote:""},
 sharedDataLoaded:false
};
let defaults=null,state=null,day="",expenseCat="식비",ledgerDay="";
function clone(x){return JSON.parse(JSON.stringify(x))}
function esc(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function safeExternalUrl(value){try{const u=new URL(String(value||""));return ["https:","http:"].includes(u.protocol)?u.href:""}catch{return ""}}
function safeCategoryId(value,index){
 const id=String(value||"");
 if(id==="outfits")return id;
 return /^[a-zA-Z0-9_-]+$/.test(id)?id:`cat-${index}-${Date.now().toString(36)}`;
}
function normalizePacking(packing){
 return (Array.isArray(packing)?packing:[]).map((cat,index)=>({
  id:safeCategoryId(cat?.id,index),icon:String(cat?.icon||"📦"),name:String(cat?.name||"새 카테고리"),
  items:Array.isArray(cat?.items)?cat.items.map(item=>({t:String(item?.t||""),done:Boolean(item?.done)})):[]
 }))
}
function normalizeSharedImport(raw){
 const source=raw?.sharedData&&typeof raw.sharedData==="object"?raw.sharedData:raw;
 if(!source||typeof source!=="object"||!source.trip||!Array.isArray(source.flights)||!source.stayInfo)throw new Error("공통 여행 데이터 형식 오류");
 const trip={...EMPTY_DEFAULTS.trip,...source.trip};
 delete trip.memo;
 return {
  trip,
  flights:source.flights.map(item=>({...item})),
  stayInfo:{...EMPTY_DEFAULTS.stayInfo,...source.stayInfo}
 }
}
function normalizePersonalImport(raw){
 const source=raw?.personalData&&typeof raw.personalData==="object"?raw.personalData:raw;
 if(!source||typeof source!=="object")throw new Error("개인 데이터 형식 오류");
 return {
  schedules:source.schedules&&typeof source.schedules==="object"?source.schedules:{},
  packing:normalizePacking(source.packing),
  outfits:Array.isArray(source.outfits)?source.outfits:[],
  budget:Number.isFinite(Number(source.budget))?Number(source.budget):0,
  expenses:Array.isArray(source.expenses)?source.expenses:[]
 }
}
function hasObjectValues(value){
 return value&&typeof value==="object"&&Object.values(value).some(item=>String(item??"").trim())
}
function normalizeState(raw){
 const saved=raw&&typeof raw==="object"?raw:{};
 const loaded=Object.assign(clone(defaults),saved);
 loaded.trip={...defaults.trip,...(saved.trip||{})};
 delete loaded.trip.memo;
 const savedStay=hasObjectValues(saved.stayInfo)?saved.stayInfo:(hasObjectValues(saved.privateInfo)?saved.privateInfo:{});
 loaded.stayInfo={...defaults.stayInfo,...savedStay};
 delete loaded.privateInfo;
 loaded.flights=Array.isArray(saved.flights)?saved.flights:clone(defaults.flights);
 loaded.schedules=saved.schedules&&typeof saved.schedules==="object"?saved.schedules:clone(defaults.schedules);
 loaded.expenses=Array.isArray(saved.expenses)?saved.expenses:clone(defaults.expenses||[]);
 loaded.packing=normalizePacking(Array.isArray(saved.packing)?saved.packing:clone(defaults.packing));
 loaded.outfits=Array.isArray(saved.outfits)?saved.outfits:clone(defaults.outfits||[]);
 loaded.budget=Number.isFinite(Number(saved.budget))?Number(saved.budget):Number(defaults.budget||0);
 loaded.sharedDataLoaded=Boolean(saved.sharedDataLoaded||loaded.flights.length||hasObjectValues(savedStay)||(saved.trip?.name&&saved.trip.name!==EMPTY_DEFAULTS.trip.name));
 return loaded
}
function load(){
 try{return normalizeState(JSON.parse(localStorage.getItem(KEY)||"{}"))}
 catch{return normalizeState({})}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function dates(){
 const result=[];
 const [sy,sm,sd]=state.trip.start.split("-").map(Number);
 const [ey,em,ed]=state.trip.end.split("-").map(Number);
 const current=new Date(Date.UTC(sy,sm-1,sd));
 const end=new Date(Date.UTC(ey,em-1,ed));
 while(current<=end){
  const y=current.getUTCFullYear();
  const m=String(current.getUTCMonth()+1).padStart(2,"0");
  const d=String(current.getUTCDate()).padStart(2,"0");
  result.push(`${y}-${m}-${d}`);
  current.setUTCDate(current.getUTCDate()+1)
 }
 return result
}
function short(d){
 const [y,m,day]=d.split("-").map(Number);
 const x=new Date(Date.UTC(y,m-1,day));
 return `${m}/${day} ${"일월화수목금토"[x.getUTCDay()]}`
}
function money(n){return `${state.trip.currency||"₩"} ${Number(n).toLocaleString()}`}
function tripLength(){
 const a=new Date(state.trip.start+"T00:00:00"),b=new Date(state.trip.end+"T00:00:00");
 return Math.max(1,Math.round((b-a)/86400000)+1)
}
function packingProgress(){
 const items=state.packing.filter(c=>c.id!=="outfits").flatMap(c=>c.items||[]);
 return {done:items.filter(x=>x.done).length,total:items.length}
}
function flightCard(f){if(!f)return "";return `<div class="flight card ${f.type==="귀국"?"return":""}">
<div class="label">✈ ${f.type} 항공편</div>
<div class="sub">${f.date} · ${f.number} · ${f.airline}</div>
<div class="route"><div class="airport"><b>${f.depart}</b><small>${f.from}<br>${f.fromName}</small></div><div class="plane"><span>✈</span><div class="sub">${f.duration}</div></div><div class="airport"><b>${f.arrive}</b><small>${f.to}<br>${f.toName}</small></div></div>
<div class="flightmeta"><span>예약번호 ${state.trip.booking||"-"}</span><span>수하물 ${f.baggage||"15kg"}</span></div>
</div>`}
function homeRender(){
 const p=packingProgress();
 const scheduleCount=Object.values(state.schedules||{}).reduce((n,list)=>n+(list||[]).length,0);
 $("home").innerHTML=`
 <div class="brandbar">
   <div class="wordmark"><span class="mark">T</span><span>TRIP LOG</span></div>
   <button class="profiledot" onclick="editTrip()" aria-label="여행 정보 수정">✦</button>
 </div>
 <section class="newhero card">
   <div class="hero-grid"></div>
   <div class="eyebrow">YOUR NEXT JOURNEY</div>
   <h2>${state.trip.name}</h2>
   <div class="hero-date">${short(state.trip.start)} — ${short(state.trip.end)} · ${tripLength()}일</div>
   <div class="route-badge"><span>${state.flights[0]?.from||"DEP"}</span><i>→</i><span>${state.flights[0]?.to||"ARR"}</span></div>
   <div class="hero-orbit orbit1"></div><div class="hero-orbit orbit2"></div>
 </section>
 <section class="status-grid">
   <button class="status-card" onclick="goPage('schedule')"><span class="status-icon">◷</span><b>${scheduleCount}</b><small>등록한 일정</small></button>
   <button class="status-card" onclick="goPage('packing')"><span class="status-icon">✓</span><b>${p.done}/${p.total}</b><small>준비 완료</small></button>
   <button class="status-card" onclick="goPage('ledger')"><span class="status-icon">₩</span><b>${money(state.expenses.reduce((a,b)=>a+b.amount,0))}</b><small>현재 지출</small></button>
 </section>
 ${state.sharedDataLoaded?`<div class="section-label"><span>FLIGHT</span><small>항공편 정보</small></div>
 ${flightCard(state.flights[0])}${flightCard(state.flights[1])}`:`<button class="card" style="width:100%;padding:18px;text-align:left;background:#fff" onclick="$('sharedDataInput').click()"><b style="display:block;font-size:15px">공통 여행 데이터를 불러와 주세요</b><small class="sub" style="display:block;margin-top:6px;line-height:1.6">동행자에게 받은 JSON을 선택하면 항공편과 숙소·체크인 정보가 이 기기에 저장됩니다.</small></button>`}`
}
function miniIcon(t){const m={calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',bag:'<svg viewBox="0 0 24 24"><rect x="6" y="7" width="12" height="14" rx="3"/><path d="M9 7V5h6v2"/></svg>',wallet:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/></svg>',map:'<svg viewBox="0 0 24 24"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/></svg>',note:'<svg viewBox="0 0 24 24"><path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5" fill="#7650c8" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="#7650c8" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="#7650c8" stroke="none"/></svg>'};return m[t]}
function setScheduleDay(value){day=value;scheduleRender()}
function moveScheduleDay(offset){
 const all=dates(),current=all.indexOf(day),next=current+offset;
 if(next<0||next>=all.length){toastMsg(offset>0?"마지막 날짜예요":"첫 번째 날짜예요");return}
 day=all[next];scheduleRender()
}
function bindScheduleSwipe(){
 const area=$("scheduleSwipeArea");if(!area)return;
 let startX=0,startY=0,tracking=false;
 area.addEventListener("pointerdown",event=>{
  if(event.target.closest("button,input,textarea,select,a"))return;
  tracking=true;startX=event.clientX;startY=event.clientY
 });
 area.addEventListener("pointerup",event=>{
  if(!tracking)return;tracking=false;
  const dx=event.clientX-startX,dy=event.clientY-startY;
  if(Math.abs(dx)<55||Math.abs(dx)<=Math.abs(dy)*1.2)return;
  moveScheduleDay(dx<0?1:-1)
 });
 area.addEventListener("pointercancel",()=>{tracking=false});
}
function scheduleRender(){
 const list=state.schedules[day]||[];
 $("schedule").innerHTML=`<div class="top"><h1>일정</h1><button class="plus" onclick="openScheduleSheet()">＋</button></div>
 <div id="scheduleDates" class="dates">${dates().map(d=>`<button class="chip ${d===day?"active":""}" onclick="setScheduleDay('${d}')">${short(d)}</button>`).join("")}</div>
 <div id="scheduleSwipeArea" class="schedule-swipe-area">
  <div class="swipe-hint">화면을 좌우로 넘겨 날짜를 변경할 수 있어요</div>
  <div class="schedule card">${list.length?list.map((x,i)=>`<div class="row">
   <span class="time">${esc(x.time)}</span><div class="copy"><b>${esc(x.title)}</b><small>${esc(x.memo||"")}</small></div>
   <div class="rowactions"><button class="editbtn" onclick="editSchedule(${i})">편집</button><button class="deletebtn" onclick="deleteSchedule(${i})">삭제</button></div></div>`).join(""):`<div class="sub" style="padding:30px;text-align:center">일정이 없어요.</div>`}</div>
 </div>
 <button class="bigbtn" onclick="openScheduleSheet()">＋ 일정 추가</button>`;
 bindScheduleSwipe();
 requestAnimationFrame(()=>$("scheduleDates")?.querySelector(".active")?.scrollIntoView({behavior:"smooth",inline:"center",block:"nearest"}))
}
function packingRender(){
 const packingCats=[...state.packing].sort((a,b)=>a.id==="outfits"?-1:(b.id==="outfits"?1:0));
 const categories=packingCats.length?`<div class="jump">${packingCats.map((c,i)=>`<button class="chip ${i===0?"active":""}" onclick="$('cat-${c.id}').scrollIntoView({behavior:'smooth'})">${esc(c.icon)}<br>${esc(c.name)}</button>`).join("")}</div>`:"";
 const cards=packingCats.length?packingCats.map(c=>{
  const count=c.id==="outfits"?dates().length:(c.items||[]).filter(x=>x.done).length+" / "+(c.items||[]).length;
  const body=c.id==="outfits"?dates().map((d,i)=>`<div class="row outfitrow"><span class="time">${short(d)}</span><div class="copy"><b>${esc(state.outfits[i]||"코디 미정")}</b></div><div class="rowactions"><button class="editbtn" onclick="editOutfit(${i})">편집</button></div></div>`).join(""):(c.items||[]).map((x,i)=>`<div class="row"><input class="check" type="checkbox" ${x.done?"checked":""} onchange="togglePack('${c.id}',${i},this.checked)"><div class="copy"><b>${esc(x.t)}</b></div><div class="rowactions"><button class="editbtn" onclick="editPackItem('${c.id}',${i})">편집</button><button class="deletebtn" onclick="deletePackItem('${c.id}',${i})">삭제</button></div></div>`).join("");
  const addRow=c.id==="outfits"?"":`<div class="addrow"><input id="in-${c.id}" placeholder="${esc(c.name)} 항목 추가" onkeydown="if(event.key==='Enter')addItem('${c.id}')"><button class="smallbtn" onclick="addItem('${c.id}')">추가</button></div>`;
  return `<div id="cat-${c.id}" class="cat card"><div class="cathead"><h3>${esc(c.icon)} ${esc(c.name)}</h3><div class="catmeta"><span class="count">${count}</span><div class="category-actions"><button class="editbtn" onclick="editPackingCategory('${c.id}')">카테고리 편집</button><button class="deletebtn" onclick="deletePackingCategory('${c.id}')">삭제</button></div></div></div>${body}${addRow}</div>`
 }).join(""):`<div class="card category-empty">아직 준비물 카테고리가 없어요.<br>상단의 ‘카테고리 추가’를 눌러 만들어 주세요.</div>`;
 $("packing").innerHTML=`<div class="top"><div><h1>준비물</h1><div class="sub" style="margin-top:4px">${state.trip.start} ~ ${state.trip.end}</div></div><div class="top-actions"><button class="smallbtn" onclick="openPackingCategorySheet()">＋ 카테고리</button></div></div>${categories}${cards}`
}
function ledgerRender(){
 const totalSpent=state.expenses.reduce((a,b)=>a+b.amount,0);
 const remain=state.budget-totalSpent;
 const pct=state.budget>0?Math.min(100,Math.round(totalSpent/state.budget*100)):0;
 const daily=state.expenses.filter(e=>(e.date||state.trip.start)===ledgerDay);
 const dailySpent=daily.reduce((a,b)=>a+b.amount,0);
 $("ledger").innerHTML=`<div class="top"><h1>가계부</h1></div>
 <div class="budget card">
   <div class="budgethead">
     <div><span class="sub">여행 예산</span><div class="amount">${money(state.budget)}</div></div>
     <button class="addlink" onclick="editBudget()">예산 설정</button>
   </div>
   <div style="display:flex;justify-content:space-between;align-items:flex-end;margin:18px 0 12px;padding:14px 15px;border-radius:17px;background:#f2ebff">
     <div><span class="sub">총 지출</span><div class="amount" style="font-size:27px;color:#6b44bd">${money(totalSpent)}</div></div>
     <div style="text-align:right"><span class="sub">남은 예산</span><div style="font-size:17px;font-weight:900">${money(Math.max(remain,0))}</div></div>
   </div>
   <div class="bar"><i style="width:${pct}%"></i></div>
   <div class="budgetstats"><span>예산 사용률 ${pct}%</span><span>${totalSpent>state.budget?"예산 초과 "+money(totalSpent-state.budget):"사용 가능 "+money(Math.max(remain,0))}</span></div>
 </div>
 <div style="margin:16px 3px 8px;font-size:13px;font-weight:900">일자별 지출</div>
 <div class="dates">${dates().map(d=>`<button class="chip ${d===ledgerDay?"active":""}" onclick="ledgerDay='${d}';ledgerRender()">${short(d)}</button>`).join("")}</div>
 <div class="card" style="padding:15px;margin-top:11px"><div><span class="sub">${short(ledgerDay)} 지출</span><div class="amount" style="font-size:23px">${money(dailySpent)}</div></div></div>
 <div class="fast card"><b>빠른 입력</b><div class="fastcats">${["식비","교통","쇼핑","편의점","관광","기타"].map(c=>`<button class="${expenseCat===c?"active":""}" onclick="expenseCat='${c}';ledgerRender()">${c}</button>`).join("")}</div><div class="fastrow"><input id="amt" type="number" inputmode="numeric" placeholder="${short(ledgerDay)} · ${expenseCat} 금액"><button onclick="addExpense()">저장</button></div></div>
 <div class="expenses card">${daily.length?daily.map(e=>{const idx=state.expenses.indexOf(e);return `<div class="exp"><div class="copy"><b>${e.title}</b><small>${e.time} · ${e.cat}</small></div><strong>${money(e.amount)}</strong><div class="rowactions" style="margin-left:8px"><button class="editbtn" onclick="editExpense(${idx})">편집</button><button class="deletebtn" onclick="deleteExpense(${idx})">삭제</button></div></div>`}).join(""):`<div class="sub" style="padding:28px;text-align:center">이 날짜에는 아직 지출이 없어요.</div>`}</div>`
}
function stayCard(){
 const p=state.stayInfo||defaults.stayInfo||{};
 const summary=[p.stayName,p.room].filter(Boolean).map(esc).join(" · ");
 const mapUrl=safeExternalUrl(p.mapUrl),guestFormUrl=safeExternalUrl(p.guestFormUrl);
 return `<div class="guide-card card">
 <h3>🏠 숙소 정보</h3>
 <div class="sub">${summary||"숙소 정보 미입력"}</div>
 <div class="gaddr">${p.address?esc(p.address).replaceAll("\n","<br>"):"주소 미입력"}<br><br><b>🚌 공항에서 가는 법:</b><br>국내선 터미널 <span class="arw">➞</span> 신치토세 공항 리무진 버스 <span class="arw">➞</span> 프리미어 호텔 츠바키(S19) 하차 <span class="arw">➞</span> 도보 800m</div>
 <details><summary><span>🔑 체크인 및 예약 정보</span></summary><div class="gbody">
 <div class="groute">예약 번호: <strong>${esc(p.bookingCode)||"미입력"}</strong><br>체크인: <strong>${esc(p.checkinNote)||"미입력"}</strong> · 체크아웃: <strong>${esc(p.checkoutNote)||"미입력"}</strong><br>맵코드: ${esc(p.mapCode)||"미입력"}${mapUrl?` · <a href="${esc(mapUrl)}" target="_blank" rel="noopener">지도 열기</a>`:""}</div>
 ${p.guestNote?`<div class="gmeta"><span class="gwarn">⚠ ${esc(p.guestNote)}</span></div>`:""}
 ${guestFormUrl?`<div class="gmeta"><a href="${esc(guestFormUrl)}" target="_blank" rel="noopener">투숙객 정보 제출 폼</a> — 링크를 일행에게 공유하면 각자 제출할 수 있습니다.</div>`:""}
 <div class="gnote">※ 늦은 체크아웃 시 1일 요금의 2배 청구<br>※ 침구 특별 요청은 체크인 72시간 전까지<br>※ 일회용 칫솔 미제공 — 칫솔을 꼭 챙겨 주세요.</div>
 </div></details>
 <button class="smallbtn" style="margin-top:11px" onclick="editStayInfo()">숙소 및 체크인 정보 수정</button>
 </div>`
}
function guideRender(){$("guide").innerHTML=`<div class="top"><div><h1>가이드</h1><div class="sub" style="margin-top:4px">삿포로 워케이션 정보 모음</div></div></div>
<div class="guide">

${stayCard()}

<div class="guide-card card">
<h3>🎫 예약 정보</h3>
<div class="sub">공항버스 · 투어 · 식당 예약</div>
<details>
<summary><span>🚌 출국일 공항버스</span><span class="gtag">8/8 · 11:10 수원역</span></summary>
<div class="gbody">
<div class="groute">수원역 <strong>11:10 출발</strong> (예약 완료) <span class="arw">➞</span> 인천공항 2터미널</div>
<div class="gnote">공항 도착 후 할 일: ① 면세품 인도 ② 공항에서 점심 (15:25 출발이라 여유 있음)</div>
</div>
</details>
<details>
<summary><span>오타루 + 샤코탄 일일 투어</span><span class="gtag blue">8/9 (일) 07:30 집결</span></summary>
<div class="gbody">
<div class="groute"><strong>집결: 07:30 삿포로역 북광장</strong></div>
<table class="gtable"><tr><th>시간</th><th>일정</th></tr><tr><td>07:30</td><td>만남 (집결지: 삿포로역 북광장)</td></tr><tr><td>07:50</td><td>출발</td></tr><tr><td>08:40</td><td>부처의 언덕 (1시간 이상 체류)</td></tr><tr><td>11:00</td><td>오타루 (3시간 이상 체류)</td></tr><tr><td>15:20</td><td>샤코탄 시마무이 해안 (30분 이상 체류)</td></tr><tr><td>16:10</td><td>샤코탄 카무이미사키 (40분~1시간 이상 체류)</td></tr><tr><td>18:55</td><td>키나야마 휴게</td></tr><tr><td>19:35</td><td>경유지 스스키노 (하차: 다이와 로이네트 호텔 스스키노)</td></tr><tr><td>19:45</td><td>도착 (삿포로역)</td></tr></table>
<div class="gnote">※ 숙소 → 삿포로역: 가쿠엔마에역에서 도호선, 약 25분 → 늦어도 <strong>7:00 전 숙소 출발</strong> 권장 (일요일 첫차 시간대라 여유 있게!)<br>※ 돌아올 때 스스키노 하차 후 저녁 먹고 들어가는 것도 옵션</div>
</div>
</details>
<details>
<summary><span>스시 오마카세 (Magazzino)</span><span class="gtag">8/11 (화) 20:30</span></summary>
<div class="gbody">주소: 4 Chome-23 Minami 2 Jonishi, Chuo Ward, Sapporo, Hokkaido 060-0062<br><span class="gnote">스스키노/오도리 인근 — 도자이선 오도리역 또는 도호선 호스이스스키노역에서 도보권</span></div>
</details>
</div>

<div class="guide-card card">
<h3>🚇 교통편</h3>
<div class="sub">숙소 제공 자료 + 리무진 버스 팁</div>
<details>
<summary><span>🚉 가까운 역 · 정류장</span></summary>
<div class="gbody">
<details><summary><span>가쿠엔마에역 (学園前駅)</span><span class="gtag blue">도보 8분 · 600m</span></summary><div class="gbody">지하철 <strong>도호선(Toho Line)</strong><br>※ <strong>4번 출구</strong> 근처에 엘리베이터가 있습니다.</div></details>
<details><summary><span>기쿠스이역 (菊水駅)</span><span class="gtag blue">도보 10분 · 800m</span></summary><div class="gbody">지하철 <strong>도자이선(Tozai Line)</strong><br>※ <strong>3번 출구</strong> 근처에 엘리베이터가 있습니다.<br>※ 짐이 많지 않은 경우 <strong>6번 출구</strong>로 나오면 아파트까지 약 <strong>550m</strong>.</div></details>
<details><summary><span>S19 프리미어 호텔 츠바키 버스 정류장</span><span class="gtag blue">도보 10분 · 800m</span></summary><div class="gbody">S19 プレミアホテルTSUBAKI — 신치토세공항 셔틀(리무진 버스) 정류장.</div></details>
</div>
</details>
<details>
<summary><span>🛬 신치토세공항 → 숙소 (3가지 방법)</span></summary>
<div class="gbody">
<details><summary><span>① JR + 도호선</span><span class="gtag blue">¥1,890 · 약 1시간 7분</span></summary><div class="gbody"><div class="groute">신치토세공항 <span class="arw">➞</span> JR 쾌속 에어포트 <span class="arw">➞</span> JR 삿포로역 <span class="arw">➞</span> 도보 8분 <span class="arw">➞</span> 삿포로 지하철역 <span class="arw">➞</span> 도호선 <span class="arw">➞</span> 가쿠엔마에역 (엘리베이터 · 4번 출구) <span class="arw">➞</span> 도보 600m <span class="arw">➞</span> 아파트</div><div class="gmeta">요금 <strong>¥1,890</strong> · 약 1시간 7분</div></div></details>
<details><summary><span>② JR + 도자이선</span><span class="gtag blue">¥1,700 · 약 1시간 2분</span></summary><div class="gbody"><div class="groute">신치토세공항 <span class="arw">➞</span> JR 쾌속 에어포트 <span class="arw">➞</span> JR 신삿포로역 <span class="arw">➞</span> 도보 4분 <span class="arw">➞</span> 신삿포로 지하철역 <span class="arw">➞</span> 도자이선 <span class="arw">➞</span> 기쿠스이역 (엘리베이터 · 3번 출구) <span class="arw">➞</span> 도보 800m <span class="arw">➞</span> 아파트</div><div class="gmeta">요금 <strong>¥1,700</strong> · 약 1시간 2분</div></div></details>
<details><summary><span>③ 공항 리무진 버스</span><span class="gtag green">¥1,500 · 약 53분</span></summary><div class="gbody"><div class="groute">신치토세공항 (국제선 터미널) <span class="arw">➞</span> 공항 리무진 버스 <span class="arw">➞</span> S19 프리미어 호텔 츠바키 정류장 <span class="arw">➞</span> 도보 800m <span class="arw">➞</span> 아파트</div><div class="gmeta">요금 <strong>¥1,500</strong> · 약 53분</div><div class="gnote">※ 숙소 안내문에는 ¥1,100으로 되어 있으나 2026년 4월부터 ¥1,500으로 인상됨<br>※ 날씨·교통 사정에 따라 도착이 늦어질 수 있습니다. 항공편 연계 시 여유를 두고 이용하세요.</div></div></details>
</div>
</details>
<details>
<summary><span>🎟 리무진 버스 타는 법 &amp; 결제 팁</span></summary>
<div class="gbody">
<details><summary><span>어디서 타나 (자리 잡기 팁)</span></summary><div class="gbody">공항 내 정차 순서: <strong>국내선 ANA도착구(22번)</strong> <span class="arw">➞</span> <strong>국내선 JAL도착구(14번)</strong> <span class="arw">➞</span> <strong>국제선 터미널(84번)</strong> <span class="arw">➞</span> 삿포로 시내<br><br>국제선이 <strong>마지막 정차</strong>라 자리 선택권이 적음. 국내선 쪽이 식당도 훨씬 많으니 <strong>연결통로로 국내선 이동(도보 약 10분) → 저녁 식사 → 국내선 22번(ANA쪽) 승차장에서 탑승</strong>이 최적 동선. 첫 정류장이라 원하는 자리에 앉을 수 있음.<br><span class="gnote">※ 승차장은 국내선·국제선 모두 1층 도착 로비 바로 앞. 국내선 1층에 매표 카운터·자판기 있음 (프리미어호텔 츠바키 = 札幌都心선/후쿠즈미역 경유, 시간당 4대)</span></div></details>
<details><summary><span>⚠ 노선 확인 필수 — 아무 버스나 타면 안 됨</span></summary><div class="gbody">신치토세공항발 리무진은 <strong>11개 노선</strong>이 있고, 프리미어호텔 츠바키에 서는 건 <strong>札幌都心선 (삿포로 토신 / Sapporo Toshin · 후쿠즈미역 경유)</strong> 딱 하나.<br><br>· 버스 전면/승차장 표시에서 <strong>「札幌都心」(삿포로 토신 / Sapporo Toshin) + 「福住駅経由」(후쿠즈미에키 케이유 / Fukuzumi-eki keiyu)</strong> 확인<br>· <strong>「札幌都心 直行便」(삿포로 토신 촛코빈 / Chokkōbin = 직행편)은 다른 노선!</strong> — 삿포로역·스스키노 직행이라 츠바키에 안 섬<br>· 마코마나이·마루야마·오타루행 등도 당연히 X<br>· 헷갈리면 기사에게 "프리미어 호테루 츠바키?" 하고 확인 (버스 색은 무관 — 빨강/초록 모두 같은 노선 공동 운행)<br><br><span class="gnote">※ 국내선 22번 승차장은 도심선(후쿠즈미 경유) 전용이라 비교적 안전하지만, 국제선 84번은 여러 노선이 같이 쓰니 특히 주의</span></div></details>
<details><summary><span>예약 필요? 못 앉으면?</span></summary><div class="gbody"><strong>예약제 아님 — 전 좌석 선착순</strong>이고 애초에 좌석 예약이 불가능한 노선. 입석은 없어서 만석이면 다음 차를 타야 하지만 15분 간격이라 부담 없음. 혼잡 시엔 보조석을 운영하기도 함. 저녁 8시대 삿포로행은 러시 시간대도 아니라 크게 걱정할 필요 없음.</div></details>
<details><summary><span>이코카(ICOCA) 사용 — 주의!</span></summary><div class="gbody">두 회사가 공동 운행하는데 <strong>어느 회사 차가 올지는 복불복</strong>:<br><br>· <strong>중앙버스 (빨간 차체)</strong>: 이코카 등 전국 교통계 IC 카드 <strong>사용 가능</strong><br>· <strong>호쿠토교통 (초록 차체)</strong>: 교통계 IC 카드 <strong>사용 불가</strong> — 현금, 신용카드 터치결제, PayPay는 가능<br><br><span class="gnote">※ 초록 버스가 와도 당황하지 않도록 <strong>터치결제 되는 카드(트래블 카드)나 현금을 백업으로</strong> 준비. 또는 1층 카운터/자판기에서 표를 미리 사면 어느 회사 버스든 탑승 가능.</span></div></details>
</div>
</details>
<details>
<summary><span>🚌 공항 셔틀버스 시간표</span></summary>
<div class="gbody">
<details><summary><span>공항(국제선) → 호텔 츠바키</span><span class="gtag">첫차 8:46 · 막차 22:41</span></summary><div class="gbody"><div class="gtimes"><span>8:46</span><span>9:01</span><span>9:16</span><span>9:31</span><span>9:46</span><span>10:01</span><span>10:16</span><span>10:31</span><span>10:46</span><span>11:01</span><span>11:16</span><span>11:31</span><span>11:46</span><span>12:01</span><span>12:16</span><span>12:31</span><span>12:46</span><span>13:01</span><span>13:16</span><span>13:31</span><span>13:46</span><span>14:01</span><span>14:16</span><span>14:31</span><span>14:46</span><span>15:01</span><span>15:16</span><span>15:31</span><span>15:46</span><span>16:01</span><span>16:16</span><span>16:31</span><span>16:46</span><span>17:01</span><span>17:16</span><span>17:31</span><span>17:46</span><span>18:01</span><span>18:16</span><span>18:31</span><span>18:46</span><span>19:01</span><span>19:16</span><span>19:31</span><span>19:46</span><span>20:01</span><span>20:16</span><span>20:31</span><span>20:46</span><span>21:01</span><span>21:21</span><span>21:41</span><span>22:01</span><span>22:21</span><span>22:41</span></div><div class="gnote">8:46~21:01은 15분 간격, 이후 20분 간격</div></div></details>
<details><summary><span>호텔 츠바키 → 공항(국제선)</span><span class="gtag">첫차 5:28 · 막차 18:28</span></summary><div class="gbody"><div class="gtimes"><span>5:28</span><span>5:33</span><span>5:53</span><span>6:13</span><span>6:28</span><span>6:43</span><span>6:58</span><span>7:13</span><span>7:28</span><span>7:43</span><span>7:58</span><span>8:13</span><span>8:28</span><span>8:43</span><span>8:58</span><span>9:13</span><span>9:28</span><span>9:43</span><span>9:58</span><span>10:13</span><span>10:28</span><span>10:43</span><span>10:58</span><span>11:13</span><span>11:28</span><span>11:43</span><span>11:58</span><span>12:13</span><span>12:28</span><span>12:43</span><span>12:58</span><span>13:13</span><span>13:28</span><span>13:43</span><span>13:58</span><span>14:13</span><span>14:28</span><span>14:43</span><span>14:58</span><span>15:13</span><span>15:28</span><span>15:43</span><span>15:58</span><span>16:13</span><span>16:28</span><span>16:43</span><span>16:58</span><span>17:13</span><span>17:28</span><span>17:43</span><span>17:58</span><span>18:13</span><span>18:28</span></div><div class="gnote">※ 8/14(금) 12:10 출발 항공편 → 여유 있게 <strong>9:13~9:43</strong> 버스 권장 (약 53분 소요)</div></div></details>
</div>
</details>
<details>
<summary><span>🗼 삿포로 관광지 가는 법</span></summary>
<div class="gbody"><details><summary><span>JR 타워 (JRタワー)</span><span class="gtag blue">¥210 · 25분</span></summary><div class="gbody"><div class="groute">아파트 <span class="arw">➞</span> 도보 600m <span class="arw">➞</span> 가쿠엔마에역 <span class="arw">➞</span> 도호선 <span class="arw">➞</span> 삿포로역 <span class="arw">➞</span> 도보 450m</div><div class="gmeta">거리 3.1km · 요금 <strong>¥210</strong> · 25분</div></div></details><details><summary><span>삿포로시 시계탑 (札幌市時計台)</span><span class="gtag blue">¥210 · 21분</span></summary><div class="gbody"><div class="groute">아파트 <span class="arw">➞</span> 도보 600m <span class="arw">➞</span> 가쿠엔마에역 <span class="arw">➞</span> 도호선 <span class="arw">➞</span> 오도리역 <span class="arw">➞</span> 도보 350m</div><div class="gmeta">거리 2.5km · 요금 <strong>¥210</strong> · 21분</div></div></details><details><summary><span>삿포로 TV 타워 (さっぽろテレビ塔)</span><span class="gtag blue">¥210 · 19분</span></summary><div class="gbody"><div class="groute">아파트 <span class="arw">➞</span> 도보 600m <span class="arw">➞</span> 가쿠엔마에역 <span class="arw">➞</span> 도호선 <span class="arw">➞</span> 오도리역 <span class="arw">➞</span> 도보 240m</div><div class="gmeta">거리 2km · 요금 <strong>¥210</strong> · 19분</div></div></details><details><summary><span>다누키코지 상점가 (狸小路商店街)</span><span class="gtag blue">¥210 · 22분</span></summary><div class="gbody"><div class="groute">아파트 <span class="arw">➞</span> 도보 550m <span class="arw">➞</span> 기쿠스이역 <span class="arw">➞</span> 도자이선 <span class="arw">➞</span> 오도리역 <span class="arw">➞</span> 도보 500m</div><div class="gmeta">거리 2.5km · 요금 <strong>¥210</strong> · 22분</div></div></details><details><summary><span>오도리 공원 (大通公園)</span><span class="gtag blue">¥210 · 19분</span></summary><div class="gbody"><div class="groute">아파트 <span class="arw">➞</span> 도보 600m <span class="arw">➞</span> 가쿠엔마에역 <span class="arw">➞</span> 도호선 <span class="arw">➞</span> 오도리역 <span class="arw">➞</span> 도보 250m</div><div class="gmeta">거리 3.1km · 요금 <strong>¥210</strong> · 19분</div></div></details><details><summary><span>니조시장 (二条市場)</span><span class="gtag blue">¥210 · 21분</span></summary><div class="gbody"><div class="groute">아파트 <span class="arw">➞</span> 도보 550m <span class="arw">➞</span> 기쿠스이역 <span class="arw">➞</span> 도자이선 <span class="arw">➞</span> 버스센터마에역 <span class="arw">➞</span> 도보 600m</div><div class="gmeta">거리 1.9km · 요금 <strong>¥210</strong> · 21분</div></div></details><details><summary><span>스스키노 (すすきの)</span><span class="gtag blue">¥210 · 19분</span></summary><div class="gbody"><div class="groute">아파트 <span class="arw">➞</span> 도보 600m <span class="arw">➞</span> 가쿠엔마에역 <span class="arw">➞</span> 도호선 <span class="arw">➞</span> 호스이스스키노역 <span class="arw">➞</span> 도보 450m</div><div class="gmeta">거리 1.9km · 요금 <strong>¥210</strong> · 19분</div></div></details><details><summary><span>시로이코이비토 파크 (白い恋人パーク)</span><span class="gtag blue">¥290 · 41분</span></summary><div class="gbody"><div class="groute">아파트 <span class="arw">➞</span> 도보 550m <span class="arw">➞</span> 기쿠스이역 <span class="arw">➞</span> 도자이선 <span class="arw">➞</span> 미야노사와역 <span class="arw">➞</span> 도보 550m</div><div class="gmeta">거리 10.6km · 요금 <strong>¥290</strong> · 41분</div></div></details><details><summary><span>나카지마 공원 (中島公園)</span><span class="gtag blue">¥250 · 28분</span></summary><div class="gbody"><div class="groute">아파트 <span class="arw">➞</span> 도보 550m <span class="arw">➞</span> 기쿠스이역 <span class="arw">➞</span> 도자이선 <span class="arw">➞</span> 오도리역 <span class="arw">➞</span> 난보쿠선 환승 <span class="arw">➞</span> 호로히라바시역 <span class="arw">➞</span> 도보 220m</div><div class="gmeta">거리 1.7km · 요금 <strong>¥250</strong> · 28분</div></div></details><details><summary><span>마루야마 공원 (円山公園)</span><span class="gtag blue">¥250 · 29분</span></summary><div class="gbody"><div class="groute">아파트 <span class="arw">➞</span> 도보 550m <span class="arw">➞</span> 기쿠스이역 <span class="arw">➞</span> 도자이선 <span class="arw">➞</span> 마루야마코엔역 <span class="arw">➞</span> 도보 600m</div><div class="gmeta">거리 6km · 요금 <strong>¥250</strong> · 29분</div></div></details><details><summary><span>홋카이도 신궁 (北海道神宮)</span><span class="gtag blue">¥460 · 41분</span></summary><div class="gbody"><div class="groute">아파트 <span class="arw">➞</span> 도보 550m <span class="arw">➞</span> 기쿠스이역 <span class="arw">➞</span> 도자이선 <span class="arw">➞</span> 마루야마코엔역 <span class="arw">➞</span> 도보 180m <span class="arw">➞</span> 마루야마코엔에키마에 버스 정류장 <span class="arw">➞</span> 버스 動物園線 (도부츠엔선 / Dōbutsuen Line) [循環円16 / 循環円15 / 円16 / 円15 (준칸 엔 / Junkan En = 순환 마루)] 또는 荒井山線 (아라이야마선 / Araiyama Line) [循環円14 / 円14] <span class="arw">➞</span> 北海道神宮 (홋카이도 진구 / Hokkaidō Jingū) 정류장 <span class="arw">➞</span> 도보 350m</div><div class="gmeta">거리 6.4km · 요금 <strong>¥460</strong> · 41분</div></div></details><details><summary><span>마루야마 동물원 (円山動物園)</span><span class="gtag blue">¥460 · 41분</span></summary><div class="gbody"><div class="groute">아파트 <span class="arw">➞</span> 도보 550m <span class="arw">➞</span> 기쿠스이역 <span class="arw">➞</span> 도자이선 <span class="arw">➞</span> 마루야마코엔역 <span class="arw">➞</span> 도보 180m <span class="arw">➞</span> 마루야마코엔에키마에 버스 정류장 <span class="arw">➞</span> 버스 動物園線 (도부츠엔선 / Dōbutsuen Line) [循環円16 / 循環円15 / 円16 / 円15 (준칸 엔 / Junkan En)] <span class="arw">➞</span> 円山動物園西門 (마루야마 도부츠엔 니시몬 / Maruyama Zoo West Gate) 정류장 <span class="arw">➞</span> 도보 400m</div><div class="gmeta">거리 6.2km · 요금 <strong>¥460</strong> · 41분</div></div></details><details><summary><span>모이와 산 (藻岩山)</span><span class="gtag blue">¥1,230 · 1시간 9분</span></summary><div class="gbody"><div class="groute">아파트 <span class="arw">➞</span> 도보 550m <span class="arw">➞</span> 기쿠스이역 <span class="arw">➞</span> 도자이선 <span class="arw">➞</span> 니시주잇초메역 <span class="arw">➞</span> 도보 약 4분 <span class="arw">➞</span> 주오구야쿠쇼마에 노면전차 정거장 <span class="arw">➞</span> 트램 <span class="arw">➞</span> 로프웨이 이리구치 정거장 <span class="arw">➞</span> 도보 68m <span class="arw">➞</span> 무료 셔틀버스 <span class="arw">➞</span> 모이와 산로쿠역 <span class="arw">➞</span> 로프웨이 <span class="arw">➞</span> 정상</div><div class="gmeta">거리 9.7km · 요금 <strong>¥1,230</strong> · 1시간 9분</div></div></details></div>
</details>
</div>
</div>`}
function moreRender(){
 const standalone=window.matchMedia("(display-mode: standalone)").matches;
 $("more").innerHTML=`<div class="top"><h1>기타</h1></div>
 <div class="settingCard card">
 <div class="settingRow" onclick="editTrip()"><span class="settingIcon">✏️</span><div class="settingCopy"><b>여행 정보 수정</b><small>여행명, 기간, 항공 예약번호 수정</small></div><span>›</span></div>
 <div class="settingRow" onclick="editStayInfo()"><span class="settingIcon">🏠</span><div class="settingCopy"><b>숙소 및 체크인 정보</b><small>현재 기기에 저장된 공통 예약 정보 확인 및 수정</small></div><span>›</span></div>
 ${standalone?"":`<div class="settingRow" onclick="installApp()"><span class="settingIcon">📲</span><div class="settingCopy"><b>홈 화면에 설치</b><small>안드로이드에서 앱처럼 바로 실행</small></div><span>›</span></div>`}
 </div>
 <div style="font-size:12px;color:#7757ae;margin:16px 4px 8px">데이터 가져오기</div>
 <div class="settingCard card">
 <div class="settingRow" onclick="$('sharedDataInput').click()"><span class="settingIcon">👥</span><div class="settingCopy"><b>공통 여행 데이터 불러오기</b><small>여행·항공편·숙소 및 체크인 JSON</small></div><span>↑</span></div>
 <div class="settingRow" onclick="$('personalDataInput').click()"><span class="settingIcon">🙋</span><div class="settingCopy"><b>개인 데이터 복원</b><small>일정·준비물·코디·가계부 JSON</small></div><span>↑</span></div>
 </div>
 <div style="font-size:12px;color:#7757ae;margin:16px 4px 8px">개인 데이터 관리</div>
 <div class="settingCard card">
 <div class="settingRow" onclick="exportPersonalBackup()"><span class="settingIcon">⬇️</span><div class="settingCopy"><b>개인 데이터 백업</b><small>일정·준비물·코디·가계부만 저장</small></div><span>↓</span></div>
 <div class="settingRow" onclick="deleteTrip()"><span class="settingIcon">🗑️</span><div class="settingCopy"><b class="danger">현재 기기 데이터 초기화</b><small>불러온 공통 데이터와 개인 데이터를 모두 삭제</small></div><span>›</span></div>
 </div>
 <div class="offline-note">공통 JSON과 개인 JSON은 GitHub에 저장되지 않습니다. 한 번 불러오면 Chrome의 사이트 데이터를 직접 삭제하지 않는 한 이 기기에 유지됩니다.</div>
 <div class="notice">공통 여행 데이터는 동행자 모두가 같은 파일을 불러오고, 일정·준비물·가계부는 각자 별도의 개인 데이터로 관리합니다.</div>`
}

function openScheduleSheet(){$("sheetbody").innerHTML=`<h3>새 일정 추가</h3><div class="sheetgrid"><input id="stime" type="time" value="19:00"><input id="stitle" placeholder="일정 이름"><input id="smemo" placeholder="장소 또는 메모"></div><div class="sheetactions"><button class="secondary" onclick="closeSheet()">취소</button><button class="primary" onclick="saveSchedule()">추가</button></div>`;$("sheetback").classList.add("show")}
function closeSheet(){$("sheetback").classList.remove("show")}
function saveSchedule(){const title=$("stitle").value.trim();if(!title)return toastMsg("일정 이름을 입력해 주세요");(state.schedules[day]??=[]).push({time:$("stime").value||"19:00",title,memo:$("smemo").value.trim()});save();closeSheet();scheduleRender();toastMsg("일정을 추가했어요")}
function editSchedule(i){
 const x=(state.schedules[day]||[])[i];if(!x)return;
 $("sheetbody").innerHTML=`<h3>일정 편집</h3><div class="sheetgrid"><input id="stime" type="time" value="${x.time}"><input id="stitle" value="${x.title}" placeholder="일정 이름"><input id="smemo" value="${x.memo||""}" placeholder="장소 또는 메모"></div><div class="sheetactions"><button class="secondary" onclick="closeSheet()">취소</button><button class="primary" onclick="saveScheduleEdit(${i})">저장</button></div>`;
 $("sheetback").classList.add("show")
}
function saveScheduleEdit(i){
 const x=(state.schedules[day]||[])[i],title=$("stitle").value.trim();if(!x||!title)return toastMsg("일정 이름을 입력해 주세요");
 x.time=$("stime").value||x.time;x.title=title;x.memo=$("smemo").value.trim();save();closeSheet();scheduleRender();toastMsg("일정을 수정했어요")
}
function deleteSchedule(i){
 if(!confirm("이 일정을 삭제할까요?"))return;
 (state.schedules[day]||[]).splice(i,1);save();scheduleRender();toastMsg("일정을 삭제했어요")
}
function openPackingCategorySheet(){
 $("sheetbody").innerHTML=`<h3>준비물 카테고리 추가</h3><div class="sheetgrid"><input id="caticon" value="📦" maxlength="8" placeholder="아이콘 (예: 📦)"><input id="catname" placeholder="카테고리명"></div><div class="sheetactions"><button class="secondary" onclick="closeSheet()">취소</button><button class="primary" onclick="savePackingCategory()">추가</button></div>`;
 $("sheetback").classList.add("show");setTimeout(()=>$("catname")?.focus(),50)
}
function savePackingCategory(){
 const name=$("catname").value.trim(),icon=$("caticon").value.trim()||"📦";
 if(!name)return toastMsg("카테고리명을 입력해 주세요");
 const id=`cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
 state.packing.push({id,icon,name,items:[]});save();closeSheet();packingRender();toastMsg("카테고리를 추가했어요")
}
function editPackingCategory(id){
 const cat=state.packing.find(c=>c.id===id);if(!cat)return;
 $("sheetbody").innerHTML=`<h3>카테고리 편집</h3><div class="sheetgrid"><input id="caticon" value="${esc(cat.icon)}" maxlength="8" placeholder="아이콘"><input id="catname" value="${esc(cat.name)}" placeholder="카테고리명"></div><div class="sheetactions"><button class="secondary" onclick="closeSheet()">취소</button><button class="primary" onclick="savePackingCategoryEdit('${id}')">저장</button></div>`;
 $("sheetback").classList.add("show");setTimeout(()=>$("catname")?.focus(),50)
}
function savePackingCategoryEdit(id){
 const cat=state.packing.find(c=>c.id===id),name=$("catname").value.trim(),icon=$("caticon").value.trim()||"📦";
 if(!cat||!name)return toastMsg("카테고리명을 입력해 주세요");
 cat.name=name;cat.icon=icon;save();closeSheet();packingRender();toastMsg("카테고리를 수정했어요")
}
function deletePackingCategory(id){
 const cat=state.packing.find(c=>c.id===id);if(!cat)return;
 const itemCount=(cat.items||[]).length;
 const detail=itemCount?` 안의 준비물 ${itemCount}개도 함께 삭제됩니다.`:"";
 if(!confirm(`“${cat.name}” 카테고리를 삭제할까요?${detail}`))return;
 state.packing=state.packing.filter(c=>c.id!==id);save();packingRender();toastMsg("카테고리를 삭제했어요")
}
function togglePack(id,i,v){state.packing.find(c=>c.id===id).items[i].done=v;save();packingRender()}
function addItem(id){const el=$("in-"+id),v=el.value.trim();if(!v)return;state.packing.find(c=>c.id===id).items.push({t:v,done:false});save();packingRender()}
let outfitSel=[];
function editOutfit(i){
 const d=dates()[i];
 const cats=state.packing.filter(c=>c.id==="clothes"||c.id==="shoes");
 const chipNames=cats.flatMap(c=>(c.items||[]).map(x=>x.t));
 const current=(state.outfits[i]&&state.outfits[i]!=="코디 미정")?state.outfits[i].split(" + "):[];
 outfitSel=current.filter(t=>chipNames.includes(t));
 const extra=current.filter(t=>!chipNames.includes(t)).join(" + ");
 $("sheetbody").innerHTML=`<h3>${short(d)} 코디 조합</h3><div class="sub">아래 준비물에서 골라 조합하세요</div>`+
  cats.map(c=>`<div class="outfit-cat-label">${c.icon} ${c.name}</div><div class="look">${(c.items||[]).map(x=>`<button type="button" class="outfit-chip ${outfitSel.includes(x.t)?"active":""}" data-t="${x.t.replaceAll('"',"&quot;")}" onclick="toggleOutfitChip(this)">${x.t}</button>`).join("")||`<span class="sub">항목이 없어요 — 준비물에서 먼저 추가하세요</span>`}</div>`).join("")+
  `<div style="margin-top:12px"><input id="outfitextra" value="${extra.replaceAll('"',"&quot;")}" placeholder="직접 추가 (예: 모자, 액세서리)" oninput="updateOutfitPreview()"></div>
  <div id="outfitpreview"></div>
  <div class="sheetactions"><button class="secondary" onclick="closeSheet()">취소</button><button class="primary" onclick="saveOutfit(${i})">저장</button></div>`;
 $("sheetback").classList.add("show");
 updateOutfitPreview()
}
function toggleOutfitChip(el){
 const t=el.dataset.t,k=outfitSel.indexOf(t);
 k>-1?outfitSel.splice(k,1):outfitSel.push(t);
 el.classList.toggle("active");updateOutfitPreview()
}
function updateOutfitPreview(){
 const extra=$("outfitextra")?.value.trim();
 const all=[...outfitSel,...(extra?[extra]:[])];
 const box=$("outfitpreview");
 if(box)box.textContent=all.length?"코디: "+all.join(" + "):"아직 선택한 항목이 없어요";
}
function saveOutfit(i){
 const extra=$("outfitextra").value.trim();
 const all=[...outfitSel,...(extra?[extra]:[])];
 state.outfits[i]=all.join(" + ")||"코디 미정";
 save();closeSheet();packingRender();toastMsg("코디를 수정했어요")
}
function editPackItem(id,i){
 const cat=state.packing.find(c=>c.id===id),item=cat?.items?.[i];
 if(!item)return;
 $("sheetbody").innerHTML=`<h3>준비물 편집</h3><div class="sheetgrid"><input id="packname" value="${item.t.replaceAll('"','&quot;')}" placeholder="준비물 이름"></div><div class="sheetactions"><button class="secondary" onclick="closeSheet()">취소</button><button class="primary" onclick="savePackItem('${id}',${i})">저장</button></div>`;
 $("sheetback").classList.add("show");
 setTimeout(()=>$("packname")?.focus(),50)
}
function savePackItem(id,i){
 const value=$("packname").value.trim();
 if(!value)return toastMsg("준비물 이름을 입력해 주세요");
 const cat=state.packing.find(c=>c.id===id);
 if(!cat?.items?.[i])return;
 cat.items[i].t=value;save();closeSheet();packingRender();toastMsg("준비물을 수정했어요")
}
function deletePackItem(id,i){
 const cat=state.packing.find(c=>c.id===id),item=cat?.items?.[i];
 if(!item)return;
 if(!confirm(`“${item.t}” 항목을 삭제할까요?`))return;
 cat.items.splice(i,1);save();packingRender();toastMsg("준비물을 삭제했어요")
}
function addExpense(){
 const n=Number($("amt")?.value||0);
 if(!n)return toastMsg("금액을 입력해 주세요");
 state.expenses.unshift({title:expenseCat,cat:expenseCat,amount:n,date:ledgerDay,time:new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})});
 save();ledgerRender();toastMsg(short(ledgerDay)+" 지출을 저장했어요")
}
function openExpenseSheet(){
 $("sheetbody").innerHTML=`<h3>지출 추가</h3><div class="sheetgrid">
 <input id="edate" type="date" min="${state.trip.start}" max="${state.trip.end}" value="${ledgerDay}">
 <input id="etitle" placeholder="사용처 또는 지출 내용">
 <select id="ecat">${["식비","교통","쇼핑","편의점","관광","기타"].map(c=>`<option ${c===expenseCat?"selected":""}>${c}</option>`).join("")}</select>
 <input id="eamount" type="number" inputmode="numeric" placeholder="금액">
 <input id="etime" type="time" value="${new Date().toTimeString().slice(0,5)}">
 </div><div class="sheetactions"><button class="secondary" onclick="closeSheet()">취소</button><button class="primary" onclick="saveExpenseSheet()">저장</button></div>`;
 $("sheetback").classList.add("show")
}
function saveExpenseSheet(){
 const amount=Number($("eamount").value),date=$("edate").value,title=$("etitle").value.trim(),cat=$("ecat").value;
 if(!date||!amount)return toastMsg("날짜와 금액을 입력해 주세요");
 ledgerDay=date;expenseCat=cat;
 state.expenses.unshift({title:title||cat,cat,amount,date,time:$("etime").value||""});
 save();closeSheet();ledgerRender();toastMsg(short(date)+" 지출을 저장했어요")
}
function editExpense(i){
 const e=state.expenses[i];if(!e)return;
 $("sheetbody").innerHTML=`<h3>지출 편집</h3><div class="sheetgrid">
 <input id="edate" type="date" min="${state.trip.start}" max="${state.trip.end}" value="${e.date||state.trip.start}">
 <input id="etitle" value="${e.title||""}" placeholder="사용처 또는 지출 내용">
 <select id="ecat">${["식비","교통","쇼핑","편의점","관광","기타"].map(c=>`<option ${c===e.cat?"selected":""}>${c}</option>`).join("")}</select>
 <input id="eamount" type="number" inputmode="numeric" value="${e.amount}">
 <input id="etime" type="time" value="${e.time||""}">
 </div><div class="sheetactions"><button class="secondary" onclick="closeSheet()">취소</button><button class="primary" onclick="saveExpenseEdit(${i})">저장</button></div>`;
 $("sheetback").classList.add("show")
}
function saveExpenseEdit(i){
 const e=state.expenses[i],amount=Number($("eamount").value),date=$("edate").value,cat=$("ecat").value;
 if(!e||!date||!amount)return toastMsg("날짜와 금액을 입력해 주세요");
 e.date=date;e.title=$("etitle").value.trim()||cat;e.cat=cat;e.amount=amount;e.time=$("etime").value||"";
 ledgerDay=date;expenseCat=cat;save();closeSheet();ledgerRender();toastMsg("지출을 수정했어요")
}
function deleteExpense(i){
 if(!confirm("이 지출을 삭제할까요?"))return;
 state.expenses.splice(i,1);save();ledgerRender();toastMsg("지출을 삭제했어요")
}
function editStayInfo(){
 const p=state.stayInfo||defaults.stayInfo||{};
 $("sheetbody").innerHTML=`<h3>숙소 및 체크인 정보</h3><div class="sub" style="margin-bottom:12px">기본값은 동행자 공통 데이터이며, 여기서 수정하면 현재 기기에만 반영됩니다.</div><div class="sheetgrid">
 <input id="pstay" value="${esc(p.stayName)}" placeholder="숙소명">
 <input id="proom" value="${esc(p.room)}" placeholder="객실 정보">
 <textarea id="paddr" rows="3" placeholder="숙소 주소">${esc(p.address)}</textarea>
 <input id="pbook" value="${esc(p.bookingCode)}" placeholder="예약 번호">
 <input id="pmapcode" value="${esc(p.mapCode)}" placeholder="맵코드">
 <input id="pmapurl" type="url" value="${esc(p.mapUrl)}" placeholder="지도 URL">
 <input id="pguesturl" type="url" value="${esc(p.guestFormUrl)}" placeholder="투숙객 정보 제출 URL">
 <input id="pcheckin" value="${esc(p.checkinNote)}" placeholder="체크인 안내">
 <input id="pcheckout" value="${esc(p.checkoutNote)}" placeholder="체크아웃 안내">
 <input id="pguestnote" value="${esc(p.guestNote)}" placeholder="투숙객 제출 메모">
 </div><div class="sheetactions"><button class="secondary" onclick="closeSheet()">취소</button><button class="primary" onclick="saveStayInfo()">저장</button></div>`;
 $("sheetback").classList.add("show")
}
function saveStayInfo(){
 state.stayInfo={stayName:$("pstay").value.trim(),room:$("proom").value.trim(),address:$("paddr").value.trim(),bookingCode:$("pbook").value.trim(),mapCode:$("pmapcode").value.trim(),mapUrl:$("pmapurl").value.trim(),guestFormUrl:$("pguesturl").value.trim(),checkinNote:$("pcheckin").value.trim(),checkoutNote:$("pcheckout").value.trim(),guestNote:$("pguestnote").value.trim()};
 save();closeSheet();guideRender();moreRender();toastMsg("숙소 및 체크인 정보를 저장했어요")
}
function editBudget(){const n=Number(prompt("총 예산을 입력하세요",state.budget));if(!n)return;state.budget=n;save();ledgerRender()}
function editTrip(){$("sheetbody").innerHTML=`<h3>여행 정보 수정</h3><div class="sheetgrid"><input id="tname" value="${state.trip.name}"><input id="tstart" type="date" value="${state.trip.start}"><input id="tend" type="date" value="${state.trip.end}"><input id="tbook" value="${state.trip.booking||""}" placeholder="예약번호"><select id="tcurrency"><option ${state.trip.currency==="₩"?"selected":""}>₩</option><option ${state.trip.currency==="¥"?"selected":""}>¥</option><option ${state.trip.currency==="$"?"selected":""}>$</option><option ${state.trip.currency==="€"?"selected":""}>€</option></select></div><div class="sheetactions"><button class="secondary" onclick="closeSheet()">취소</button><button class="primary" onclick="saveTripEdit()">저장</button></div>`;$("sheetback").classList.add("show")}
function saveTripEdit(){state.trip.name=$("tname").value.trim()||state.trip.name;state.trip.start=$("tstart").value;state.trip.end=$("tend").value;state.trip.booking=$("tbook").value.trim();state.trip.currency=$("tcurrency").value;day=state.trip.start;ledgerDay=state.trip.start;save();closeSheet();homeRender();moreRender();toastMsg("여행 정보를 수정했어요")}
function exportPersonalBackup(){
 const personalData={type:"trip-log-personal-data",version:1,schedules:state.schedules,packing:state.packing,outfits:state.outfits,budget:state.budget,expenses:state.expenses};
 const blob=new Blob([JSON.stringify(personalData,null,2)],{type:"application/json"}),a=document.createElement("a");
 a.href=URL.createObjectURL(blob);a.download="sapporo-trip-personal-data.json";a.click();URL.revokeObjectURL(a.href)
}
$("sharedDataInput").addEventListener("change",async e=>{
 const f=e.target.files[0];if(!f)return;
 try{
  const shared=normalizeSharedImport(JSON.parse(await f.text()));
  state.trip=shared.trip;state.flights=shared.flights;state.stayInfo=shared.stayInfo;state.sharedDataLoaded=true;
  day=state.trip.start;ledgerDay=state.trip.start;save();renderAll();toastMsg("공통 여행 데이터를 불러왔어요")
 }catch(error){console.error(error);toastMsg("공통 여행 데이터 파일을 확인해 주세요")}
 e.target.value=""
});
$("personalDataInput").addEventListener("change",async e=>{
 const f=e.target.files[0];if(!f)return;
 try{
  const personal=normalizePersonalImport(JSON.parse(await f.text()));
  state.schedules=personal.schedules;state.packing=personal.packing;state.outfits=personal.outfits;state.budget=personal.budget;state.expenses=personal.expenses;
  day=state.trip.start;ledgerDay=state.trip.start;save();renderAll();toastMsg("개인 데이터를 복원했어요")
 }catch(error){console.error(error);toastMsg("개인 데이터 파일을 확인해 주세요")}
 e.target.value=""
});
function deleteTrip(){
 if(!confirm("현재 기기에 저장된 공통 여행 데이터와 개인 데이터를 모두 삭제할까요?"))return;
 localStorage.removeItem(KEY);state=normalizeState({});day=state.trip.start;ledgerDay=state.trip.start;save();renderAll();toastMsg("현재 기기 데이터를 초기화했어요")
}
function drag(id,list){const c=$(id);if(!c)return;let d;c.querySelectorAll(".draggable").forEach(el=>{el.ondragstart=()=>{d=el;el.classList.add("dragging")};el.ondragend=()=>{el.classList.remove("dragging");state.schedules[day]=[...c.querySelectorAll(".draggable")].map(x=>list[+x.dataset.i]);save()};el.ondragover=e=>{e.preventDefault();const a=[...c.querySelectorAll(".draggable:not(.dragging)")].find(x=>e.clientY<x.getBoundingClientRect().top+x.offsetHeight/2);a?c.insertBefore(d,a):c.appendChild(d)}})}
function go(id){document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));function goPage(name){
 document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===name));
 document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.p===name));
 if(name==="schedule")scheduleRender();
 if(name==="packing")packingRender();
 if(name==="ledger")ledgerRender();
 if(name==="more")moreRender();
 window.scrollTo({top:0,behavior:"smooth"})
}
document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("active",b.dataset.p===id));({home:homeRender,schedule:scheduleRender,guide:guideRender,packing:packingRender,ledger:ledgerRender,more:moreRender}[id])();scrollTo({top:0,behavior:"smooth"})}
function toastMsg(s){$("toast").textContent=s;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),1700)}
window.goPage=go;
function renderAll(){homeRender();scheduleRender();guideRender();packingRender();ledgerRender();moreRender()}

let deferredInstallPrompt=null;
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredInstallPrompt=event;if(state)moreRender()});
window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null;if(state){toastMsg("홈 화면에 설치했어요");moreRender()}});
async function installApp(){
 if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;moreRender();return}
 toastMsg("Chrome 메뉴에서 ‘홈 화면에 추가’를 선택해 주세요")
}
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}))}
if(navigator.storage?.persist){navigator.storage.persist().catch(()=>{})}

function bootstrap(){
 defaults=clone(EMPTY_DEFAULTS);state=load();day=state.trip.start;ledgerDay=state.trip.start;save();
 document.querySelectorAll(".nav button").forEach(b=>b.onclick=()=>go(b.dataset.p));
 renderAll()
}
bootstrap();
