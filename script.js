const nodes = {
  client: { label: 'CLIENT', name: 'Client', ip: '192.168.1.20' },
  web: { label: 'WEB SERVER', name: 'Web Server', ip: '10.0.1.10' },
  app: { label: 'APP SERVER', name: 'Application Server', ip: '10.0.2.10' },
  database: { label: 'DATABASE', name: 'Database Server', ip: '10.0.3.10' }
};

// These six rules intentionally match endpoints and port, regardless of protocol.
const defaultRules = Object.freeze([
  { source: 'client', destination: 'web', port: '443', decision: 'ALLOW', why: 'Public HTTPS entry point to the web tier.' },
  { source: 'client', destination: 'app', port: '5000', decision: 'DENY', why: 'Clients must not bypass the web tier.' },
  { source: 'client', destination: 'database', port: '3306', decision: 'DENY', why: 'The database is never exposed to users.' },
  { source: 'web', destination: 'app', port: '5000', decision: 'ALLOW', why: 'The web tier may call application logic.' },
  { source: 'web', destination: 'database', port: '3306', decision: 'DENY', why: 'The web tier cannot access stored data directly.' },
  { source: 'app', destination: 'database', port: '3306', decision: 'ALLOW', why: 'The application tier is authorized to query data.' }
].map(rule => Object.freeze(rule)));
let rules = defaultRules.map(rule => ({ ...rule }));

function ruleReason(rule, index) {
  if (rule.decision === defaultRules[index].decision) return rule.why;
  if (rule.decision === 'DENY') return 'User override: DENY. This blocks a baseline-authorized request; the service on this tier connection stops working in the demo.';
  return 'User override: ALLOW. Security risk: ' + (rule.destination === 'database'
    ? 'direct client/web access to the database bypasses the application tier and recommended database segmentation.'
    : 'direct client access to application logic bypasses the web tier and recommended segmentation.');
}

function changeRule(index, decision) {
  if (!Number.isInteger(index) || !rules[index] || !['ALLOW', 'DENY'].includes(decision)) return false;
  if (rules[index].decision === decision) return false;
  rules[index].decision = decision;
  return true;
}

function resetRules() {
  rules = defaultRules.map(rule => ({ ...rule }));
}

const modelNote = 'All six rules are protocol-agnostic: choosing TCP or UDP does not alter the firewall decision in this simplified model. Port 443 is a service label; this simulation does not perform TLS or a transport handshake.';
const correctPath = 'Intended application flow: Client → Web :443, then Web → App :5000, then App → Database :3306. These are three separate authorized requests created by the respective tiers, not one packet forwarded through application logic.';
const learnItems = [
  { icon: '#', title: 'IP address', copy: 'A unique address for a device on a network. In this simulator, 192.168.1.20 identifies the client while 10.0.x.x addresses identify internal servers.', tone: 'cyan' },
  { icon: ':', title: 'Port', copy: 'A numbered doorway for a service. Port 443 is HTTPS, 5000 is the application API, and 3306 is the database service.', tone: 'purple' },
  { icon: '▣', title: 'Packet', copy: 'A small bundle of data with a source, destination, protocol and port. Routers and firewalls read this envelope to move or stop it.', tone: 'amber' },
  { icon: '↔', title: 'TCP', copy: 'A connection-oriented protocol. It checks that data arrives reliably and in order. UDP does not guarantee delivery or ordering. ' + modelNote, tone: 'cyan' },
  { icon: '◈', title: 'Firewall', copy: 'A checkpoint that compares packet details with a rulebook. It allows trusted paths and blocks paths that violate the network policy.', tone: 'red' },
  { icon: '⬡', title: 'Three-tier architecture', copy: 'A structure that separates the user-facing web tier, application logic tier and data tier. ' + correctPath, tone: 'purple' }
];

const $ = id => document.getElementById(id);
const reducedMotion = typeof window === 'undefined' ? { matches: true } : window.matchMedia('(prefers-reduced-motion: reduce)');
let activeRun = null;
let visual = null;

function renderRules() {
  $('rulesTable').innerHTML = rules.map((rule, index) => `
    <tr data-modified="${rule.decision !== defaultRules[index].decision}"><td><span class="rule-id">R-0${index + 1}</span></td>
    <td>${nodes[rule.source].label}<br><code>${nodes[rule.source].ip}</code></td>
    <td>${nodes[rule.destination].label}<br><code>${nodes[rule.destination].ip}</code></td>
    <td><code>:${rule.port}</code></td>
    <td><select class="rule-decision decision-cell ${rule.decision.toLowerCase()}" data-rule-index="${index}" aria-label="Decision for rule R-0${index + 1}, ${nodes[rule.source].name} to ${nodes[rule.destination].name} port ${rule.port}"><option value="ALLOW"${rule.decision === 'ALLOW' ? ' selected' : ''}>ALLOW</option><option value="DENY"${rule.decision === 'DENY' ? ' selected' : ''}>DENY</option></select></td>
    <td><span class="rule-note">${ruleReason(rule, index)}</span></td></tr>`).join('');
  const table = $('rulesTable').closest('table');
  if (table) {
    const caption = table.querySelector('caption[data-rule-caption]') || document.createElement('caption');
    caption.setAttribute('data-rule-caption', '');
    caption.textContent = modelNote;
    caption.style.cssText = 'caption-side:bottom;text-align:left;padding:16px;font-size:13px;line-height:1.6;';
    table.appendChild(caption);
  }
  if ($('rulesStatus')) {
    const modified = rules.filter((rule, index) => rule.decision !== defaultRules[index].decision).length;
    $('rulesStatus').setAttribute('role', 'status');
    $('rulesStatus').textContent = `Demo only: edits stay in memory; no real firewall changes. ${modified} of 6 rules modified. The topology shows the recommended baseline, not your edits. Policy changes invalidate the previous result; run again to test the current policy.`;
  }
}

function invalidatePolicyResult() {
  stopRun();
  $('traceList').replaceChildren();
  $('resultTitle').textContent = 'Policy changed — run again';
  setBadge('POLICY CHANGED');
  explain('Previous result invalidated', 'The policy changed. Any active simulation was cancelled and the previous decision trace cleared. Start a new simulation to test the current demo rules. No real firewall was changed.');
  setVisualState('RUN AGAIN');
  visual?.packet.setAttribute('visibility', 'hidden');
  visual?.svg.setAttribute('aria-label', 'Policy changed; previous result invalidated; run again');
  if (visual) visual.svg.querySelector('[data-caption]').textContent = 'Policy changed · new simulation required';
}

const learnIcons = {
  '#': '<rect x="3" y="3" width="18" height="12" rx="2"/><path d="M8 21h8M12 15v6M7 9h.01M12 9h.01M17 9h.01"/>',
  ':': '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M10 21v-6h4v6"/>',
  '▣': '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 9v9M3 8l9 4 9-4M7.5 5.5l9 5v5"/>',
  '↔': '<path d="M3 8h18m-4-4 4 4-4 4M21 16H3m4-4-4 4 4 4"/>',
  '◈': '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  '⬡': '<rect x="8" y="2" width="8" height="5" rx="1"/><rect x="8" y="10" width="8" height="5" rx="1"/><rect x="8" y="18" width="8" height="4" rx="1"/><path d="M12 7v3m0 5v3"/>'
};

function renderLearn() {
  $('learnGrid').innerHTML = learnItems.map(item => `
    <details class="learn-card"><summary class="learn-card-head">
    <span class="learn-card-icon ${item.tone}-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${learnIcons[item.icon]}</svg></span><h3>${item.title}</h3>
    </summary><p>${item.copy}</p></details>`).join('');
  renderLearningLab();
  renderLessonWorkbench();
}

const exercises = [
  { title: 'Match the HTTPS port', question: 'Which port labels the public HTTPS service?', options: ['443 — HTTPS', '5000 — application API', '3306 — database'], correct: 0, explanation: 'Port 443 is the HTTPS service label. Port 5000 is the application API and 3306 is the database. This demo does not perform TLS.', scenario: ['client', 'web', 443] },
  { title: 'Predict the baseline firewall', question: 'Under the recommended baseline, can Client access Database on port 3306?', options: ['ALLOW — direct database access', 'DENY — protect the data tier'], correct: 1, explanation: 'The recommended baseline denies Client → Database :3306. Clients must go through the web and application tiers; direct database access bypasses segmentation.', scenario: ['client', 'database', 3306] },
  { title: 'Choose the tier path', question: 'Which sequence follows the recommended three-tier architecture?', options: ['Client → Database', 'Client → Web → Database', 'Client → Web → App → Database'], correct: 2, explanation: correctPath + ' Shortcuts bypass tier boundaries.', scenario: ['app', 'database', 3306] }
];
const learningAnswers = new Map();
const learningEarned = new Set();

function gradeExercise(index, answer) {
  if (!exercises[index] || !Number.isInteger(answer) || !exercises[index].options[answer]) return null;
  const correct = exercises[index].correct === answer;
  learningAnswers.set(index, answer);
  if (correct) learningEarned.add(index);
  return { correct, explanation: exercises[index].explanation, progress: learningEarned.size };
}

function resetLearning() {
  learningAnswers.clear();
  learningEarned.clear();
}

function renderLearningLab() {
  let host = $('learningLab');
  if (!host) {
    host = document.createElement('div');
    host.id = 'learningLab';
    $('learnGrid').insertAdjacentElement('afterend', host);
  }
  host.innerHTML = `<section class="learning-exercises" aria-label="Practice exercises"><h3>Practice the recommended baseline</h3><p>Quizzes always use the recommended baseline regardless of your rule edits. Open in simulator tests your actual current demo policy.</p><p class="learning-progress" role="status">${learningEarned.size} / ${exercises.length} correct answers earned</p>${exercises.map((exercise, index) => {
    const answer = learningAnswers.get(index);
    const answered = answer !== undefined;
    const correct = answered && answer === exercise.correct;
    return `<article class="learning-exercise"><header class="exercise-header"><h4>${index + 1}. ${exercise.title}</h4><p>${exercise.question}</p></header><div class="exercise-options">${exercise.options.map((option, choice) => `<button type="button" class="exercise-option${answer === choice ? (correct ? ' is-correct' : ' is-incorrect') : ''}" data-exercise="${index}" data-answer="${choice}" aria-pressed="${answer === choice}">${option}</button>`).join('')}</div><p class="exercise-feedback" role="status">${answered ? `${correct ? 'Correct.' : 'Not quite — try again.'} ${exercise.explanation}` : ''}</p><a class="exercise-action" href="#simulate" data-exercise-scenario="${index}">Open in simulator</a></article>`;
  }).join('')}<button type="button" class="exercise-reset">Reset exercises</button></section>`;
  if (!host.dataset.learningBound) {
    host.dataset.learningBound = 'true';
    host.addEventListener('click', event => {
      const option = event.target.closest('.exercise-option');
      if (option) {
        const index = Number(option.dataset.exercise);
        const answer = Number(option.dataset.answer);
        gradeExercise(index, answer);
        renderLearningLab();
        host.querySelector(`[data-exercise="${index}"][data-answer="${answer}"]`)?.focus();
      }
      if (event.target.closest('.exercise-reset')) {
        resetLearning();
        renderLearningLab();
        host.querySelector('.exercise-reset')?.focus();
      }
      const action = event.target.closest('[data-exercise-scenario]');
      if (action) {
        event.preventDefault();
        location.hash = 'simulate';
        showSection('simulate');
        setScenario(...exercises[Number(action.dataset.exerciseScenario)].scenario);
      }
    });
  }
}

const lessonNames = ['Address a packet', 'Pick a service', 'Compare TCP / UDP', 'Trace tier path'];
const lessonServices = {
  443: { name: 'HTTPS', destination: 'web' },
  5000: { name: 'Application API', destination: 'app' },
  3306: { name: 'Database', destination: 'database' }
};
function modeledService(raw) {
  const value = String(raw).trim();
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) return { valid: false, service: null };
  return { valid: true, port: Number(value), service: lessonServices[Number(value)] || null };
}
function transportSnapshot(stage) {
  const step = Math.max(0, Math.min(4, Number.isInteger(stage) ? stage : 0));
  return {
    tcp: step === 4 ? [1, 2, 3] : step >= 3 ? [1] : step >= 1 ? [1] : [],
    buffered: step === 3 ? [3] : [],
    udp: step >= 3 ? [1, 3] : step >= 1 ? [1] : [],
    dropped: step >= 2,
    resent: step === 4
  };
}
function tierRequest(step) {
  const path = [['client', 'web', 443], ['web', 'app', 5000], ['app', 'database', 3306]];
  if (!Number.isInteger(step) || step < 1 || step > path.length) return null;
  const [source, destination, port] = path[step - 1];
  return { source, destination, port };
}
let lessonState = { tab: 0, destination: 'web', port: '443', transport: 0, running: false, tier: 0 };
let lessonTimer = null;
let lessonGeneration = 0;
function stopLessonSequence() {
  clearTimeout(lessonTimer);
  lessonTimer = null;
  lessonGeneration++;
  lessonState.running = false;
}
function selectLesson(index) {
  if (!Number.isInteger(index) || index < 0 || index >= lessonNames.length) return;
  stopLessonSequence();
  lessonState = { tab: index, destination: 'web', port: '443', transport: 0, running: false, tier: 0 };
  renderLessonWorkbench();
}
function lessonSVG(label, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 250" role="img" aria-label="${label}" focusable="false"><defs><marker id="lesson-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>${body}</svg>`;
}
function lessonBox(key, x, y, width = 150, selected = false) {
  return `<g class="lesson-tier${selected ? ' is-active' : ''}" data-selected="${selected}"><rect x="${x}" y="${y}" width="${width}" height="60" rx="9" fill="${selected ? '#d9f0eb' : '#f6f8fa'}" stroke="${selected ? '#16786f' : '#667482'}" stroke-width="${selected ? 3 : 1.5}"/><text x="${x + width / 2}" y="${y + 24}" text-anchor="middle" fill="#243342" font-size="14">${nodes[key].label}</text><text x="${x + width / 2}" y="${y + 44}" text-anchor="middle" fill="#243342" font-size="13">${nodes[key].ip}</text></g>`;
}
function lessonArrow(path, label = '') {
  return `<path class="lesson-path" d="${path}" fill="none" stroke="currentColor" stroke-width="2" marker-end="url(#lesson-arrow)"/>${label}`;
}
function endpointLessonVisual(destination) {
  const targets = ['web', 'app', 'database'];
  const selected = targets.indexOf(destination);
  return lessonSVG(destination ? `Client addresses ${nodes[destination].name}; highlighted destination` : 'Client: no modeled destination for this port',
    lessonBox('client', 20, 95) + targets.map((key, index) => lessonBox(key, 530, 10 + index * 80, 170, key === destination)).join('') +
    (selected < 0 ? '<text x="330" y="130" text-anchor="middle" fill="currentColor" font-size="15">No modeled service</text>' : lessonArrow(`M170 125 H350 V${40 + selected * 80} H530`, `<rect x="245" y="108" width="94" height="34" rx="5" fill="#fff" stroke="#16786f"/><text x="292" y="130" text-anchor="middle" fill="#243342" font-size="14">PACKET</text>`)));
}
function packetFields(source, destination, port) {
  return `<div class="packet-fields"><div class="packet-field"><span>Source IP</span><code>${nodes[source].ip}</code></div><div class="packet-field"><span>Destination IP</span><code>${destination ? nodes[destination].ip : 'Not modeled'}</code></div>${port !== undefined ? `<div class="packet-field lesson-port"><span>Destination port</span><code>${Number.isInteger(port) ? port : '—'}</code></div>` : ''}</div>`;
}
function transportLessonVisual() {
  const snapshot = transportSnapshot(lessonState.transport);
  return lessonSVG('Illustrative TCP and UDP comparison: piece 2 is deliberately dropped in both lanes; TCP resends it, UDP does not', ['tcp', 'udp'].map((protocol, index) => {
    const y = 35 + index * 110;
    const delivered = snapshot[protocol].join(', ') || 'none';
    return `<text x="20" y="${y - 10}" fill="currentColor" font-size="16">${protocol.toUpperCase()}</text><rect x="20" y="${y}" width="125" height="60" rx="8" fill="#f6f8fa" stroke="#667482"/><text x="82" y="${y + 35}" text-anchor="middle" fill="#243342" font-size="14">Sender</text>` + lessonArrow(`M145 ${y + 30} H530`) +
      [1, 2, 3].map((piece, i) => `<g><rect x="${205 + i * 95}" y="${y + 10}" width="46" height="40" rx="5" fill="${piece === 2 && snapshot.dropped && !(protocol === 'tcp' && snapshot.resent) ? '#fde4df' : '#d9f0eb'}" stroke="#667482"/><text x="${228 + i * 95}" y="${y + 35}" text-anchor="middle" fill="#243342" font-size="16">${piece}</text>${piece === 2 && snapshot.dropped ? `<text x="${228 + i * 95}" y="${y + 78}" text-anchor="middle" fill="currentColor" font-size="12">${protocol === 'tcp' && snapshot.resent ? 'RESENT' : 'DROPPED'}</text>` : ''}</g>`).join('') +
      `<rect x="530" y="${y}" width="170" height="60" rx="8" fill="#f6f8fa" stroke="#667482"/><text x="615" y="${y + 24}" text-anchor="middle" fill="#243342" font-size="14">Received: ${delivered}</text><text x="615" y="${y + 44}" text-anchor="middle" fill="#243342" font-size="12">${protocol === 'tcp' && snapshot.buffered.length ? '3 buffered; waiting for 2' : protocol === 'tcp' ? 'Ordered delivery' : 'No retransmission'}</text>`;
  }).join(''));
}
function renderLessonWorkbench() {
  const host = $('lessonWorkbench');
  if (!host) return;
  const focusedId = document.activeElement?.id;
  const state = lessonState;
  let instructions, controls, image, feedback, fields = '', progress = '';
  if (state.tab === 0) {
    instructions = 'Choose an endpoint. The packet envelope tells the network where this request should go.';
    controls = `<label for="lesson-destination">Destination</label><select id="lesson-destination">${['web', 'app', 'database'].map(key => `<option value="${key}"${state.destination === key ? ' selected' : ''}>${nodes[key].name}</option>`).join('')}</select>`;
    image = endpointLessonVisual(state.destination);
    fields = packetFields('client', state.destination);
    feedback = `Addressed to ${nodes[state.destination].name} at ${nodes[state.destination].ip}. Addressing identifies an endpoint; it does not grant firewall permission.`;
  } else if (state.tab === 1) {
    instructions = 'Pick a named service or enter a port. In this model each named service lives on a different tier.';
    const result = modeledService(state.port);
    controls = `<label for="lesson-service">Service preset</label><select id="lesson-service"><option value="443"${result.port === 443 ? ' selected' : ''}>HTTPS · 443</option><option value="5000"${result.port === 5000 ? ' selected' : ''}>API · 5000</option><option value="3306"${result.port === 3306 ? ' selected' : ''}>Database · 3306</option><option value="custom"${!result.service ? ' selected' : ''}>Custom port</option></select><label for="lesson-port">Numeric port</label><input id="lesson-port" type="number" min="1" max="65535" step="1" value="${result.valid ? result.port : ''}" aria-invalid="${!result.valid}">`;
    image = endpointLessonVisual(result.service?.destination);
    fields = packetFields('client', result.service?.destination, result.port);
    feedback = !result.valid ? 'Enter a whole-number port from 1 to 65535.' : result.service ? `${result.service.name} → ${nodes[result.service.destination].name} :${result.port}. A service label does not imply firewall permission or a real connection.` : `Port ${result.port}: no modeled service. There is no named destination for this port in this lesson.`;
  } else if (state.tab === 2) {
    instructions = 'Send three numbered pieces. Piece 2 is deliberately dropped in both lanes: this fixed illustration is not real network traffic.';
    controls = '<button id="lesson-send" type="button">Send / replay 3 pieces</button>';
    image = transportLessonVisual();
    feedback = ['Ready: compare how the two transports handle the same illustrative loss.', 'Piece 1 arrives in both lanes.', 'Piece 2 is deliberately dropped in both lanes.', 'Piece 3 arrives. TCP buffers it while waiting for 2; UDP receives 1 and 3 with a gap.', 'TCP resends piece 2 and delivers 1, 2, 3 in order. UDP does not retransmit: piece 2 remains missing. Actual networks can also reorder packets.'][state.transport];
    progress = `${state.transport} / 4 illustrative steps${state.running ? ' · playing' : ''}`;
  } else {
    instructions = 'Advance the intended tier flow. Every arrow is a NEW request created by that source tier, not one packet passing through all tiers.';
    controls = `<button id="lesson-step" type="button"${state.tier === 3 ? ' disabled' : ''}>Create next request</button><button id="lesson-restart" type="button">Restart path</button>`;
    const keys = ['client', 'web', 'app', 'database'];
    image = lessonSVG('Three separate requests: Client to Web 443, Web to App 5000, App to Database 3306', keys.map((key, i) => lessonBox(key, 10 + i * 185, 95, 145, state.tier > 0 && i === state.tier)).join('') + [443, 5000, 3306].map((port, i) => `<g opacity="${state.tier > i ? 1 : 0.35}">${lessonArrow(`M${155 + i * 185} 125 H${195 + i * 185}`)}<text class="lesson-port" x="${175 + i * 185}" y="80" text-anchor="middle" fill="currentColor" font-size="14">:${port}</text><text x="${175 + i * 185}" y="185" text-anchor="middle" fill="currentColor" font-size="12">NEW request ${i + 1}</text></g>`).join(''));
    const request = tierRequest(state.tier);
    fields = request ? packetFields(request.source, request.destination, request.port) : '';
    feedback = request ? `NEW request ${state.tier}: ${nodes[request.source].name} → ${nodes[request.destination].name} :${request.port}.${state.tier === 3 ? ' Path complete: three separate baseline-authorized requests.' : ' The receiving tier creates the next request.'}` : 'Ready: the client creates the first HTTPS request to the web tier.';
    progress = `${state.tier} / 3 separate requests`;
  }
  host.classList.add?.('lesson-workbench');
  host.innerHTML = `<div class="lesson-tabs" role="group" aria-label="Hands-on lessons">${lessonNames.map((name, index) => `<button type="button" id="lesson-tab-${index}" data-lesson-tab="${index}" aria-pressed="${state.tab === index}">${index + 1}. ${name}</button>`).join('')}</div><section class="lesson-stage" aria-labelledby="lesson-title"><h3 id="lesson-title">${lessonNames[state.tab]}</h3><p>${instructions}</p><div class="lesson-visual">${image}</div>${fields}<div class="lesson-controls">${controls}</div><p class="lesson-feedback" aria-live="polite" aria-atomic="true">${feedback}</p><p class="lesson-progress">${progress}</p>${state.tab < 3 ? '<button class="lesson-next" id="lesson-next" type="button">Next lesson →</button>' : ''}</section>`;
  if (focusedId?.startsWith('lesson-')) $(focusedId === 'lesson-step' && state.tier === 3 ? 'lesson-restart' : focusedId)?.focus();
  if (host.dataset.lessonBound) return;
  host.dataset.lessonBound = 'true';
  host.addEventListener('click', event => {
    const tab = event.target.closest('[data-lesson-tab]');
    if (tab) selectLesson(Number(tab.dataset.lessonTab));
    else if (event.target.id === 'lesson-next') {
      selectLesson(lessonState.tab + 1);
      $(`lesson-tab-${lessonState.tab}`)?.focus();
    } else if (event.target.id === 'lesson-send') startLessonSequence();
    else if (event.target.id === 'lesson-step') { lessonState.tier = Math.min(3, lessonState.tier + 1); renderLessonWorkbench(); }
    else if (event.target.id === 'lesson-restart') { lessonState.tier = 0; renderLessonWorkbench(); }
  });
  host.addEventListener('change', event => {
    if (event.target.id === 'lesson-destination' && ['web', 'app', 'database'].includes(event.target.value)) lessonState.destination = event.target.value;
    else if (event.target.id === 'lesson-service') {
      if (event.target.value === 'custom') { $('lesson-port')?.focus(); return; }
      lessonState.port = event.target.value;
    } else if (event.target.id === 'lesson-port') lessonState.port = event.target.value;
    else return;
    renderLessonWorkbench();
  });
  host.addEventListener('input', event => {
    if (event.target.id !== 'lesson-port') return;
    lessonState.port = event.target.value;
    renderLessonWorkbench();
  });
}
function startLessonSequence() {
  stopLessonSequence();
  lessonState.transport = 0;
  lessonState.running = true;
  const generation = lessonGeneration;
  renderLessonWorkbench();
  function advance() {
    if (generation !== lessonGeneration || lessonState.tab !== 2) return;
    lessonState.transport++;
    lessonState.running = lessonState.transport < 4;
    renderLessonWorkbench();
    lessonTimer = lessonState.running ? setTimeout(advance, reducedMotion.matches ? 800 : 1000) : null;
  }
  lessonTimer = setTimeout(advance, reducedMotion.matches ? 800 : 1000);
}

function createRouteVisual() {
  const route = document.querySelector('.packet-route');
  if (!route) return;
  route.style.flexWrap = 'wrap';
  const wrapper = document.createElement('div');
  wrapper.className = 'route-visual';
  wrapper.style.cssText = 'flex:0 0 100%;width:100%;min-width:0;';
  wrapper.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 150" role="img" aria-label="Packet route, waiting for simulation" style="display:block;width:100%;height:auto;overflow:visible;font-family:system-ui,sans-serif;">
      <defs><marker id="route-tip" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L10 5 L0 10 Z" fill="#16786f"/></marker></defs>
      <path d="M160 66 H250" fill="none" stroke="#16786f" stroke-width="2" marker-end="url(#route-tip)"/>
      <path d="M370 66 H460" fill="none" stroke="#16786f" stroke-width="2" marker-end="url(#route-tip)"/>
      <rect x="10" y="30" width="150" height="72" rx="12" fill="#ffffff" stroke="#16786f" stroke-width="2"/>
      <rect data-firewall x="250" y="30" width="120" height="72" rx="12" fill="#f6f8fa" stroke="#ad502b" stroke-width="2"/>
      <rect x="460" y="30" width="150" height="72" rx="12" fill="#eef7f5" stroke="#16786f" stroke-width="2"/>
      <g fill="#243342" font-size="16" font-weight="700" text-anchor="middle">
        <text data-source x="85" y="60">CLIENT</text><text x="310" y="60">FIREWALL</text><text data-destination x="535" y="60">WEB SERVER</text>
      </g>
      <g fill="#243342" font-size="14" text-anchor="middle">
        <text data-source-ip x="85" y="84">192.168.1.20</text><text data-status x="310" y="84">WAITING</text><text data-destination-ip x="535" y="84">10.0.1.10</text>
        <text data-caption x="310" y="133">Source → inspection → destination</text>
      </g>
      <g data-packet transform="translate(160 66)" visibility="hidden"><circle data-halo r="13" fill="none" stroke="#ad502b" stroke-width="2" opacity="0.5"/><circle data-dot r="7" fill="#ad502b" stroke="#ffffff" stroke-width="2"/></g>
    </svg>`;
  route.appendChild(wrapper);
  const svg = wrapper.querySelector('svg');
  visual = { svg, packet: svg.querySelector('[data-packet]'), halo: svg.querySelector('[data-halo]'), dot: svg.querySelector('[data-dot]'), firewall: svg.querySelector('[data-firewall]') };
}

function setVisualState(status, color = '#ad502b') {
  if (!visual) return;
  visual.svg.querySelector('[data-status]').textContent = status;
  visual.firewall.setAttribute('stroke', color);
  visual.dot.setAttribute('fill', color);
  visual.halo.setAttribute('stroke', color);
}

function setBadge(text, tone = 'neutral') {
  $('decisionBadge').className = `decision-badge ${tone}`;
  $('decisionBadge').textContent = text;
}

function explain(title, body, tone = 'neutral') {
  const target = $('decisionExplain');
  target.className = `decision-explain ${tone}`;
  target.replaceChildren();
  const symbol = document.createElement('span');
  symbol.className = 'explain-symbol';
  symbol.textContent = tone === 'allow' ? '✓' : tone === 'deny' ? '!' : 'i';
  const content = document.createElement('div');
  const heading = document.createElement('b');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = body;
  content.append(heading, copy);
  target.append(symbol, content);
}

function addTrace(run, title, body, state = 'current', label = 'CHECKING') {
  if (activeRun !== run) return;
  const row = document.createElement('div');
  row.className = `trace-step ${state}`;
  const number = document.createElement('span');
  number.className = 'step-number';
  number.textContent = String(++run.step);
  const content = document.createElement('div');
  const heading = document.createElement('b');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = body;
  const status = document.createElement('span');
  status.className = 'step-state';
  status.textContent = label;
  content.append(heading, copy);
  row.append(number, content, status);
  $('traceList').appendChild(row);
}

// Each scheduled operation owns a cleanup callback that also settles its promise.
function wait(run, duration) {
  return new Promise(resolve => {
    const cleanup = () => { clearTimeout(timer); run.cleanups.delete(cleanup); resolve(); };
    const timer = setTimeout(cleanup, duration);
    run.cleanups.add(cleanup);
  });
}

function animate(run, duration, update) {
  if (reducedMotion.matches || !visual) {
    update(1);
    return Promise.resolve();
  }
  return new Promise(resolve => {
    let frame;
    let started;
    const cleanup = () => { cancelAnimationFrame(frame); run.cleanups.delete(cleanup); resolve(); };
    run.cleanups.add(cleanup);
    function tick(now) {
      if (activeRun !== run) { cleanup(); return; }
      if (started === undefined) started = now;
      const progress = Math.min((now - started) / duration, 1);
      update(progress);
      if (progress === 1) cleanup();
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  });
}

function movePacket(run, from, to) {
  return animate(run, 800, progress => {
    visual?.packet.setAttribute('transform', `translate(${from + (to - from) * progress} 66)`);
  });
}

function stopRun(showCancellation = false) {
  const previous = activeRun;
  activeRun = null;
  if (previous) {
    for (const cleanup of [...previous.cleanups]) cleanup();
    if (showCancellation) {
      setBadge('CANCELLED');
      explain('Simulation cancelled', 'The current trace is stopped. Start a new simulation to inspect another request.');
      setVisualState('CANCELLED');
      visual?.svg.setAttribute('aria-label', 'Simulation cancelled; packet stopped');
    }
  }
  visual?.halo.setAttribute('r', '13');
  visual?.halo.setAttribute('opacity', '0.5');
  if ($('cancelSimulation')) $('cancelSimulation').disabled = true;
}

function setFormError(message, field) {
  ['sourceSelect', 'destinationSelect', 'customPort'].forEach(id => $(id)?.removeAttribute('aria-invalid'));
  if ($('formError')) {
    $('formError').textContent = message;
    $('formError').hidden = !message;
    $('formError').setAttribute('role', 'alert');
  }
  if (message) {
    field?.setAttribute('aria-invalid', 'true');
    setBadge('INVALID');
    explain('Check the packet details', message);
    field?.focus();
  }
}

function getPacket() {
  const source = $('sourceSelect').value;
  const destination = $('destinationSelect').value;
  const rawPort = ($('portSelect').value === 'custom' ? $('customPort').value : $('portSelect').value).trim();
  if (!nodes[source] || !nodes[destination]) {
    setFormError('Select a valid source and destination.', $('sourceSelect'));
    return null;
  }
  if (source === destination) {
    setFormError('Source and destination must be different endpoints.', $('destinationSelect'));
    return null;
  }
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    setFormError('Enter a whole-number port from 1 to 65535.', $('portSelect').value === 'custom' ? $('customPort') : $('portSelect'));
    return null;
  }
  setFormError('');
  return { source, destination, port: String(port), protocol: $('protocolSelect').value };
}

async function startSimulation(event) {
  event?.preventDefault();
  stopRun();
  $('traceList').replaceChildren();
  visual?.packet.setAttribute('visibility', 'hidden');
  setVisualState('WAITING');
  const packet = getPacket();
  if (!packet) return;
  const source = nodes[packet.source];
  const destination = nodes[packet.destination];
  const policy = rules.map(item => ({ ...item }));
  const ruleIndex = policy.findIndex(item => item.source === packet.source && item.destination === packet.destination && item.port === packet.port);
  const rule = policy[ruleIndex];
  const allowed = rule?.decision === 'ALLOW';
  const run = { cleanups: new Set(), step: 0, policy };
  activeRun = run;
  if ($('cancelSimulation')) $('cancelSimulation').disabled = false;
  $('routeSource').textContent = source.label;
  $('routeDestination').textContent = destination.label;
  $('routePort').textContent = packet.port;
  $('resultTitle').textContent = `${source.name} → ${destination.name}`;
  setBadge('IN TRANSIT');
  explain('Decision pending', 'The firewall has not made a decision yet. ' + modelNote);
  if (visual) {
    visual.svg.querySelector('[data-source]').textContent = source.label;
    visual.svg.querySelector('[data-destination]').textContent = destination.label;
    visual.svg.querySelector('[data-source-ip]').textContent = source.ip;
    visual.svg.querySelector('[data-destination-ip]').textContent = destination.ip;
    visual.svg.querySelector('[data-caption]').textContent = `${packet.protocol} · port ${packet.port} · decision pending`;
    visual.svg.setAttribute('aria-label', `${source.name} to ${destination.name}, firewall decision pending`);
    visual.packet.setAttribute('transform', 'translate(160 66)');
    visual.packet.setAttribute('visibility', 'visible');
  }
  addTrace(run, 'Packet created', `${packet.protocol} packet from ${source.ip} to ${destination.ip}:${packet.port}.`, 'current', 'CREATED');
  await movePacket(run, 160, 250);
  if (activeRun !== run) return;
  addTrace(run, 'Packet reaches firewall', 'The packet stops at the access-control checkpoint before entering the destination tier.', 'current', 'ARRIVED');
  setBadge('INSPECTING');
  setVisualState('INSPECTING');
  await wait(run, 400);
  if (activeRun !== run) return;
  addTrace(run, 'Firewall checks the request', `Comparing ${source.name} → ${destination.name} :${packet.port} against the six rules. ${modelNote}`);
  await animate(run, 1000, progress => {
    visual?.halo.setAttribute('r', String(13 + 6 * Math.sin(progress * Math.PI * 4) ** 2));
    visual?.halo.setAttribute('opacity', String(0.4 + 0.5 * Math.sin(progress * Math.PI * 4) ** 2));
  });
  // Preserve a readable inspection pause even when movement is reduced.
  if (reducedMotion.matches) await wait(run, 650);
  if (activeRun !== run) return;
  const tone = allowed ? 'allow' : 'deny';
  const color = allowed ? '#16786f' : '#b54c42';
  setBadge(allowed ? 'ALLOWED' : 'BLOCKED', tone);
  setVisualState(allowed ? 'ALLOWED' : 'BLOCKED', color);
  addTrace(run, rule ? `Rule R-0${ruleIndex + 1} says ${rule.decision}` : 'No matching rule', rule ? ruleReason(rule, ruleIndex) : 'No explicit rule matches these endpoints and port. Deny-by-default policy blocks the request.', allowed ? 'success' : 'danger', allowed ? 'ALLOWED' : 'BLOCKED');
  explain(allowed ? 'Why it is allowed' : 'Why it is blocked', `${rule ? ruleReason(rule, ruleIndex) : 'No matching firewall rule was found, so deny-by-default applies.'} Recommended baseline: ${correctPath} ${modelNote}`, tone);
  if (visual) {
    visual.svg.querySelector('[data-caption]').textContent = allowed ? 'Authorized request proceeds to its destination' : 'Blocked at the firewall · destination not reached';
    visual.svg.setAttribute('aria-label', `${source.name} to ${destination.name}: ${allowed ? 'allowed; packet proceeding to destination' : 'blocked at firewall'}`);
  }
  if (allowed) {
    // Transit across the approved checkpoint, then along the second edge-to-edge path.
    await movePacket(run, 250, 370);
    if (activeRun !== run) return;
    await movePacket(run, 370, 460);
  } else {
    await wait(run, 500);
  }
  if (activeRun !== run) return;
  addTrace(run, allowed ? 'Destination reached' : 'Packet stopped', allowed ? `This request reaches ${destination.name} on port ${packet.port}. Recommended baseline: ${correctPath}` : `The packet remains at the firewall and is not delivered. Recommended baseline: ${correctPath}`, allowed ? 'success' : 'danger', allowed ? 'DELIVERED' : 'BLOCKED');
  visual?.svg.setAttribute('aria-label', `${source.name} to ${destination.name}: ${allowed ? 'allowed and delivered to destination' : 'blocked at firewall'}`);
  activeRun = null;
  if ($('cancelSimulation')) $('cancelSimulation').disabled = true;
}

function setScenario(source, destination, port) {
  $('sourceSelect').value = source;
  $('destinationSelect').value = destination;
  $('portSelect').value = String(port);
  $('customPortWrap').hidden = true;
  startSimulation();
}

function showSection(requestedId) {
  if (requestedId !== 'learn') stopLessonSequence();
  const sections = [...document.querySelectorAll('.page-section')];
  const id = sections.some(section => section.id === requestedId) ? requestedId : (sections.find(section => section.id === 'overview') || sections[0])?.id;
  sections.forEach(section => {
    const active = section.id === id;
    section.classList.toggle('active-section', active);
    section.hidden = !active;
  });
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    const active = item.dataset.section === id;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
}

if (typeof document !== 'undefined') {
document.querySelectorAll('.nav-item[data-section]').forEach(item => {
  item.addEventListener('click', () => showSection(item.dataset.section));
});
window.addEventListener('hashchange', () => showSection(location.hash.slice(1)));
$('startSimulation').addEventListener('click', startSimulation);
$('cancelSimulation')?.addEventListener('click', event => { event.preventDefault(); stopRun(true); });
$('portSelect').addEventListener('change', event => {
  $('customPortWrap').hidden = event.target.value !== 'custom';
  setFormError('');
});
const scenarios = {
  'blocked-db': ['client', 'database', 3306],
  'allowed-app': ['app', 'database', 3306],
  'allowed-web': ['client', 'web', 443]
};
document.querySelectorAll('[data-scenario]').forEach(button => {
  button.addEventListener('click', event => {
    event.preventDefault();
    const scenario = scenarios[button.dataset.scenario];
    if (scenario) setScenario(...scenario);
  });
});
window.addEventListener('pagehide', () => { stopRun(); stopLessonSequence(); });
$('rulesTable').addEventListener('change', event => {
  const select = event.target.closest('.rule-decision[data-rule-index]');
  if (!select || !changeRule(Number(select.dataset.ruleIndex), select.value)) return;
  invalidatePolicyResult();
  renderRules();
  $('rulesTable').querySelector(`[data-rule-index="${select.dataset.ruleIndex}"]`)?.focus();
});
$('resetRules')?.addEventListener('click', () => {
  resetRules();
  invalidatePolicyResult();
  renderRules();
});
renderRules();
renderLearn();
createRouteVisual();
if ($('cancelSimulation')) $('cancelSimulation').disabled = true;
showSection(location.hash.slice(1));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { defaultRules, ruleReason, changeRule, resetRules, exercises, gradeExercise, resetLearning, modeledService, transportSnapshot, tierRequest, getRules: () => rules.map(rule => ({ ...rule })) };
}
