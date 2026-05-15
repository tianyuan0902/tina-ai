const sessions = [
  {
    id: "founding-ai-engineer",
    title: "Founding AI Engineer",
    updatedAt: "Today",
    brief: {
      roleTitle: "Founding AI Engineer",
      whyNow: "The prototype is working, but the founder is still carrying product and engineering.",
      businessProblem: "Turn a promising AI hiring prototype into a production product.",
      firstNinetyDays: "Ship Tina kickoff workflow, evaluation, and a clean data model.",
      mustHaveSkills: ["LLM product engineering", "Python", "TypeScript", "retrieval", "evaluation", "startup ownership", "security"],
      niceToHaveSkills: ["recruiting domain", "ATS integrations", "data pipelines", "crypto"],
      targetCompanies: ["OpenAI", "Anthropic", "Clay", "Gem", "Coinbase"],
      compensationRange: "$160,000-$190,000",
      location: "United States",
      workMode: "Remote",
      seniority: "Staff",
      tradeoffs: ["Relax exact crypto experience", "Consider senior instead of staff"],
      failureModes: ["Cannot ship product", "Too research-heavy", "Needs too much structure"]
    }
  },
  {
    id: "senior-product-designer",
    title: "Senior Product Designer",
    updatedAt: "Yesterday",
    brief: {
      roleTitle: "Senior Product Designer",
      whyNow: "Enterprise users are expanding, but the workflow feels too dense.",
      businessProblem: "Make hiring intelligence workflows simpler, faster, and more credible.",
      firstNinetyDays: "Redesign the kickoff-to-brief experience and validate with 10 hiring managers.",
      mustHaveSkills: ["B2B SaaS", "interaction design", "customer research", "design systems"],
      niceToHaveSkills: ["AI product experience", "analytics", "recruiting workflows"],
      targetCompanies: ["Linear", "Retool", "Notion", "Rippling", "Figma"],
      compensationRange: "$155,000-$190,000",
      location: "New York",
      workMode: "Hybrid",
      seniority: "Senior",
      tradeoffs: ["Trade AI experience for excellent workflow design"],
      failureModes: ["Portfolio is beautiful but not operational", "Needs a large design team"]
    }
  },
  {
    id: "head-of-people",
    title: "Head of People",
    updatedAt: "Last week",
    brief: {
      roleTitle: "Head of People",
      whyNow: "The company is outgrowing founder-led hiring.",
      businessProblem: "Create a people operating system without adding enterprise process too early.",
      firstNinetyDays: "Build hiring rituals, manager coaching cadence, and lightweight performance basics.",
      mustHaveSkills: ["startup recruiting", "manager coaching", "people systems", "org design"],
      niceToHaveSkills: ["compensation philosophy", "technical hiring", "HR compliance"],
      targetCompanies: ["Gusto", "Ramp", "Rippling", "Lattice", "Stripe"],
      compensationRange: "$180,000-$230,000",
      location: "San Francisco",
      workMode: "Hybrid",
      seniority: "Head",
      tradeoffs: ["Can hire stronger talent leader if people ops support is added"],
      failureModes: ["Over-processes the company", "Weak manager trust", "Cannot recruit directly"]
    }
  }
];

const emptyBrief = {
  roleTitle: "",
  whyNow: "",
  businessProblem: "",
  firstNinetyDays: "",
  mustHaveSkills: [],
  niceToHaveSkills: [],
  targetCompanies: [],
  compensationRange: "",
  location: "",
  workMode: "Remote",
  seniority: "",
  tradeoffs: [],
  failureModes: []
};

const steps = [
  ["role", "Direction", "Tell me the messy version of the hire. Role, business need, team context, uncertainty, whatever you have."],
  ["context", "Shape", "What would feel different in the company if this hire works? A broad answer is fine."],
  ["mission", "Examples", "I see a few possible candidate lanes emerging. Which feels closest to the gap you are trying to solve?"],
  ["constraints", "Bounds", "What practical boundaries should we respect for now: comp, location, must-haves, or anything that cannot move yet?"],
  ["failureModes", "Revisit", "What should we remember to revisit later as the company learns more?"]
];

const tracker = ["Direction", "Shape", "Examples", "Bounds", "Revisit", "Brief"];

let currentBrief = JSON.parse(localStorage.getItem("tina_brief") || JSON.stringify(emptyBrief));
let currentMessages = JSON.parse(localStorage.getItem("tina_messages") || "null") || [
  {
    role: "tina",
    content:
      "I am Tina. We do not need to make the role perfectly precise before moving. Startup hiring usually starts with a fuzzy business need and gets clearer as the market responds.\n\nTell me the messy version of the hire: what prompted it, what you think you need, and where you are still unsure."
  }
];
let stepIndex = Number(localStorage.getItem("tina_step") || 0);
let activeBrief = sessions[0].brief;

function analyze(brief) {
  const text = JSON.stringify(brief).toLowerCase();
  const niche = ["ai", "llm", "crypto", "security", "infrastructure", "executive"].filter((x) => text.includes(x)).length;
  const roleSpread = ["design", "engineering", "product", "people", "sales", "marketing", "data", "operations"].filter((x) => text.includes(x)).length;
  const senior = /staff|principal|head|director|vp|executive/i.test(`${brief.roleTitle} ${brief.seniority}`);
  const maxComp = Math.max(...(brief.compensationRange.match(/\d[\d,]*/g) || ["0"]).map((x) => Number(x.replace(/,/g, ""))).map((x) => (x < 1000 ? x * 1000 : x)));
  const compPenalty = senior && maxComp && maxComp < 210000 ? 14 : /ai/i.test(brief.roleTitle) && maxComp < 220000 ? 16 : 0;
  const mustPenalty = Math.max(0, brief.mustHaveSkills.length - 4) * 7;
  const modeBoost = brief.workMode === "Remote" ? 10 : brief.workMode === "Hybrid" ? 3 : -8;
  const feasibility = clamp(84 + modeBoost - (senior ? 13 : 0) - mustPenalty - niche * 7 - compPenalty, 16, 96);
  const clarityFields = [brief.roleTitle, brief.whyNow, brief.businessProblem, brief.firstNinetyDays, brief.compensationRange, brief.mustHaveSkills.join(""), brief.tradeoffs.join(""), brief.failureModes.join("")];
  const clarity = clamp(Math.round((clarityFields.filter(Boolean).length / clarityFields.length) * 100) - Math.max(0, roleSpread - 3) * 8, 24, 96);
  const contradictions = [];
  if (brief.mustHaveSkills.length > 6) contradictions.push("The role may be carrying a few different jobs at once. We can keep moving, but it will help to watch which part becomes most important.");
  if (compPenalty > 10) contradictions.push("The compensation range may narrow the seniority band. That can still work, but it may point us toward high-upside builders.");
  if (roleSpread >= 5) contradictions.push("The ask touches several role families. The first market pass should reveal which lane has the best signal.");
  if (senior && niche >= 2 && brief.workMode !== "Remote") contradictions.push("This search may eventually ask us to flex on exact domain, seniority, compensation, or location.");
  const missing = [];
  if (!brief.whyNow) missing.push("Why this hire matters now");
  if (!brief.businessProblem) missing.push("Business problem");
  if (!brief.firstNinetyDays) missing.push("90-day outcomes");
  if (!brief.compensationRange) missing.push("Compensation range");
  if (!brief.mustHaveSkills.length) missing.push("True must-have skills");
  if (!brief.tradeoffs.length) missing.push("Acceptable tradeoffs");
  const difficulty = feasibility < 42 || niche >= 4 ? "Severe" : feasibility < 62 || brief.mustHaveSkills.length > 6 || niche >= 2 ? "High" : feasibility < 78 ? "Moderate" : "Low";
  return {
    feasibility,
    clarity,
    difficulty,
    simulation: getSimulation({ brief, feasibility, difficulty, niche, senior, compPenalty, mustCount: brief.mustHaveSkills.length }),
    timeToFill: `${difficulty === "Severe" ? 17 : difficulty === "High" ? 13 : difficulty === "Moderate" ? 8 : 5}-${difficulty === "Severe" ? 21 : difficulty === "High" ? 17 : difficulty === "Moderate" ? 12 : 9} weeks`,
    comp: compPenalty > 12 ? "Under-market" : compPenalty > 5 ? "Borderline" : "Competitive",
    status: contradictions.length >= 3 || feasibility < 45 ? "Keep flexible" : contradictions.length || feasibility < 72 ? "Still forming" : "Clear enough",
    contradictions,
    missing,
    assumptions: [
      brief.roleTitle ? `Working direction: ${brief.seniority || "senior"} ${brief.roleTitle}.` : "We are still forming the working shape of the role.",
      brief.compensationRange ? `Current compensation frame: ${brief.compensationRange}.` : "Compensation can stay open for now.",
      brief.workMode ? `Current location shape: ${brief.workMode}.` : "Location flexibility is not yet clear."
    ],
    observations: [
      difficulty === "High" || difficulty === "Severe" ? "This is a narrower market, so the first pass should teach us which candidate lane responds best." : "This looks workable as a directional first pass.",
      brief.workMode === "Remote" ? "Remote flexibility keeps the search moving while the role shape is still evolving." : "Location constraints are manageable, but early calibration quality matters more than volume.",
      niche > 1 ? "Exact domain overlap may be rare. Adjacent problem-shape matches could be useful." : "The role is not yet overly niche."
    ],
    previews: getArchetypePreviews(brief),
    archetypes: [
      `${brief.seniority || "Senior"} operator from an adjacent startup who has solved the same problem.`,
      "High-upside builder one level below target with evidence of steep ownership growth.",
      "Specialist from a target company who may need stronger comp or clearer scope."
    ],
    tradeoffs: [...brief.tradeoffs, ...(brief.mustHaveSkills.length > 5 ? ["Move weaker must-haves into nice-to-have."] : []), ...(compPenalty > 8 ? ["Raise comp or lower seniority by one level."] : [])],
    summary: `${brief.roleTitle || "This role"} has ${feasibility < 55 ? "a useful direction, but should stay flexible while the team learns" : "enough shape to move forward as a working brief"}.`,
    mission: brief.businessProblem || "A clearly scoped business problem still needs to be defined.",
    market: difficulty === "High" || difficulty === "Severe" ? "The first market pass should help clarify which parts of the profile matter most." : "There is enough market supply to begin directionally and refine from signal.",
    revisedJd: `${brief.roleTitle || "This hire"} will own ${brief.businessProblem || "a clearly defined company priority"} and deliver ${brief.firstNinetyDays || "measurable progress in the first 90 days"}.`
  };
}

function getSimulation({ brief, feasibility, difficulty, niche, senior, compPenalty, mustCount }) {
  const lab = /openai|anthropic|deepmind|meta ai|frontier lab|frontier ai/i.test(JSON.stringify(brief));
  const locationNarrow = brief.workMode === "Onsite" || (!!brief.location && !/remote|united states|us/i.test(brief.location));
  const narrowness = niche + (senior ? 1 : 0) + (lab ? 2 : 0) + (locationNarrow ? 1 : 0) + Math.max(0, mustCount - 5);
  return {
    feasibility: feasibility >= 75 ? "High" : feasibility >= 52 ? "Medium" : "Low",
    difficulty: difficulty === "Severe" || lab ? "Very High" : difficulty,
    timeline: narrowness >= 5 ? "75-120 days" : narrowness >= 3 ? "60-90 days" : narrowness >= 1 ? "45-60 days" : "30-45 days",
    talentPool: narrowness >= 5 ? "Very narrow" : narrowness >= 3 ? "Narrow" : brief.workMode === "Remote" ? "Broad" : "Moderate",
    comp: compPenalty > 12 ? "Below market" : compPenalty > 5 ? "Competitive" : "Strong",
    compPressure: compPenalty > 12 || lab ? "Likely +35%+" : senior || niche > 1 ? "Likely +20-35%" : niche > 0 ? "Likely +10-20%" : "Stable"
  };
}

function getArchetypePreviews(brief) {
  const role = brief.roleTitle.toLowerCase();
  if (role.includes("ai") || role.includes("engineer")) {
    return [
      ["Frontier AI Research Engineer", "deep ML depth", "expensive and may move slower", "$240k-$350k+", "frontier labs, AI infra", "Very narrow", "Very high"],
      ["Startup AI Product Engineer", "fast execution", "less theoretical depth", "$185k-$260k", "AI SaaS, workflow automation", "Moderate", "Moderate-high"],
      ["Infra-heavy Backend Engineer with AI Exposure", "scalable systems", "weaker model intuition", "$175k-$240k", "data platforms, search, infra", "Broad", "Moderate"]
    ];
  }
  if (role.includes("designer")) {
    return [
      ["Workflow Product Designer", "simplifies dense software", "less brand polish", "$155k-$210k", "B2B SaaS, dev tools", "Moderate", "Moderate-high"],
      ["AI Product Designer", "probabilistic UX judgment", "smaller pool", "$180k-$240k", "AI tools, data products", "Narrow", "High"],
      ["Research-led Design Strategist", "sharp customer insight", "may ship slower", "$145k-$195k", "marketplaces, enterprise SaaS", "Moderate", "Moderate"]
    ];
  }
  return [
    ["Proven Functional Leader", "pattern recognition", "may bring too much process", "$210k-$300k", "scaling SaaS", "Narrow", "High"],
    ["Rising Startup Operator", "hands-on velocity", "less executive range", "$160k-$230k", "Series A/B startups", "Moderate", "Moderate-high"],
    ["Specialist Expanding Scope", "deep craft spike", "needs scope clarity", "$150k-$220k", "specialist teams", "Broad", "Moderate"]
  ];
}

function route(name) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  document.getElementById(name).classList.add("active");
  location.hash = name;
  if (name === "home") renderHome();
  if (name === "kickoff") renderKickoff();
  if (name === "brief") renderBrief();
}

function renderHome() {
  document.getElementById("sessionCards").innerHTML = sessions
    .map((session) => {
      const intel = analyze(session.brief);
      return `<button class="session-card" data-session="${session.id}">
        <span class="badge ${intel.status === "Keep flexible" ? "danger" : intel.status === "Still forming" ? "warning" : ""}">${intel.status}</span>
        <h3>${session.title}</h3>
        <p>${intel.summary}</p>
        <div class="progress" style="--value:${intel.feasibility}%"><span></span></div>
      </button>`;
    })
    .join("");
  document.querySelectorAll("[data-session]").forEach((button) => {
    button.addEventListener("click", () => {
      activeBrief = sessions.find((s) => s.id === button.dataset.session).brief;
      route("brief");
    });
  });
}

function renderKickoff() {
  renderTracker();
  renderMessages();
  renderPanel();
}

function renderTracker() {
  const active = stepIndex >= steps.length ? "Brief" : steps[stepIndex][1];
  const activeIndex = tracker.indexOf(active);
  document.getElementById("progressTracker").innerHTML = tracker
    .map((item, index) => `<span class="${item === active ? "active" : index < activeIndex ? "done" : ""}">${index + 1}. ${item}</span>`)
    .join("");
}

function renderMessages() {
  const container = document.getElementById("messages");
  container.innerHTML = currentMessages
    .map((message) => `<div class="message ${message.role}">
      ${message.role === "tina" ? '<div class="avatar">T</div>' : ""}
      <div class="bubble">${escapeHtml(message.content)}</div>
      ${message.role === "user" ? '<div class="avatar">Y</div>' : ""}
    </div>${message.insight ? insightCard(message.insight) : ""}${message.marketShift ? marketShiftCard(message.marketShift) : ""}`)
    .join("");
  container.scrollTop = container.scrollHeight;
}

function renderPanel() {
  const intel = analyze(currentBrief);
  document.getElementById("livePanel").innerHTML = `
    <div>
      <p class="eyebrow">Evolving hiring workspace</p>
      <h2>${currentBrief.roleTitle || "Untitled role"}</h2>
      <p>${intel.summary}</p>
    </div>
    <div class="panel-section">
      <h3>Working read</h3>
      <p>${intel.simulation.feasibility} feasibility</p>
      <div class="progress" style="--value:${intel.clarity}%"><span></span></div>
    </div>
    <div class="metric-grid">
      ${metric("Talent pool", intel.simulation.talentPool)}
      ${metric("Timeline", intel.simulation.timeline)}
      ${metric("Difficulty", intel.simulation.difficulty)}
      ${metric("Comp pressure", intel.simulation.compPressure)}
    </div>
    <div class="panel-section market-controls">
      <h3>Try a market move</h3>
      <button data-calibrate="frontier">Require frontier lab pedigree</button>
      <button data-calibrate="flex-lab">Keep lab pedigree flexible</button>
      <button data-calibrate="remote">Expand to remote</button>
    </div>
    <div class="panel-section"><h3>Evolving role summary</h3><p>${intel.revisedJd}</p></div>
    ${panelTags("Open assumptions", intel.assumptions, "Tina is still reading the ask")}
    ${panelTags("Areas to revisit", intel.contradictions.length ? intel.contradictions : ["No urgent revisit areas yet. We can keep moving."], "No urgent revisit areas yet")}
    ${panelTags("Market notes", intel.observations, "No market read yet")}
    <div class="panel-section">
      <h3>Candidate archetype comparison</h3>
      ${intel.previews.map((item) => `<div class="archetype-card">
        <h4>${item[0]}</h4>
        <p><strong>Strong:</strong> ${item[1]}</p>
        <p><strong>Tradeoff:</strong> ${item[2]}</p>
        <p><strong>Comp:</strong> ${item[3]}</p>
        <p><strong>Background:</strong> ${item[4]}</p>
        <p><strong>Availability:</strong> ${item[5] || "Moderate"}</p>
        <p><strong>Comp pressure:</strong> ${item[6] || "Moderate"}</p>
        <button data-archetype="${escapeHtml(item[0])}">Test this lane</button>
      </div>`).join("")}
    </div>
    ${panelTags("Tradeoffs to monitor", intel.tradeoffs.length ? intel.tradeoffs : ["No hard tradeoff yet. That is okay at this stage."], "No hard tradeoff yet")}
  `;
  attachCalibrationControls();
}

function renderBrief() {
  const brief = activeBrief || currentBrief;
  const intel = analyze(brief);
  document.getElementById("briefView").innerHTML = `
    <div class="brief-header">
      <div>
        <span class="badge ${intel.status === "Keep flexible" ? "danger" : intel.status === "Still forming" ? "warning" : ""}">${intel.status}</span>
        <h1>${brief.roleTitle || "Draft Hiring Kickoff"}</h1>
        <p>${intel.summary}</p>
      </div>
      <button class="primary" data-route="kickoff">Run another kickoff</button>
    </div>
    <div class="metrics-row">
      ${metric("Feasibility", intel.simulation.feasibility)}
      ${metric("Talent pool", intel.simulation.talentPool)}
      ${metric("Time to fill", intel.simulation.timeline)}
      ${metric("Comp pressure", intel.simulation.compPressure)}
    </div>
    <div class="brief-grid">
      ${briefCard("What We Know", `<p>${intel.summary}</p><strong>Business driver</strong><p>${brief.whyNow || "Broad growth need"}</p>`)}
      ${briefCard("What We Are Assuming", tags(intel.assumptions))}
      ${briefCard("What Stays Flexible", tags(intel.tradeoffs.length ? intel.tradeoffs : ["Exact success definition", "Seniority band", "Adjacent company backgrounds"]))}
      ${briefCard("Market Reality", `<p>${intel.market}</p><p>Talent pool: ${intel.simulation.talentPool}</p><p>Compensation: ${intel.simulation.comp}; ${intel.simulation.compPressure}</p>`)}
      ${briefCard("Candidate Archetypes", intel.previews.map((item) => `<div class="archetype-card"><h4>${item[0]}</h4><p>Best for: ${item[1]}</p><p>Tradeoff: ${item[2]}</p><p>Availability: ${item[5]}</p><p>Comp pressure: ${item[6]}</p></div>`).join(""))}
      ${briefCard("Target Company Clusters", tags(brief.targetCompanies.length ? brief.targetCompanies : ["Adjacent startups", "Category leaders", "Mission-aligned teams"]))}
      ${briefCard("Skill Calibration", `<strong>Must-have</strong>${tags(brief.mustHaveSkills)}<strong>Nice-to-have</strong>${tags(brief.niceToHaveSkills)}`)}
      ${briefCard("Tradeoffs to Monitor", tags(intel.contradictions.length ? intel.contradictions : ["No urgent revisit areas yet."]))}
      ${briefCard("Recommended Tradeoffs", tags(intel.tradeoffs.length ? intel.tradeoffs : ["Maintain current criteria during calibration."]))}
      ${briefCard("Suggested First-Pass Search Strategy", intel.difficulty === "High" || intel.difficulty === "Severe" ? "Start with a few candidate archetypes and let the market help sharpen the role before writing a fixed search brief." : "Begin directionally across target companies and adjacent problem spaces, then refine from signal.")}
      ${briefCard("Recalibration After 5-10 Conversations", tags(["Which archetype creates the strongest pull?", "Whether compensation matches the working profile", "Whether the role wants a specialist or a broader operator", "Whether the 90-day success definition has changed"]))}
      ${briefCard("Interview Plan", tags(["Recruiter kickoff screen", "Hiring manager problem deep dive", "90-day work sample", "Cross-functional operating interview", "Founder close"]))}
      ${briefCard("Scorecard Dimensions", tags(["scope judgment", "execution under ambiguity", "communication clarity", "product judgment"]))}
      ${briefCard("Living JD Draft", intel.revisedJd)}
    </div>
  `;
  document.querySelectorAll("[data-route]").forEach((el) => el.addEventListener("click", () => route(el.dataset.route)));
}

function submitAnswer() {
  const input = document.getElementById("answerInput");
  const value = input.value.trim();
  if (!value || stepIndex >= steps.length) return;
  const [key] = steps[stepIndex];
  const beforeBrief = JSON.parse(JSON.stringify(currentBrief));
  currentMessages.push({ role: "user", content: value });
  applyAnswer(key, value);
  stepIndex += 1;
  const next = stepIndex < steps.length ? steps[stepIndex][2] : "We have enough to create a working kickoff brief. It does not need to be final; it should give the team a shared starting point.";
  const intel = analyze(currentBrief);
  const before = analyze(beforeBrief).simulation;
  const after = intel.simulation;
  const changed = describeMarketChange(value, beforeBrief, currentBrief);
  const marketShift = before.talentPool !== after.talentPool || before.timeline !== after.timeline || before.comp !== after.comp || changed
    ? {
        changed: changed || "Role direction evolved",
        talentPoolBefore: before.talentPool,
        talentPoolAfter: after.talentPool,
        timelineBefore: before.timeline,
        timelineAfter: after.timeline,
        compBefore: before.comp,
        compAfter: after.comp,
        suggestedMove: getShiftMove(currentBrief, after)
      }
    : null;
  const synthesis = advisorSynthesis(currentBrief, intel);
  const ambiguityNote = /growth need|don't know|not sure|unclear|broad|mostly growth/i.test(JSON.stringify(currentBrief))
    ? "\n\nTotally reasonable for this stage. We can move forward with a broad direction for now. I’ll keep the exact success definition as an open assumption, because it may affect role scope, seniority, and future team structure later."
    : "";
  const archetypeText = key === "mission" || key === "archetypeChoice" ? `\n\nI see three plausible lanes:\n\n${formatArchetypes(intel.previews)}` : "";
  const pushback = (intel.contradictions[0] || intel.observations[0]) ? `\n\n${intel.contradictions[0] || intel.observations[0]}` : "";
  currentMessages.push({
    role: "tina",
    content: `${synthesis}${ambiguityNote}${pushback}${archetypeText}\n\n${next}`,
    insight: {
      title: intel.contradictions[0] ? "Tradeoff to monitor" : "Market note",
      body: intel.contradictions[0] || intel.observations[0],
      action: intel.tradeoffs[0] || "We can keep moving and revisit this after the first market signal."
    },
    marketShift
  });
  input.value = "";
  saveState();
  renderKickoff();
}

function attachCalibrationControls() {
  document.querySelectorAll("[data-calibrate]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.calibrate;
      if (action === "frontier") applyCalibration("Added frontier lab pedigree", "Require prior OpenAI or Anthropic experience.");
      if (action === "flex-lab") applyCalibration("Relaxed pedigree requirement", "Treat frontier lab experience as nice-to-have, not required.");
      if (action === "remote") applyCalibration("Expanded to remote", "Allow remote candidates across US time zones.");
    });
  });
  document.querySelectorAll("[data-archetype]").forEach((button) => {
    button.addEventListener("click", () => {
      applyCalibration(`Test ${button.dataset.archetype}`, `Use ${button.dataset.archetype} as the primary calibration lane.`);
    });
  });
}

function applyCalibration(label, instruction) {
  const beforeBrief = JSON.parse(JSON.stringify(currentBrief));
  if (instruction.includes("OpenAI") || instruction.includes("Anthropic")) {
    currentBrief.targetCompanies = Array.from(new Set([...currentBrief.targetCompanies, "OpenAI", "Anthropic"]));
    currentBrief.mustHaveSkills = Array.from(new Set([...currentBrief.mustHaveSkills, "frontier AI lab experience"]));
  }
  if (instruction.includes("nice-to-have")) {
    currentBrief.niceToHaveSkills = Array.from(new Set([...currentBrief.niceToHaveSkills, "frontier lab experience"]));
    currentBrief.mustHaveSkills = currentBrief.mustHaveSkills.filter((skill) => !/frontier|openai|anthropic/i.test(skill));
  }
  if (instruction.includes("remote")) {
    currentBrief.workMode = "Remote";
    currentBrief.location = "US time zones";
  }
  if (instruction.includes("primary calibration lane")) {
    currentBrief.tradeoffs = Array.from(new Set([...currentBrief.tradeoffs, "Use archetype fit to guide the first market pass."]));
    currentBrief.candidateProfiles = [instruction.replace("Use ", "").replace(" as the primary calibration lane.", "")];
  }

  const before = analyze(beforeBrief).simulation;
  const intel = analyze(currentBrief);
  const after = intel.simulation;
  const marketShift = {
    changed: label,
    talentPoolBefore: before.talentPool,
    talentPoolAfter: after.talentPool,
    timelineBefore: before.timeline,
    timelineAfter: after.timeline,
    compBefore: before.comp,
    compAfter: after.comp,
    suggestedMove: getShiftMove(currentBrief, after)
  };

  currentMessages.push({
    role: "tina",
    content: `${label}. ${intel.observations[0]} We can treat this as a reversible calibration move rather than locking the role too early.`,
    insight: {
      title: "Market reality check",
      body: intel.observations[0],
      action: intel.tradeoffs[0] || "Compare this against the other candidate lanes."
    },
    marketShift
  });
  saveState();
  renderKickoff();
}

function describeMarketChange(answer, before, after) {
  if (/openai|anthropic|deepmind|frontier/i.test(JSON.stringify(after)) && !/openai|anthropic|deepmind|frontier/i.test(JSON.stringify(before))) return "Added frontier lab pedigree";
  if (before.workMode !== after.workMode) return `Changed location model to ${after.workMode}`;
  if (before.compensationRange !== after.compensationRange && after.compensationRange) return "Updated compensation range";
  if (after.mustHaveSkills.length > before.mustHaveSkills.length) return "Added must-have requirements";
  if (/growth need|don't know|not sure|unclear|broad/i.test(answer)) return "Kept role intentionally broad";
  return "";
}

function getShiftMove(brief, sim) {
  if (/openai|anthropic|deepmind|frontier/i.test(JSON.stringify(brief))) return "Treat lab pedigree as nice-to-have unless frontier AI depth matters more than speed or cost.";
  if (sim.talentPool === "Very narrow" || sim.talentPool === "Narrow") return "Keep one requirement flexible and compare archetypes before narrowing further.";
  if (sim.comp === "Below market") return "Use early conversations to test whether scope and equity offset cash expectations.";
  return "Keep this as a working direction and revisit after the first 5-10 candidate conversations.";
}

function applyAnswer(key, value) {
  if (key === "role") {
    currentBrief.roleTitle = value.match(/(?:hire|hiring|need|for)\s+(?:a|an)?\s*([^,.]+)/i)?.[1]?.trim() || value;
    currentBrief.seniority = value.match(/\b(staff|principal|senior|head|director|vp|founding)\b/i)?.[0] || "";
    currentBrief.workMode = /hybrid/i.test(value) ? "Hybrid" : /onsite|office/i.test(value) ? "Onsite" : "Remote";
    currentBrief.location = /remote/i.test(value) ? "Remote" : value.match(/\b(sf|san francisco|new york|nyc|london|austin|united states|us)\b/i)?.[0] || "";
  } else if (["mustHaveSkills", "niceToHaveSkills", "targetCompanies", "tradeoffs", "failureModes"].includes(key)) {
    currentBrief[key] = parseList(value);
  } else if (key === "context") {
    currentBrief.whyNow = value;
    currentBrief.businessProblem = value.match(/(?:to|because|so that)\s+([^.;]+)/i)?.[1] || value;
  } else if (key === "mission") {
    currentBrief.businessProblem = value;
    currentBrief.firstNinetyDays = value.match(/(?:90 days|first quarter|first three months)[^.,;:]*[:,-]?\s*([^.;]+)/i)?.[1] || currentBrief.firstNinetyDays;
  } else if (key === "archetypeChoice") {
    currentBrief.tradeoffs = Array.from(new Set([...currentBrief.tradeoffs, ...parseList(value)]));
  } else if (key === "constraints") {
    const comp = value.match(/\$?\d[\d,]*\s*(?:k|K)?\s*(?:-|to|–)\s*\$?\d[\d,]*\s*(?:k|K)?/)?.[0];
    if (comp) currentBrief.compensationRange = comp;
    currentBrief.mustHaveSkills = currentBrief.mustHaveSkills.length ? currentBrief.mustHaveSkills : parseList(value).slice(0, 6);
    currentBrief.tradeoffs = Array.from(new Set([...currentBrief.tradeoffs, ...parseList(value).slice(-3)]));
  } else {
    currentBrief[key] = value;
  }
}

function advisorSynthesis(brief, intel) {
  const role = brief.roleTitle || "this role";
  if (intel.status === "Keep flexible") return `My read: ${role} has a useful direction, but we should keep the edges flexible for now. The market will help show which parts are essential and which are nice to have.`;
  if (intel.status === "Still forming") return `My read: ${role} is plausible as a working direction. I would treat the next step as learning which candidate lane feels most natural, not forcing complete precision upfront.`;
  return `My read: ${role} has enough shape to keep moving. We can preserve momentum and let the brief evolve as we learn more.`;
}

function formatArchetypes(previews) {
  return previews.map((item, index) => `${String.fromCharCode(65 + index)}. ${item[0]}\n- stronger: ${item[1]}\n- tradeoff: ${item[2]}\n- likely comp: ${item[3]}`).join("\n\n");
}

function saveState() {
  localStorage.setItem("tina_brief", JSON.stringify(currentBrief));
  localStorage.setItem("tina_messages", JSON.stringify(currentMessages));
  localStorage.setItem("tina_step", String(stepIndex));
}

function metric(label, value, progress = false) {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong>${progress ? `<div class="progress" style="--value:${value}"><span></span></div>` : ""}</div>`;
}

function panelTags(title, items, empty) {
  return `<div class="panel-section"><h3>${title}</h3>${items.length ? tags(items) : `<p>${empty}</p>`}</div>`;
}

function insightCard(insight) {
  return `<div class="insight-card">
    <strong>${escapeHtml(insight.title)}</strong>
    <p>${escapeHtml(insight.body || "")}</p>
    <small>${escapeHtml(insight.action || "")}</small>
  </div>`;
}

function marketShiftCard(shift) {
  return `<div class="insight-card market-shift">
    <strong>Market shift: ${escapeHtml(shift.changed)}</strong>
    <div class="shift-grid">
      <span>Talent pool<br><b>${escapeHtml(shift.talentPoolBefore)} → ${escapeHtml(shift.talentPoolAfter)}</b></span>
      <span>Timeline<br><b>${escapeHtml(shift.timelineBefore)} → ${escapeHtml(shift.timelineAfter)}</b></span>
      <span>Comp<br><b>${escapeHtml(shift.compBefore)} → ${escapeHtml(shift.compAfter)}</b></span>
    </div>
    <small>${escapeHtml(shift.suggestedMove)}</small>
  </div>`;
}

function tags(items) {
  return `<div class="tag-list">${items.map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join("")}</div>`;
}

function briefCard(title, body) {
  return `<article class="brief-card"><h3>${title}</h3>${typeof body === "string" && body.includes("<") ? body : `<p>${escapeHtml(body)}</p>`}</article>`;
}

function parseList(value) {
  return value.split(/,|\n|;/).map((x) => x.trim()).filter(Boolean);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

document.querySelectorAll("[data-route]").forEach((el) => el.addEventListener("click", () => route(el.dataset.route)));
document.getElementById("sendBtn").addEventListener("click", submitAnswer);
document.getElementById("generateBtn").addEventListener("click", () => {
  activeBrief = currentBrief;
  saveState();
  route("brief");
});
document.getElementById("answerInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submitAnswer();
});

route(location.hash.replace("#", "") || "home");
