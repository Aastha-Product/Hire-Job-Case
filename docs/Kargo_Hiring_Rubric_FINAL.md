# Kargo Hiring Rubric — FINAL, Agent-Ready
### The scoring standard an AI agent uses to screen, rank, and route every PM / Senior PM resume
**Owner:** Arjun Mehta, Founder, Kargo · **Version:** 1.0 · **Date:** 28 Sep 2026
**Built from:** 8 performance-labelled Kargo hires + both role JDs + vertical-SaaS hiring research. Derived from *who actually thrived*, not from the job spec.

---

## 0. How the agent must use this rubric (read before scoring)

1. **Score every candidate against BOTH the PM and the SPM rubric**, regardless of the role they applied for. Route them to the role where they score higher / clear the bar. (Matches the build design.)
2. **Score each criterion 0 / 1 / 2** (Weak / Moderate / Strong) using the anchors below. Convert to points: `points = (score ÷ 2) × weight%`. Sum the five criteria → a **0–100 Fit Index**.
3. **Evidence is mandatory.** A score above 0 requires a *quoted sentence from an experience bullet* — a real role + action (+ outcome). A keyword appearing only in a Skills list, a summary adjective, or an employer's name **does not count** — score it Weak. (See §6, Anti-gaming.)
4. **Match the meaning, not the literal word.** Candidates describe the same skill with different keywords. Use the **synonym banks** in each criterion to map varied phrasing onto the canonical signal.
5. **Never use personal identifiers** (name, email, phone, gender, age, college prestige, location as a quality signal) in scoring. Score on job-relevant evidence only. (PII is separated at ingestion per the privacy design.)
6. **The system ranks and drafts; it never rejects on its own.** Thresholds below produce *bands and draft actions* — Arjun confirms every send.

**Per-criterion output the agent must emit:**
```
{criterion, score(0-2), weight%, points, evidence_quote, one_line_reason, missing_info?}
```
Plus per candidate: `role_routed, fit_index_pm, fit_index_spm, band, confidence, flags[]`.

---

## 1. The five criteria and why they exist (one line each)

| # | Criterion | What it really measures | Source in the data |
|---|-----------|--------------------------|--------------------|
| C1 | **Freight/Logistics Operational Grounding** | Has the candidate *lived* the customer's operational reality? | 5/5 Exceeds hires had it; 0/3 others did |
| C2 | **Ship-and-Kill with a Learning Loop** | Product judgment — ships *and* cuts on evidence | Lavanya (Exceeds) vs Vikram; PM JD |
| C3 | **End-to-End Ownership Under Pressure** | Owns the messy parts to closure | 5/5 Exceeds crisis-to-closure stories |
| C4 | **Independent Operation & Consequential Calls** | Works with no senior layer making decisions | Separates the *Below* hire; SPM-critical |
| C5 | **Ground-Level Discovery** | Product understanding from the field, not the desk | Embedded discovery across Exceeds hires |

---

## 2. WEIGHTING — PM vs SPM differ deliberately

| Criterion | **PM weight** | **SPM weight** | Why the shift |
|-----------|:------------:|:--------------:|---------------|
| C1 Operational grounding | **35%** | **30%** | Dominant for both; slightly lower for SPM because independence takes priority |
| C2 Ship-and-kill / platform build-vs-configure judgment | **25%** | **20%** | SPM reframes this as architectural build/configure/avoid judgment |
| C3 Ownership under pressure | **20%** | **20%** | Equally central at both levels |
| C4 Independent operation & consequential calls | **10%** | **25%** | **The senior differentiator** — SPM must make calls with no committee |
| C5 Ground-level discovery | **10%** | **5%** | Seniors are assumed to have internalised this |
| **Total** | **100%** | **100%** | |

> The single biggest PM→SPM change is **C4 jumping 10%→25%.** At senior level, "owned a product area with no senior PM above making the calls" is the make-or-break signal (JD: *"no committee that approves product decisions"*). Domain grounding stays heavily weighted at both levels — it is the Kargo-specific edge.

---

## 3. CRITERION DETAIL — anchors, sub-signals, and keyword banks

For each criterion: the **0/1/2 anchors**, the **sub-signals with relative priority** (what within the skill matters most), and the **keyword/synonym bank** the agent uses to recognise the skill under any phrasing.

### C1 — Freight / Logistics Operational Grounding  *(PM 35% · SPM 30%)*
**What we're looking for:** the candidate has done, or worked hand-in-glove with, the operational work Kargo's customers do — freight forwarding, customs, ports/terminals, 3PL/supply-chain, carrier ops — *at role level*, not as a market their employer happened to serve.

**Sub-signals, most→least valuable:**
1. Held an **operational role** in freight forwarding / CHA-customs / port-terminal / NVOCC / 3PL (highest).
2. Handled **real freight artefacts/processes** (BL, ICEGATE filing, berth/DO coordination, dwell/detention).
3. **Embedded with logistics users** (onboarded freight clients, sat in ops rooms).
4. **Supply-chain / warehousing adjacent** ops experience.
5. Logistics touched **only via software integration** or as a customer segment (lowest — Moderate at best).

**Anchors:**
- **2 – Strong:** ≥ ~1 year in a hands-on freight/logistics/customs/port/3PL operational role *before or alongside* product; can reference concrete workflows. *(e.g., "Operations Executive, CHA firm, JNPT — Bills of Lading, customs clearance for 180+ shipments/mo.")*
- **1 – Moderate:** adjacent operations (supply-chain analyst, warehousing, last-mile), OR embedded stints with logistics customers, OR logistics reached through integrations with real depth.
- **0 – Weak/None:** logistics appears only as an employer's market or a one-line integration; or no logistics contact at all *(e.g., HR-tech / fintech / generic e-commerce PM).*

**Keyword & synonym bank (map any of these → C1):**
`freight forwarder, freight forwarding, customs house agent, CHA, customs broker, customs clearance, NVOCC, 3PL, third-party logistics, 4PL, shipping line, liner, ocean/air freight, terminal, port, JNPT, ICD, CFS, bonded warehouse, supply chain, carrier operations/allocation, last-mile, cold chain, EXIM, import/export`
Artefacts/processes: `Bill of Lading, BL, HBL, MBL, Shipping Bill, Shipping Instruction, SI, Certificate of Origin, Letter of Credit, LC, packing list, commercial invoice, DGFT, IEC, MEIS, SEIS, RoDTEP, ICEGATE, EDI filing, delivery order, DO, berth, berth window, vessel scheduling, container, detention, demurrage, dwell time, chassis, gate-in/out, manifest, HS code`
Tools: `CargoWise, CargoWise One, ICEGATE, SAP TM, TMS, WMS, FMS, freight management system, track & trace, shipment visibility`
**Guardrail:** an employer described as "logistics SaaS" is **not** C1 evidence by itself — require a role-level operational contact. A career-changer who shows *rapid domain mastery / embedded discovery* may earn Moderate (career-changer safeguard).

---

### C2 — Ship-and-Kill with a Learning Loop  *(PM 25% · SPM 20%, reframed as platform judgment)*
**What we're looking for:** the candidate ships **and** kills/deprioritises based on evidence, and can say why. Building things is table stakes; *cutting* things on data is the rarer signal.

**Sub-signals, most→least valuable:**
1. **Killed / sunset / deprioritised** a feature on usage data, with the reason (highest — rare, distinguishing).
2. **Shipped** features in short cycles with outcomes.
3. **Post-mortems / retrospectives** run to closure.
4. **(SPM only)** build-vs-configure-vs-avoid / architectural judgment.

**Anchors:**
- **2 – Strong (PM):** explicit evidence of **both** shipping **and** killing/cutting on data, with reasoning. *(e.g., "shipped 6, killed 2 after low adoption, redirected capacity.")* **(SPM):** additionally shows platform judgment — chose to build vs configure vs stay away, or killed own idea.
- **1 – Moderate:** ships and iterates, but no evidence of killing or learning from a negative result.
- **0 – Weak:** a feature/output list with no outcomes or learning; process/tool names only.

**Keyword & synonym bank:**
Ship: `shipped, launched, released, delivered, rolled out, GA, 0→1, MVP, went live, brought to market`
Kill/learn: `killed, sunset, deprecated, deprioritised, cut, pulled, rolled back, discontinued, retired, post-mortem, retrospective, A/B test, experiment, usage/adoption data showed, <X% adoption, validated/invalidated hypothesis, pivoted (with data), learned that`
SPM platform judgment: `build vs buy, build vs configure, configurable, architecture decision, scope boundary, "what we don't build", technical trade-off`
**Guardrail:** `Agile, Scrum, JIRA, roadmap, backlog, PRD` in a skills list are **not** C2 evidence — require an actual shipped/killed outcome.

---

### C3 — End-to-End Ownership Under Pressure  *(PM 20% · SPM 20%)*
**What we're looking for:** at least one story of owning an ambiguous or high-pressure problem *to closure*, including the follow-through nobody sees.

**Sub-signals, most→least valuable:**
1. **Crisis/ambiguity owned to closure** incl. unglamorous follow-up (highest).
2. **Pre-empted a failure** before it reached the customer.
3. Owned a **normal project end-to-end** (spec → release → post-launch).

**Anchors:**
- **2 – Strong:** a concrete crisis/ambiguous problem the candidate personally owned to resolution, including follow-through. *(e.g., all-night customs-hold fix "before the client became aware"; "wrote internal + customer-facing post-mortem, owned action items to closure.")*
- **1 – Moderate:** owned a project end-to-end under normal conditions.
- **0 – Weak:** contributed within a structured team; no ownership-under-ambiguity evidence.

**Keyword & synonym bank:**
`owned end-to-end, sole owner, single-handedly, took full ownership, on-call, incident, outage, P1, escalation, war room, root cause, resolved, drove to resolution, to closure, follow-up/action items, before the client became aware, no escalation, closed without penalty, under time pressure, cutover, migration with no data loss, firefight`
**Guardrail:** "responsible for X" is weaker than "did X and here's what happened." Prefer outcome + follow-through over ownership-by-title.

---

### C4 — Independent Operation & Consequential Calls  *(PM 10% · SPM 25%)*
**What we're looking for:** operated with **no senior layer making the decisions** — and, for SPM, made consequential/architectural calls and lived with them.

**Sub-signals, most→least valuable:**
1. **Sole / first / only** owner of a function or product area; no manager making the calls (highest).
2. Made **consequential calls with no sign-off** (SPM: architectural, integration, reliability).
3. **Self-sourced / self-scoped** work; built the function from scratch.
4. Autonomy **within a small team**.

**Anchors:**
- **2 – Strong (PM):** sole/first owner, no manager making calls, self-scoped work. **(SPM):** the above **plus** owned a product area with no senior PM above and made architectural/consequential calls (build/configure/avoid, integration roadmap, reliability standards).
- **1 – Moderate:** real autonomy within a small team; some independent scope.
- **0 – Weak:** operated inside a large, structured org with decisions made above them.

**Keyword & synonym bank:**
`sole PM, only PM, first PM, no PM above, no manager, reports to CEO/founder/CTO, directly to founder, self-sourced, self-scoped, independently, autonomously, without oversight, from scratch, 0→1, no committee, made the call, own decisions, one-person function, wore many hats, set up the function`
SPM extras: `architecture, integration roadmap, data layer, data quality, reliability, uptime, SLA, platform, multi-tenant, migration, monolith→modular, scalability, ERP/carrier/port integration`
**Guardrail:** independence is necessary but **not sufficient** — one Meets-rated hire had high independence but lacked C1. Do not let a single strong C4 carry a weak C1.

---

### C5 — Ground-Level Discovery  *(PM 10% · SPM 5%)*
**What we're looking for:** product/customer understanding built by going to where the work happens.

**Anchors:**
- **2 – Strong:** embedded with users — sat in ops rooms, shadowed, rode along, onboarded customers personally, spent weeks on-site — and fed it into product.
- **1 – Moderate:** regular structured discovery (interviews, calls, QBRs).
- **0 – Weak:** relies on secondhand requirements / no discovery evidence.

**Keyword & synonym bank:**
`customer discovery, user interviews, embedded, sat with, shadowed, ride-along, on-site, field visit, in the ops room, spent N weeks with, onboarded customers personally, contextual inquiry, jobs-to-be-done, discovery sessions, voice of customer, user research`

---

## 4. DECISION THRESHOLDS — the select / borderline / below-line bands (differ by role)

Bands drive *ranking and the draft email*, not an automatic send. Arjun confirms.

### Product Manager
| Band | Rule | Draft action |
|------|------|--------------|
| **Shortlist (interview)** | Fit Index **≥ 70** AND C1 ≥ 1 AND no more than one criterion at 0 | Draft **interview invite** + 3-sentence brief |
| **Borderline (human look)** | Index 55–69, **or** Index ≥ 70 with **C1 = 0** (strong generalist — career-changer check) | Hold for Arjun's review; brief with the specific gap flagged |
| **Below the line** | Index < 55 | Draft **warm rejection** (Arjun confirms) |

### Senior Product Manager  *(higher bar)*
| Band | Rule | Draft action |
|------|------|--------------|
| **Shortlist (interview)** | Fit Index **≥ 75** AND C1 ≥ 1 AND **C4 ≥ 1** (must have real independence) | Draft **interview invite** + brief |
| **Borderline (human look)** | Index 60–74, **or** ≥ 75 but **C4 = 0** (not independent enough for senior) | Hold for review; flag the missing independence |
| **Below the line** | Index < 60 | Draft **warm rejection** (Arjun confirms) |

**Role-routing rule:** if a candidate clears the SPM bar, route to SPM; else if they clear the PM bar, route to PM; else rank within the role they applied for. **Experience sanity flag (not scored):** SPM expects ~5–8 yrs, PM ~2–4 yrs — flag large deviations for review, but never reject on years alone (years is a weak predictor).

### Optional hard gates (operational, OFF by default — from the JD, not the performance data)
Toggle on only if desired: `Mumbai-based OR willing to relocate` (both roles are in-office). Keep separate from the Fit Index so the quality signal stays clean.

---

## 5. Worked examples (calibration)

- **`pm_01 Priya Krishnan`** (freight ops at Mahindra → sole PM, ships-and-kills, embedded discovery): C1=2, C2=2, C3=1, C4=2, C5=2 → 35+25+10+10+10 = **90 → PM Shortlist.** ✓ (mirrors your Exceeds hire Lavanya)
- **A polished HR-tech PM** (strong metrics, MBA, no logistics — the "Vikram" profile): C1=0, C2=2, C3=1, C4=1, C5=1 → 0+25+10+5+5 = **45 → Below line / Borderline via generalist rule.** Correctly ranks below the domain-native PM.
- **`spm_16 Siddharth Rao`** (JNPT terminal ops → led product function 2.5 yrs solo, ICEGATE integration): C1=2, C4=2, C3=2, C2=2, C5=2 → 30+25+20+20+5 = **100 → SPM Shortlist.** ✓

---

## 6. Anti-gaming & integrity rules (critical for an automated filter)

1. **Evidence-or-zero:** no points without a quoted experience bullet. Keywords in a Skills/Summary block alone = Weak.
2. **Keyword-stuffing detection:** if a term appears with no matching experience bullet (e.g., "CargoWise, ICEGATE" listed but never used in a role), do not credit it; add flag `keyword_unsupported`.
3. **"Responsible for" vs "did + outcome":** prefer demonstrated outcomes; discount vague ownership claims.
4. **Employer ≠ experience:** a logistics/SaaS employer name does not grant C1/C2 credit; look at what the *person* did.
5. **Every quantified claim is a to-verify, not a fact.** Flag metrics for the interview probe ("walk me through the baseline…"). The rubric ranks; the interview verifies.
6. **Confidence field:** set `low` when evidence is thin, formats are sparse, or the CV is one of the short calibration resumes — low-confidence cases surface for human review, never silent rejection.
7. **Ignore false signals** (they do not distinguish in Kargo's data): degree/college prestige, employer prestige, years of experience, tool-list length, generic "results-driven/strong leadership" language.

---

## 7. Machine-readable config (load this into the scoring step)

```json
{
  "rubric_version": "1.0",
  "scoring": { "levels": {"weak":0,"moderate":1,"strong":2}, "formula": "points = (score/2) * weight_percent", "index_range": [0,100] },
  "evidence_required": true,
  "exclude_pii_from_scoring": true,
  "criteria": [
    {
      "id": "C1", "name": "Freight/Logistics Operational Grounding",
      "weight_pm": 35, "weight_spm": 30,
      "strong": "Hands-on freight/customs/port/3PL operational role (~1yr+) with concrete workflows",
      "moderate": "Adjacent ops (supply chain, warehousing, last-mile) OR embedded with logistics customers OR integration-level depth",
      "weak": "Logistics only as employer market or one-line integration, or none",
      "keywords": ["freight forwarder","freight forwarding","CHA","customs broker","customs clearance","NVOCC","3PL","third-party logistics","4PL","shipping line","liner","terminal","port","JNPT","ICD","CFS","bonded warehouse","supply chain","carrier operations","carrier allocation","last-mile","cold chain","EXIM","import/export","bill of lading","BL","HBL","MBL","shipping bill","shipping instruction","certificate of origin","letter of credit","DGFT","IEC","ICEGATE","EDI filing","delivery order","berth","vessel scheduling","container","detention","demurrage","dwell time","chassis","manifest","HS code","CargoWise","SAP TM","TMS","WMS","FMS","freight management system","shipment visibility"],
      "guardrail": "Employer being 'logistics SaaS' is not evidence; require role-level operational contact."
    },
    {
      "id": "C2", "name": "Ship-and-Kill with Learning Loop / Platform Judgment",
      "weight_pm": 25, "weight_spm": 20,
      "strong": "Shipped AND killed/cut on data with reason; (SPM) build-vs-configure-vs-avoid judgment",
      "moderate": "Ships and iterates, no killing/negative-learning evidence",
      "weak": "Feature/output list, no outcomes or learning",
      "keywords": ["shipped","launched","released","delivered","rolled out","GA","0 to 1","MVP","killed","sunset","deprecated","deprioritised","cut","pulled","rolled back","discontinued","retired","post-mortem","retrospective","A/B test","experiment","adoption data","validated hypothesis","invalidated","pivoted","build vs buy","build vs configure","architecture decision"],
      "guardrail": "Agile/Scrum/JIRA/roadmap in a skills list are not evidence."
    },
    {
      "id": "C3", "name": "End-to-End Ownership Under Pressure",
      "weight_pm": 20, "weight_spm": 20,
      "strong": "Owned a crisis/ambiguous problem to closure incl. unseen follow-through",
      "moderate": "Owned a normal project end-to-end",
      "weak": "Contributed within a structured team only",
      "keywords": ["owned end-to-end","sole owner","single-handedly","full ownership","on-call","incident","outage","P1","escalation","root cause","drove to resolution","to closure","action items","before the client became aware","no escalation","closed without penalty","under time pressure","cutover","migration","no data loss"],
      "guardrail": "'Responsible for' is weaker than 'did + outcome + follow-through'."
    },
    {
      "id": "C4", "name": "Independent Operation & Consequential Calls",
      "weight_pm": 10, "weight_spm": 25,
      "strong": "Sole/first owner, no manager making calls; (SPM) architectural/consequential calls with no sign-off",
      "moderate": "Real autonomy within a small team",
      "weak": "Large structured org, decisions made above",
      "keywords": ["sole PM","only PM","first PM","no PM above","no manager","reports to CEO","reports to founder","directly to founder","self-sourced","self-scoped","independently","autonomously","without oversight","from scratch","no committee","made the call","one-person function","integration roadmap","data layer","data quality","reliability","SLA","platform","migration","monolith to modular","scalability"],
      "guardrail": "Independence is necessary but not sufficient; do not let strong C4 rescue weak C1."
    },
    {
      "id": "C5", "name": "Ground-Level Discovery",
      "weight_pm": 10, "weight_spm": 5,
      "strong": "Embedded with users (ops rooms, ride-along, personal onboarding) feeding product",
      "moderate": "Structured discovery (interviews, calls, QBRs)",
      "weak": "Secondhand requirements / none",
      "keywords": ["customer discovery","user interviews","embedded","sat with","shadowed","ride-along","on-site","field visit","in the ops room","spent weeks with","onboarded customers","contextual inquiry","jobs-to-be-done","discovery sessions","user research","voice of customer"],
      "guardrail": null
    }
  ],
  "thresholds": {
    "PM":  { "shortlist": {"min_index":70, "require":{"C1":">=1","max_zero_criteria":1}}, "borderline":{"index_range":[55,69],"or":"index>=70 and C1==0"}, "below_line":{"max_index":54} },
    "SPM": { "shortlist": {"min_index":75, "require":{"C1":">=1","C4":">=1"}}, "borderline":{"index_range":[60,74],"or":"index>=75 and C4==0"}, "below_line":{"max_index":59} }
  },
  "routing": "score both; route to SPM if SPM shortlist cleared else PM if PM cleared else applied-role rank",
  "false_signals_ignore": ["degree/college prestige","employer prestige","years of experience","tool-list length","generic leadership/results-driven language"],
  "flags": ["keyword_unsupported","metric_to_verify","low_confidence","experience_band_mismatch","generalist_C1_zero","not_independent_for_SPM"]
}
```

---

## 8. Plain-text rubric (drop-in `rubric.txt` for the Claude Code build)

```
KARGO HIRING RUBRIC v1.0 — PM and SPM scored separately, 0/1/2 per criterion, weighted to 100.

PRODUCT MANAGER
1. Freight/Logistics Operational Grounding — 35%
   Strong: hands-on freight/customs/port/3PL ops role (~1yr+) with real workflows (BL, ICEGATE, berth, dwell).
   Moderate: adjacent ops (supply chain/warehousing/last-mile) or embedded with logistics customers.
   Weak: logistics only as employer market or one-line integration; or none.
2. Ship-and-Kill with a Learning Loop — 25%
   Strong: shipped AND killed/cut features on usage data, with reasons.
   Moderate: ships and iterates, no killing/learning shown. Weak: feature list only.
3. End-to-End Ownership Under Pressure — 20%
   Strong: owned a crisis/ambiguous problem to closure incl. follow-through.
   Moderate: owned a normal project end-to-end. Weak: contributed within a team.
4. Independent Operation — 10%
   Strong: sole/first owner, no manager making calls. Moderate: autonomy in a small team. Weak: decisions made above.
5. Ground-Level Discovery — 10%
   Strong: embedded with users feeding product. Moderate: structured discovery. Weak: secondhand.
Shortlist if index >=70 and C1>=1 and <=1 zero-criterion.

SENIOR PRODUCT MANAGER
1. Freight/Logistics Operational Grounding — 30% (as PM, plus reasons about why systems fail operators)
2. Independent Operation & Consequential Calls — 25% (owned an area with no senior PM above; architectural calls)
3. End-to-End Ownership Under Pressure — 20%
4. Ship-and-Kill / Platform Build-vs-Configure Judgment — 20%
5. Ground-Level Discovery — 5%
Shortlist if index >=75 and C1>=1 and C4>=1.

RULES: evidence required (quote a bullet) or score 0; ignore prestige/years/tool-lists; every metric is to-verify; system ranks and drafts, never auto-rejects.
```

---

## 9. Confidence & caveats (do not oversell this to Arjun)
Derived from **n=8** labelled hires (5 Exceeds / 2 Meets / 1 Below), of whom only 2 are PMs — so this is **directional**, a decision aid that beats gut feel, not a validated predictor. The domain-grounding weighting is the highest-confidence element (clean 5/5 vs 0/3 split, a near-controlled PM comparison, and external vertical-SaaS support). Weights are evidence-informed judgment, not statistically derived. Log every score + reason + Arjun's decision so the rubric can be re-calibrated on real Kargo hiring outcomes within a year.

**Sources:** [Nobel Recruitment — hiring PMs for vertical SaaS](https://nobelrecruitment.com/blog/how-to-hire-product-managers-for-horizontal-vs-vertical-saas/) · [Schmidt & Hunter (1998) predictor validity](https://www.plum.io/blog/schmidt-hunter-meta-analysis) · [SPM vs PM differences — LaunchNotes](https://www.launchnotes.com/blog/senior-product-manager-vs-product-manager-key-differences-explained) · [Freight/logistics glossary — Expeditors](https://www.expeditors.com/customer-based-solutions/freight-logistics-glossary)
