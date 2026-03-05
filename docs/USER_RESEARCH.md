# User Research: Field Sales Workflows and Mobile-First Intelligence

**Research Period**: March–May 2024
**Conducted by**: Jacob George, Product Manager
**Methodology**: Ride-alongs, structured interviews, CRM log analysis
**Status**: Final Report

## Research Objectives

Our goal was to understand the actual daily workflow of field sales reps—not what managers think they do, but what they actually do—before building a mobile-first application. Specific questions:

- How much time do reps spend on the road vs. in admin/data entry?
- What information do reps need *before* a customer visit?
- How do reps currently search for customer context (history, notes, preferences)?
- Where does the CRM fit into their actual workflow?
- What barriers exist to adoption of new sales tools?
- How do connectivity constraints (rural areas, poor signal) affect rep behavior?

---

## Methodology

**Field Observations**: 3 full-day ride-alongs with field reps
- 8 AM–6 PM, including drive time, customer visits, breaks
- Recorded observations, took notes on pain points and workarounds
- Reviewed devices used, applications accessed, information searches

**Structured Interviews**: 10 total
- 6 field reps (different territories, tenure, division)
- 3 division presidents/regional managers (perspective on team performance, coaching)
- 1 Sales Operations lead (CRM configuration, data quality)

**Data Analysis**:
- 6 weeks of Salesforce activity logs for 8 active reps
- Call duration, record creation lag, field access patterns
- Mobile app engagement metrics (if available)

**Scope**:
- Mix of divisions: Residential (new construction, home improvement), Commercial (industrial facilities, facilities management), Enterprise (large contract management)
- Tenure range: 6 months to 15 years
- Territory types: Urban, suburban, rural

---

## Participant Profiles

**P1: Residential Field Rep, Suburban Territory**
- Tenure: 3 years
- Territory: Tri-county suburban area, ~150 active accounts
- Typical day: 6–8 customer visits, 2–3 hours drive time
- Pain point: Manages customer preferences in personal notebook; "CRM is not with me."

**P2: Commercial Field Rep, Urban Territory**
- Tenure: 8 years, recently promoted to senior rep
- Territory: Dense urban area, ~80 accounts, high deal frequency
- Typical day: 10–12 visits (shorter drive time), frequent customer calls between visits
- Pain point: Switching between Salesforce, JDE (ERP), and internal CMS for contract history; "I lose 30 minutes daily looking for the right file."

**P3: Commercial Field Rep, Rural Territory**
- Tenure: 5 years
- Territory: Geographically dispersed, ~120 accounts across 4 counties
- Typical day: 4–6 visits, 4+ hours drive time
- Pain point: Connectivity gaps in rural areas; relies on cached information; "Cell service is spotty, I can't sync to Salesforce in real time."

**P4: Residential Rep, Suburban Territory**
- Tenure: 6 months (recently hired)
- Territory: New territory assignment
- Typical day: 5–7 visits, mostly cold calls and qualification
- Pain point: Territory context (which prospects have been contacted, by whom, when); "I don't want to call someone and find out they said no last month."

**P5: Commercial Field Rep, Mixed Urban/Industrial**
- Tenure: 12 years
- Territory: Industrial facilities, complex account hierarchies
- Typical day: 3–5 visits, longer per-visit duration, many phone calls for follow-ups
- Pain point: Account relationships are nested (facility manager, procurement, plant manager); CRM doesn't reflect the hierarchy clearly.

**P6: Sales Manager (Regional Director, Residential Division)**
- Tenure: 15 years (10 as manager)
- Manages team of 8 reps across 3 states
- Coaching method: Weekly 1:1s reviewing deals, reviewing CRM data, pipeline forecast
- Pain point: CRM data is 5–7 days stale by review time; "I'm coaching reps on deals that are already closed or lost."

---

## Key Findings

### 1. The "Data Entry Problem" is Actually a "Context Switching Problem"

Reps lose 30+ minutes per day not typing data, but searching for customer context across 3 systems.

**From P2's ride-along (Commercial Urban Rep)**:
- 9:15 AM: Arrives at customer. Opens phone to review notes. Goes to Salesforce mobile app, loads customer record. (90 seconds to load and navigate)
- 9:30 AM: Needs to check if there's an active contract. Contract is not in Salesforce. Calls back to office; office checks JDE (ERP system). (12 minutes wait time)
- 9:42 AM: Contract details received. Now checks internal CMS for any amendments or change orders from the past 6 months. (8 minutes of browsing)
- 10:00 AM: Finally sits down with customer. 30 minutes of value lost to information gathering.

**P2's reflection**: "If all this information was in one place on my phone, I walk in prepared. Right now I'm walking in half-informed and using the customer meeting as my information gathering session."

**P5's observation (Industrial Reps)**:
"I have 5 different facility managers at the same plant. They don't coordinate. I have to know who reports to whom, who handles procurement, who signed off last time. This information lives across 3 systems and my personal notes."

**Quantified Impact (from CRM logs)**:
- Average time between "arriving at customer location" (GPS check-in) and "opening customer record in Salesforce" = 3.2 minutes
- Average time between opening Salesforce and accessing a second system = 5.8 minutes
- P3 (rural rep) has longest context switching lag: average 12 minutes between systems due to connectivity

---

### 2. Reps Have Developed Shadow Systems (Workarounds)

Teams have built their own solutions to the context-switching problem. This is not laziness—it's rational adaptation.

**Evidence**:

**P1 (Suburban Residential)**:
- Maintains a physical notebook organized by account, updated during or after each visit
- Photos of hand-written notes from plant managers (kept on phone)
- Personal spreadsheet with customer preferences: "Jim likes to be called before 10 AM, Susan prefers email, plant shuts down Tuesdays"

**P2 (Urban Commercial)**:
- Maintains a local copy of the Salesforce contact list, customized with personal phone numbers (not in Salesforce)
- Screenshots of key contracts, stored in phone's photo library
- Slack channel with office staff for quick lookups ("@sales-ops: what's the renewal date on Acme Corp?")

**P3 (Rural Rep)**:
- Downloaded entire Salesforce database to laptop (synced weekly)
- Offline map with notes on customer locations, route optimization
- Printed contracts for frequent customers

**P4 (New Rep)**:
- Uses Google Sheets to track call progress and conversations with the same person across multiple calls

**Manager Perspective (P6)**:
"The reps who hit quota are the ones who have their own system. I'm not happy about it from a compliance perspective, but it's clear: reps with external workarounds close deals faster. So I don't stop them."

**Implication**: These workarounds are evidence of unmet needs. They also introduce compliance and data quality risk (shadow data, single points of failure).

---

### 3. Managers Review Performance Weekly, But Data is 5–7 Days Stale

Coaching happens on outdated information. By the time a manager sees a rep struggling, the opportunity window has closed.

**P6 (Regional Director)**:
"My weekly 1:1s are on Thursdays. I'm looking at Salesforce data through Wednesday. A rep could have had a bad Monday and Tuesday, closed a huge deal Wednesday, and I'm coaching them on a problem they've already solved. It's useless."

**CRM Log Analysis**:
- Average lag between "deal marked closed" and "visible in manager's forecast report" = 2.3 days
- Reason: Reps input data end-of-day or next day; forecast refresh is nightly; manager reviews Thursday morning
- Some reps (P2, P5) have routine of end-of-day data entry; newer reps (P4) update CRM daily but with delays

**Manager Request**:
"If I could see what my reps are doing in real time, I could coach mid-week. Someone's struggling Tuesday? I can jump on a call Wednesday. Right now I find out Friday and the deal is already gone."

**Compliance Implication**:
- CRM is used for audit trail and compliance validation
- Stale data means audit findings are about historical periods (last month's data was wrong in system X)

---

### 4. GPS Tracking is a Trust Issue, Not a Tech Issue

Reps are fine with visit logging (for their own route optimization and for manager visibility). They resist continuous tracking (feels like surveillance).

**From Ride-alongs**:

**P1 (3-year rep, good standing)**:
"If the app logs where I go during work hours, I'm fine with that. I have nothing to hide. But continuous GPS tracking? That feels like Big Brother. If I stop at Starbucks for 15 minutes, is the app going to flag me?"

**P3 (Rural, 5 years)**:
"The other thing—rural areas don't have good GPS. I'd see 'arrived at customer' 500 feet away from the actual building. Any tracking would be inaccurate anyway."

**P2 (Seniority advantage)**:
"I wouldn't use an app that tracks my movements continuously. I have established trust with my manager. If the company brings in tracking software, it signals they don't trust me. So I'd resist it, no matter how 'helpful' the features are."

**Manager Perspective (P6)**:
"I don't need to know where my reps are every second. I need to know: Did you visit the customer you said you'd visit? What did you learn? What's next? Continuous tracking would just create distrust."

**What Reps Actually Accept**:
- Manual visit logging (check-in/check-out at customer location)
- Route optimization based on customer locations
- Proof of visit (photo, check-in timestamp)
- Aggregate metrics (visits per week, territory coverage) but not individual moment-to-moment location

**Design Implication**: Any tool that implies surveillance will be resisted regardless of benefit. Transparency about data use is non-negotiable.

---

### 5. Offline Capability is Non-Negotiable

Rural and industrial territories have poor connectivity. Reps cannot afford sync latency.

**P3 (Rural Rep) Experience**:
"I'm out in the field from 7 AM to 5 PM. I have a 1-hour drive to the first customer. No cell service. I need my customer information loaded *before* I leave the office. If I drive all the way to a customer and find out I don't have the contract details, that's 2 hours wasted."

**P5 (Industrial Facilities)**:
"Some of our customers are in facilities with security protocols. No personal devices in the building. I have to leave my phone in the car. I take notes on paper, then sync when I leave. An app that requires real-time sync would break my workflow completely."

**Evidence from CRM Logs**:
- P3 shows predictable pattern: all data refresh happens 6 AM–7 AM (before leaving office)
- P5 shows batch sync after customer visits (3–4 syncs per day, timed after departing a facility)
- New rep (P4) in urban area: 10+ syncs per day (relies on live data)

**Manager Acknowledgment (P6)**:
"We have reps who can't use cloud-first tools. If a tool doesn't work offline, that rep can't use it. Period. So offline-first isn't a nice-to-have, it's a requirement for field sales."

---

### 6. Leaderboards Motivate, But Only If Perceived as Fair

Performance visibility is motivating. But leaderboards built on unequal conditions breed resentment.

**From Interviews**:

**P4 (New Rep, 6 months, cold territory)**:
"I see the leaderboard. The reps at the top are on established territories with renewal cycles. They get $50K deals without trying. I'm cold-calling. Of course they out-earn me. A leaderboard that doesn't account for territory differences is demotivating."

**P1 (Suburban, 3 years, established territory)**:
"I like being on the leaderboard. It motivates me to stay sharp. But it should be territory-adjusted. A rep on a new territory should be measured on their growth trajectory, not absolute numbers."

**Manager Perspective (P6)**:
"Leaderboards are useful for motivation and for identifying which reps need coaching. But you have to be transparent about how they're calculated. If reps don't understand why they're ranked where they are, they'll dismiss it as unfair."

**Fairness Criteria Reps Mentioned**:
- Adjusted for territory history (new vs. established)
- Adjusted for territory size (urban density vs. rural dispersal)
- Adjusted for product mix (different products have different margins)
- Trend-based (growth this quarter, not just absolute numbers)

**Non-Example**: One company showed a flat leaderboard (rep earnings, ranked). Resulted in resentment and "why should I work harder if I'm on a bad territory" feedback.

---

## Field Observation Notes: Moments That Revealed Unspoken Needs

**P2, 10:15 AM**: Customer asks, "Have you gotten that amendment from last month?" P2 reflexively reaches for phone, realizes they don't have it, calls back to office. 12-minute wait. Customer uses that time to answer other calls. The meeting is derailed. P2 later: "If I'd had that file with me, we'd be done now."

**P3, 2:00 PM**: Driving to next customer, 45-minute drive. No cell service. I ask: "Do you know what you're walking into?" Rep says: "Not really. I'll call the plant manager when I get closer and see if he's available. Otherwise I'll drive out there and see what they need." Absence of context is normal. Efficiency is 40% lower as a result.

**P1, 1:30 PM**: After a customer visit, rep takes 8 minutes to document the conversation in personal notebook. Salesforce isn't opened. I ask why. Rep: "I'll add it to Salesforce tonight. Right now I'm moving to the next location. Salesforce is slow on my phone."

**P5, 11:00 AM**: Customer says, "Can you check if we have a standing order for next month?" Rep doesn't have JDE access on phone. Calls office (2-minute wait). They check. Office: "We're not sure if that's a standing order or a one-time order. The contract's not clear." P5 to customer: "Let me have our office send you the details." The clarification should have been immediate; instead, it becomes a follow-up action.

**P4, 9:00 AM**: First call of the day. Rep dials prospect. Prospect is annoyed: "Didn't someone from your company call me last week?" Rep didn't know. Awkward apology. The rep should have had access to call history. Instead, they're calling blind.

---

## Synthesis: The Actual Field Sales Workflow

**What managers think happens**:
1. Rep drives to customer
2. Rep has conversation
3. Rep enters data in CRM
4. Manager reviews data
5. Manager coaches

**What actually happens**:
1. Rep spends 30 min preparing for visit (gathering context from multiple systems)
2. Rep drives to customer
3. Rep has conversation (sometimes with missing context)
4. Rep updates personal notes, workarounds
5. Rep updates CRM end-of-day or next day
6. Manager reviews 5–7 days later
7. Insights are historical, not actionable

**Why the Gap Exists**:
- CRM is designed for post-sale documentation (compliance, audit trail)
- Mobile access to CRM is slow, incomplete, requires constant context switching
- Reps have rational workarounds that are more efficient than CRM
- Manager coaching happens asynchronously, losing real-time coaching opportunity
- Transparency (GPS tracking) implies surveillance, causing adoption resistance

---

## How This Shaped the Product

### Feature: Pre-Visit Brief (Context Aggregation)

**Finding**: Reps spend 30+ minutes per day switching between systems to gather customer context. Information is scattered across Salesforce, ERP, internal CMS, and personal notes.

**Solution**: Field Sales Command aggregates customer context into a single "pre-visit brief"—customer history, recent interactions, active contracts, notes from previous visits, pending action items. Loaded before the rep leaves the office, fully offline accessible.

**Design Decision**: Brief is read-only during the visit (allows quick scanning), not a data entry tool. Reps enter observations into voice-to-text or quick checkboxes, synced after the visit when connectivity returns. Minimal friction.

**Impact on P2's workflow**: Instead of 12-minute delay for contract lookup, contextual contract summary is on phone before leaving office. Saves 30 minutes per day.

---

### Feature: Route Optimization & Territory Intelligence

**Finding**: Rural reps have long drive times and no cell service. Efficiency depends on pre-planning. New reps lack territory context (who's been contacted, who's ready to buy, etc.).

**Solution**: Offline-first route optimization based on customer location, call history, and sales stage. Includes territory insights: "3 customers in this cluster haven't been contacted in 8+ weeks" or "This customer is in renewal stage."

**Design Decision**: All data loads before the rep leaves the office. Route updates happen offline. No dependency on cell connectivity. Reps add observations to each stop; sync happens when they have connectivity (end of day or at next office visit).

**Impact on P3**: Instead of "I'll call and see if they're available," rep arrives with prepared brief, ready for conversation.

---

### Feature: Real-Time Coaching Nudges (Manager Insight)

**Finding**: Managers review performance 5–7 days after actions occur, losing coaching opportunities. Real-time visibility would allow mid-week course correction.

**Solution**: Manager dashboard shows live pipeline movement (deals advancing, deals stalling, reps engaged in visits). Allows manager to identify struggling deals within hours, not days. Coaching happens while the rep can still act.

**Design Decision**: Data flows from rep's phone to backend on sync (not real-time continuous). Manager sees today's updates by end of business. Allows near real-time coaching without requiring continuous connectivity or surveillance.

**Impact on P6**: Rep struggling Tuesday can be coached Wednesday morning. Coaching becomes proactive, not reactive.

---

### Feature: Activity Logging (Not Surveillance)

**Finding**: Reps accept visit logging for their own efficiency and for manager visibility, but resist continuous GPS tracking.

**Solution**: Reps manually log visits (check-in/check-out). System generates proof-of-visit (timestamp, location). Manager sees aggregate activity patterns (visits per territory, coverage gaps) but not continuous location tracking.

**Design Decision**: Rep controls when they log visits (not automatic GPS). They see the logged data themselves (transparency). Manager sees aggregate reports, not individual moment-to-moment location. Trust is preserved.

**Impact on P1 & P2**: Adoption is high because it's transparent and minimal friction. No surveillance feeling.

---

### Feature: Territory-Adjusted Leaderboards

**Finding**: Simple leaderboards (earnings ranked) demotivate reps on new or difficult territories.

**Solution**: Leaderboards are configurable by manager. Can show: absolute earnings, territory-adjusted performance, growth rate, activity level, customer satisfaction. Each metric shows context (territory age, territory size, segment).

**Design Decision**: Transparency on calculation. Reps see why they're ranked where they are. New territory rep might rank low on absolute earnings but high on growth rate. Both metrics are visible.

**Impact on P4 & P1**: Both see value in performance visibility when it's fair and contextualized.

---

### Non-Feature: Real-Time Data Sync

**Finding**: Rural and industrial reps cannot rely on real-time connectivity. Some customers prohibit personal devices in facilities.

**Decision**: Offline-first architecture. All data loads before the rep leaves for the field. Syncing happens when convenient (end of day, at office, over WiFi). No dependency on mobile connectivity during the visit.

**Trade-off**: Manager insights are delayed by hours (not real-time). This is acceptable because coaching window is still same day, not 5–7 days later.

---

### Non-Feature: Continuous GPS Tracking

**Finding**: Reps accept activity logging and route optimization, but resist continuous tracking (feels like surveillance).

**Decision**: No continuous GPS. Reps manually log visits. System computes aggregate coverage metrics from logged data. Removes trust barrier to adoption.

**Trade-off**: Manager loses granular location data. This is acceptable because the use case (territory coverage, activity patterns) doesn't require moment-to-moment location.

---

## Remaining Questions & Next Research

- How do sales reps on different platforms (iOS vs. Android) differ in adoption? (Early hypothesis: Android adoption slower due to older devices in rural areas)
- What's the role of sales operations in data quality? Should they validate logged data, or trust reps?
- For industrial/facilities-based reps, what's the right frequency for offline syncs? Daily? Weekly?
- How do team leads (not full-time managers) use data differently than directors?

---

**Research Artifacts**: Ride-along notes (3 full transcripts), CRM log analysis (Salesforce activity for 8 reps, 6 weeks), interview recordings (10 of 10 recorded, 9 transcribed), photo documentation from field visits.
