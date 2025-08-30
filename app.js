/* ==========
   Helpers
   ========== */
const q  = (s, r=document) => r.querySelector(s);
const qa = (s, r=document) => Array.from(r.querySelectorAll(s));
function fmtPeso(v){ return `₱${Number(v).toLocaleString("en-PH")}`; }

/* ==========
   DOM
   ========== */
const namesBoard    = q('#namesBoard');
const amountsBoard  = q('#amountsBoard');
const container     = q('#container');
const rollBtn       = q('#rollBtn');

// Setup wizard
const setupOverlay  = q('#setup');
const stepNames     = q('#stepNames');
const stepPrizes    = q('#stepPrizes');
const namesInput    = q('#namesInput');
const nextToPrizes  = q('#nextToPrizes');
const backToNames   = q('#backToNames');
const proceedSetup  = q('#proceedSetup');

const prizeList     = q('#prizeList');
const addPrizeRow   = q('#addPrizeRow');
const clearPrizes   = q('#clearPrizes');
const prizeHint     = q('#prizeHint');

// Popup & winner
const popup         = q('#popup');
const popupText     = q('#popupText');
const popupBtn      = q('#popupBtn');
const winnerOverlay = q('#winner');
const winnerBox     = q('#winnerBox');

/* ==========
   State
   ========== */
let names = [];
let round = 1;                 // 1..N
let chosenName = null;
let chosenNameEl = null;

// prize rule pools
let poolAny = [];              // rounds 1..(N-6) plus any fallback
let poolLate = { 1: null, 2: null, 3: null, 4: null, 5: null }; // exact rounds N-k
let prizeFinal = null;         // round N (exactly 1)

function makePrizeRow(amount = "", when = "any"){
  const row = document.createElement('div');
  row.className = 'prize-row';
  row.innerHTML = `
    <div>
      <label class="tiny muted">Amount</label>
      <input type="number" class="prize-amt" placeholder="e.g., 500, 1000" value="${amount}">
    </div>
    <div>
      <label class="tiny muted">When drawn</label>
      <select class="prize-when">
        <option value="any" ${when==="any"?"selected":""}>Any (Rounds 1…N-? )</option>
        <option value="late-1" ${when==="late-1"?"selected":""}>Late: N-1</option>
        <option value="late-2" ${when==="late-2"?"selected":""}>Late: N-2</option>
        <option value="late-3" ${when==="late-3"?"selected":""}>Late: N-3</option>
        <option value="late-4" ${when==="late-4"?"selected":""}>Late: N-4</option>
        <option value="late-5" ${when==="late-5"?"selected":""}>Late: N-5</option>
        <option value="final" ${when==="final"?"selected":""}>Final (Round N)</option>
      </select>
    </div>
    <div class="row-remove">
      <button type="button" class="btn ghost remove-row">Remove</button>
    </div>
  `;
  row.querySelector('.remove-row').onclick = () => row.remove();
  prizeList.appendChild(row);
}

function updatePrizeHint(){
  const N = names.length || 0;
  if (N < 2){ prizeHint.textContent = 'Enter at least 2 names to configure rounds.'; return; }
  const early = Math.max(0, N - 1 - 5); // anything before N-5
  prizeHint.innerHTML =
    `You have <strong>${N}</strong> names. You may assign up to one Late prize for each of N-1…N-5, exactly one Final (N), and the rest as Any.`;
}

nextToPrizes.onclick = () => {
  names = namesInput.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (names.length < 2){ alert('Please enter at least 2 names.'); return; }

  stepNames.classList.add('hidden');
  stepPrizes.classList.remove('hidden');

  // Prefill: (N>=3) one Late N-1, Final; rest Any
  prizeList.innerHTML = '';
  const N = names.length;
  const countAny = Math.max(0, N - 2); // default template
  for (let i=0; i<countAny; i++) makePrizeRow(500, 'any');
  if (N >= 3) makePrizeRow(1000, 'late-1');
  makePrizeRow(2000, 'final');

  updatePrizeHint();
};

backToNames && (backToNames.onclick = () => {
  stepPrizes.classList.add('hidden');
  stepNames.classList.remove('hidden');
});

addPrizeRow.onclick = () => makePrizeRow();
clearPrizes.onclick = () => prizeList.innerHTML = '';

function validateAndBuildPrizes(){
  const rows = qa('.prize-row', prizeList);
  const N = names.length;

  const any = [];
  const late = { 1: null, 2: null, 3: null, 4: null, 5: null };
  let fin = null;

  for (const r of rows){
    const amt = Number(r.querySelector('.prize-amt').value);
    const when = r.querySelector('.prize-when').value;

    if (!amt || isNaN(amt) || amt <= 0){
      return { ok:false, msg:'All prizes must be positive numbers.' };
    }
    if (when === 'final'){
      if (fin !== null) return { ok:false, msg:'Only one Final (Round N) prize is allowed.' };
      fin = amt;
    } else if (when.startsWith('late-')){
      const k = Number(when.split('-')[1]); // 1..5
      if (!(k >=1 && k <=5)) return { ok:false, msg:'Late prize must be N-1 to N-5.' };
      if (late[k] !== null) return { ok:false, msg:`Only one Late prize allowed for N-${k}.` };
      late[k] = amt;
    } else {
      any.push(amt);
    }
  }

  if (fin === null) return { ok:false, msg:'You must set exactly one Final (Round N) prize.' };

  // Count totals
  const lateCount = Object.values(late).filter(v => v !== null).length;
  const total = any.length + lateCount + 1; // +1 final
  if (total !== N){
    return { ok:false, msg:`Total prizes (${total}) must equal number of names (${N}).` };
  }

  // Sanity: you cannot assign a Late prize beyond available late rounds
  // (e.g., N=3 supports at most N-1 and N only). We’ll allow configuration,
  // but rounds earlier than N-5 simply never occur; thus block if k >= N.
  for (let k=1; k<=5; k++){
    if (late[k] !== null && (N - k) < 1){
      return { ok:false, msg:`N-${k} is not a valid round with only ${N} names.` };
    }
  }

  return { ok:true, any, late, fin };
}

proceedSetup.onclick = () => {
  const check = validateAndBuildPrizes();
  if (!check.ok){ alert(check.msg); return; }

  poolAny = [...check.any];
  poolLate = { 1: null, 2: null, 3: null, 4: null, 5: null };
  for (let k=1; k<=5; k++) poolLate[k] = check.late[k];
  prizeFinal = check.fin;

  round = 1;
  chosenName = null;
  chosenNameEl = null;

  renderBoards();
  setupOverlay.classList.remove('active');
};

/* ==========
   Rendering
   ========== */
function renderBoards(){
  // Names
  namesBoard.innerHTML = names
    .map((n,i)=>`<div class="card" data-i="${i}" data-label="${n}">${n}</div>`)
    .join('');

  // Prizes (hide rule labels visually; only data-tag encodes rule)
  const display = [
    ...poolAny.map(v => ({v, tag:'Any'})),
    ...[1,2,3,4,5].flatMap(k => poolLate[k] != null ? [{ v: poolLate[k], tag: `Late-${k}` }] : []),
    ...(prizeFinal != null ? [{v:prizeFinal, tag:'Final'}] : [])
  ];

  amountsBoard.innerHTML = display
    .map((p,i)=>`<div class="card" data-amt="${p.v}" data-tag="${p.tag}" data-i="${i}">${fmtPeso(p.v)}</div>`)
    .join('');
}

function availableNames(){
  return qa('.card:not(.greyed)', namesBoard);
}

function remainingPrizeCards(tag){
  return qa(`.card:not(.greyed)[data-tag="${tag}"]`, amountsBoard);
}

function availableAmtsForRound(r, N){
  const offset = N - r; // 0 => Final, 1..5 => Late
  if (offset === 0) return remainingPrizeCards('Final');
  if (offset >= 1 && offset <= 5){
    const late = remainingPrizeCards(`Late-${offset}`);
    if (late.length) return late;
  }
  return qa('.card:not(.greyed)[data-tag="Any"]', amountsBoard);
}

/* ==========
   Animation
   ========== */
function animate(cards, durationMs, holdAfterMs, done){
  if (!cards.length) return;
  let elapsed = 0, last = -1;
  const minInt = 28, maxInt = 300;

  function step(){
    qa('.card.highlight').forEach(c => c.classList.remove('highlight'));
    let idx = Math.floor(Math.random()*cards.length);
    if (cards.length > 1 && idx === last) idx = (idx+1) % cards.length;
    last = idx;
    const chosen = cards[idx];
    chosen.classList.add('highlight');

    if (elapsed >= durationMs){
      setTimeout(()=>{
        chosen.classList.add('greyed');
        chosen.classList.remove('highlight');
        done(chosen);
      }, holdAfterMs);
      return;
    }
    const progress = Math.min(1, elapsed / durationMs);
    const easeOutCubic = 1 - Math.pow(1-progress, 3);
    const interval = minInt + (maxInt - minInt) * easeOutCubic;

    elapsed += interval;
    setTimeout(step, interval);
  }
  step();
}

/* ==========
   Award helpers
   ========== */
function annotateNameWithAmount(nameEl, amount){
  const label = nameEl.dataset.label;
  if (!nameEl.querySelector('.won')){
    nameEl.innerHTML = `${label}<span class="won">${fmtPeso(amount)}</span>`;
  }
}

function annotatePrizeWithWinner(prizeEl, winner){
  if (!prizeEl.classList.contains('greyed')) prizeEl.classList.add('greyed');
  if (!prizeEl.querySelector('.awarded')){
    const who = document.createElement('span');
    who.className = 'awarded';
    who.textContent = `Awarded to ${winner}`;
    prizeEl.appendChild(who);
  }
}

function instantAward(prizeEl, winnerEl, winnerName, roundNum, totalRounds, flipBackAndContinue=true){
  const amt = prizeEl ? Number(prizeEl.dataset.amt) : 0;
  annotateNameWithAmount(winnerEl, amt);
  if (prizeEl) annotatePrizeWithWinner(prizeEl, winnerName);

  popupText.textContent =
    (roundNum < totalRounds)
      ? `Congratulations, ${winnerName}. You won ${fmtPeso(amt)}!`
      : `Grand round complete! ${winnerName} takes home ${fmtPeso(amt)}!`;
  popupBtn.textContent = (roundNum < totalRounds) ? 'Keep rolling' : 'Done';
  popup.classList.add('active');

  popupBtn.onclick = () => {
    popup.classList.remove('active');
    if (roundNum < totalRounds){
      round++;
      if (flipBackAndContinue){
        container.classList.remove('flipped');
        container.addEventListener('transitionend', () => chooseName(), { once:true });
      } else {
        chooseName();
      }
    } else {
      showWinner();
    }
  };
}

/* ==========
   Flow
   ========== */
function chooseName(){
  const N = names.length;

  // FINAL ROUND: skip all animation and do not flip
  if (round === N){
    const left = availableNames();
    if (!left.length){ showWinner(); return; }
    const card = left[0];
    card.classList.add('greyed');
    chosenNameEl = card;
    chosenName   = card.dataset.label;

    const finalEl = remainingPrizeCards('Final')[0] || qa('.card:not(.greyed)', amountsBoard)[0];
    instantAward(finalEl, chosenNameEl, chosenName, round, N, false /* no flip back needed */);
    return;
  }

  // NORMAL name animation (covers early + late rounds)
  animate(availableNames(), 5000, 3000, card => {
    chosenNameEl = card;
    chosenName   = card.dataset.label;

    const offset = N - round;

    // LATE ROUNDS (N-1..N-5): flip and award instantly if a matching late prize exists
    if (offset >= 1 && offset <= 5){
      const lateEl = remainingPrizeCards(`Late-${offset}`)[0];
      if (lateEl){
        container.classList.add('flipped');
        container.addEventListener('transitionend', () => {
          instantAward(lateEl, chosenNameEl, chosenName, round, N);
        }, { once:true });
        return;
      }
      // If no late prize exists for this offset, fall through to normal early-round behavior
    }

    // EARLY ROUNDS: fast-path if only one Any prize remains
    const remainingAny = remainingPrizeCards('Any');
    if (remainingAny.length === 1){
      const lastAnyEl = remainingAny[0];
      container.classList.add('flipped');
      container.addEventListener('transitionend', () => {
        instantAward(lastAnyEl, chosenNameEl, chosenName, round, N);
      }, { once:true });
      return;
    }

    // Default: flip then animate prize selection from the proper pool
    container.classList.add('flipped');
    container.addEventListener('transitionend', () => chooseAmt(N), { once:true });
  });
}

function chooseAmt(N){
  let cards = availableAmtsForRound(round, N);
  if (!cards.length) cards = qa('.card:not(.greyed)', amountsBoard);

  animate(cards, 5000, 0, chosen => {
    const amt = Number(chosen.dataset.amt);

    if (chosenNameEl){
      annotateNameWithAmount(chosenNameEl, amt);
    }
    annotatePrizeWithWinner(chosen, chosenName);

    const Nround = round;
    popupText.textContent =
      (Nround < N)
        ? `Congratulations, ${chosenName}. You won ${fmtPeso(amt)}!`
        : `Grand round complete! ${chosenName} takes home ${fmtPeso(amt)}!`;
    popupBtn.textContent = (Nround < N) ? 'Keep rolling' : 'Done';
    popup.classList.add('active');

    popupBtn.onclick = () => {
      popup.classList.remove('active');
      if (round < N){
        round++;
        container.classList.remove('flipped');
        container.addEventListener('transitionend', () => chooseName(), { once:true });
      } else {
        showWinner();
      }
    };
  });
}


/* ==========
   Controls
   ========== */
rollBtn.onclick = () => {
  if (!names.length){
    setupOverlay.classList.add('active');
    return;
  }
  if (round === 1){
    chooseName();
  }
};
