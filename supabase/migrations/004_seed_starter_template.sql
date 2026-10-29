-- 004_seed_starter_template.sql
-- Seeds project types and ONE starter template (attached to T00, the fallback used by every
-- project type until it gets its own template).
--
-- IMPORTANT: this is a STARTER written to give the drafting engine something to work with.
-- It has not been reviewed by a SACPCMP professional. Have your professionals edit it
-- (or replace the content with their own house template) before relying on it for clients.
--
-- Template syntax (see src/lib/template-engine.ts):
--   {{field}}              merged deterministically from the intake data
--   {{AI: instruction}}    one block written by Claude (nothing else is ever sent to Claude)
--   {{AI+activities: ...}}   same, and must mention every declared high-risk activity
--   [CONSULTANT TO COMPLETE|INSERT|VERIFY: ...]   left untouched for the professional

INSERT INTO project_types (code, label, requires_chsm, high_risk) VALUES
  ('T00', 'General construction (fallback template)', false, false),
  ('T01', 'Residential construction', false, false),
  ('T02', 'Light commercial construction', false, false),
  ('T03', 'Civil / earthworks', false, true),
  ('T04', 'Electrical installation', false, true),
  ('T05', 'Plumbing and mechanical', false, false),
  ('T06', 'Roofing (industrial/commercial)', false, true),
  ('T07', 'Demolition', false, true),
  ('T08', 'Painting and cladding', false, false),
  ('T09', 'Interior fit-out', false, false),
  ('T10', 'General maintenance', false, false)
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label,
  requires_chsm = EXCLUDED.requires_chsm, high_risk = EXCLUDED.high_risk;

INSERT INTO she_templates (project_type_id, version, content, notes)
SELECT id, '1.0', $tpl$# SAFETY, HEALTH AND ENVIRONMENT (SHE) FILE

## 1. PROJECT PARTICULARS
| ITEM | DETAIL |
|---|---|
| File number | {{file_number}} |
| Project name | {{project_name}} |
| Site address | {{project_address}} |
| Type of work | {{project_type_label}} |
| Principal contractor | {{contractor_name}} |
| CIDB registration | {{cidb_number}} |
| Client / employer | {{client_name}} |
| Site agent / construction manager | {{site_agent}} |
| Start date | {{start_date}} |
| Planned completion date | {{end_date}} |
| Duration | {{duration_days}} |
| Estimated workers on site | {{worker_count}} |
| Contract value | {{project_value}} |
| Construction work permit or notification | [CONSULTANT TO VERIFY: whether a construction work permit or notification is required for this project] |

## 2. PROJECT DESCRIPTION AND SCOPE OF WORK
{{AI: Write one or two short paragraphs describing the works, using only the project type, site address, duration, worker count and declared high-risk activities provided. Do not invent quantities, building sizes, materials, subcontractors or dates.}}

## 3. HEALTH AND SAFETY POLICY AND ORGANISATION
### 3.1 Policy statement
The principal contractor commits to providing and maintaining a safe and healthy working environment for all persons on site, and to managing the risks arising from its construction work.
[CONSULTANT TO INSERT: principal contractor's signed health and safety policy statement]

### 3.2 Appointments
| ROLE | NAME | DATE OF APPOINTMENT | APPOINTMENT LETTER ON FILE |
|---|---|---|---|
| Site agent / construction manager | {{site_agent}} | [CONSULTANT TO COMPLETE: date of appointment] | [CONSULTANT TO VERIFY: appointment letter on file] |
| Construction supervisor | [CONSULTANT TO COMPLETE: name] | [CONSULTANT TO COMPLETE: date of appointment] | [CONSULTANT TO VERIFY: appointment letter on file] |
| Health and safety officer or agent | [CONSULTANT TO COMPLETE: name] | [CONSULTANT TO COMPLETE: date of appointment] | [CONSULTANT TO VERIFY: appointment letter on file] |
| First aider | [CONSULTANT TO COMPLETE: name] | [CONSULTANT TO COMPLETE: date of appointment] | [CONSULTANT TO VERIFY: first aid certificate on file] |
| Fire fighting / emergency coordinator | [CONSULTANT TO COMPLETE: name] | [CONSULTANT TO COMPLETE: date of appointment] | [CONSULTANT TO VERIFY: appointment letter on file] |

[CONSULTANT TO VERIFY: the appointments and ratios required for the size and risk profile of this project]

## 4. HAZARD IDENTIFICATION AND RISK ASSESSMENT
### 4.1 General site hazards
{{AI: List the general hazards a site of this type of work normally has (for example manual handling, slips and trips, falling objects, dust, noise, electrical, hazardous substances, vehicle movement) with typical control measures for each. Keep each hazard to two or three lines. Use bullet points starting with "- ".}}

### 4.2 Declared high-risk activities
{{AI+activities: For EACH high-risk activity declared in the project information, write one entry with the activity name as a sub-heading starting with "### ", then "Hazards:" and "Typical control measures:" as short bullet lists, and end each entry with a flag asking the consultant to verify the controls for that activity. If no high-risk activities were declared, write one sentence saying so and end with a flag asking the consultant to confirm.}}

### 4.3 Risk assessment register
[CONSULTANT TO INSERT: project-specific risk assessment register (hazard, risk rating before and after controls, responsible person)]

## 5. SAFE WORK PROCEDURES AND METHOD STATEMENTS
[CONSULTANT TO INSERT: method statements for the high-risk activities declared in section 4.2]

## 6. INDUCTION, TRAINING AND COMPETENCY
All persons must complete a site induction before starting work on site. An induction register is kept and signed by each person inducted. Toolbox talks are held at the frequency set out below and recorded in the toolbox talk register.

| ITEM | REQUIREMENT |
|---|---|
| Site induction | Before first entry to site |
| Toolbox talk frequency | [CONSULTANT TO COMPLETE: frequency of toolbox talks] |
| Training and competency records | [CONSULTANT TO VERIFY: training certificates and competency records for workers on high-risk activities] |
| Medical fitness certificates | [CONSULTANT TO VERIFY: medical fitness certificates for workers where required] |

## 7. PERSONAL PROTECTIVE EQUIPMENT (PPE)
The minimum PPE for all persons on site is a hard hat, safety footwear and a high-visibility garment. Additional PPE is required where the risk assessment identifies it.
[CONSULTANT TO COMPLETE: additional PPE required for the declared activities]

## 8. EMERGENCY PREPAREDNESS
{{AI: Write a short emergency preparedness section suited to the type of work and the site address provided: how emergencies are raised on site, the assembly point arrangement, and first aid arrangements. Do not name specific hospitals, clinics, telephone numbers or distances. Keep it under 250 words.}}

### 8.1 Emergency contacts
| SERVICE | CONTACT DETAILS |
|---|---|
| Nearest hospital or clinic | [CONSULTANT TO COMPLETE: name and telephone number] |
| Ambulance | [CONSULTANT TO COMPLETE: telephone number] |
| Fire department | [CONSULTANT TO COMPLETE: telephone number] |
| Police | [CONSULTANT TO COMPLETE: telephone number] |
| Site agent | {{site_agent}} |

## 9. INCIDENT REPORTING AND INVESTIGATION
All incidents, injuries and near misses must be reported to the site agent immediately and recorded in the incident register. Serious incidents are investigated and corrective actions recorded.
[CONSULTANT TO VERIFY: statutory incident reporting requirements and forms that apply to this project]

## 10. SUBCONTRACTOR MANAGEMENT
Subcontractors declared at intake:
{{subcontractors}}

Each subcontractor must submit proof of good standing and its own health and safety documentation before starting work on site.
[CONSULTANT TO VERIFY: letters of good standing and subcontractor health and safety documents on file]

## 11. INSPECTIONS AND MONITORING
| INSPECTION | FREQUENCY | RESPONSIBLE PERSON |
|---|---|---|
| Site walk-through | Daily | [CONSULTANT TO COMPLETE: name] |
| Formal health and safety inspection | Weekly | [CONSULTANT TO COMPLETE: name] |
| Plant and equipment checks | Before use / as required | [CONSULTANT TO COMPLETE: name] |
| Health and safety audit | [CONSULTANT TO COMPLETE: frequency] | [CONSULTANT TO COMPLETE: name] |

## 12. DOCUMENT REGISTER
| DOCUMENT | ON FILE |
|---|---|
| Company registration and CIDB certificate | [CONSULTANT TO VERIFY: on file] |
| Letter of good standing (compensation fund) | [CONSULTANT TO VERIFY: on file] |
| Public liability / contractor insurance | [CONSULTANT TO VERIFY: on file] |
| Appointment letters | [CONSULTANT TO VERIFY: on file] |
| Risk assessments and method statements | [CONSULTANT TO VERIFY: on file] |
| Induction and toolbox talk registers | [CONSULTANT TO VERIFY: on file] |
| Medical fitness and training certificates | [CONSULTANT TO VERIFY: on file] |
| Plant, equipment and PPE registers | [CONSULTANT TO VERIFY: on file] |
| First aid and fire equipment registers | [CONSULTANT TO VERIFY: on file] |
| Incident register | [CONSULTANT TO VERIFY: on file] |
$tpl$, 'Starter general template - needs professional review'
FROM project_types WHERE code = 'T00'
ON CONFLICT (project_type_id, version) DO NOTHING;
