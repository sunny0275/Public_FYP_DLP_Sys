/**
 * LLM Classification Tuning Sample Generator v2
 * 
 * Generates 200 balanced training samples by:
 * 1. Reading samples from docs/llm-test-samples (removing YAML front matter)
 * 2. Adding custom financial chart examples
 * 3. Creating Vertex AI JSONL format
 * 
 * Balance: 50 PUBLIC + 50 INTERNAL + 50 CONFIDENTIAL + 50 STRICTLY_CONFIDENTIAL
 * 
 * Run with: node generate-classification-samples-v2-full.js
 */

const fs = require('fs');
const path = require('path');

const SAMPLES_DIR = path.join(__dirname, '..', 'docs', 'llm-test-samples');
const MD_SAMPLES_DIR = path.join(SAMPLES_DIR, 'md');

// ============ SYSTEM PROMPT ============

const SYSTEM_PROMPT = `You are a document classification expert for an enterprise Data Loss Prevention (DLP) system.
Your task is to analyze document content and classify it into one of four classification levels:

1. PUBLIC: Information that can be freely shared externally
2. INTERNAL: Information for internal use only, no external sharing
3. CONFIDENTIAL: Sensitive business information, restricted access
4. STRICTLY_CONFIDENTIAL: Highly sensitive information (high-risk PII, bank/payment data, trade secrets)

Classification criteria:
- STRICTLY_CONFIDENTIAL: Contains high-risk PII (ID/passport/HKID/DOB), bank/payment identifiers (bank accounts, credit cards),
  sensitive financial ledgers, trade secrets, confidential agreements, executive compensation, legal matters
- CONFIDENTIAL: Contains business strategies, internal financial data, employee information,
  proprietary business information, contracts, vendor evaluations, budgets
- INTERNAL: Contains general business information, internal policies, meeting notes,
  non-sensitive operational data, IT notices, training materials
- PUBLIC: Contains marketing materials, public announcements, published information,
  general company information, event invitations

Tagging guidelines (important):
- Always output tags in lowercase kebab-case
- If any personal/customer/employee identifiers are present, include "pii-detected"
- If high-risk identifiers (IDs, credit cards, bank accounts) are present, include "pii-high-risk"
- If finance/accounting content is present, include "finance-detected"
- Prefer domain tags: "hr", "finance", "customer-data", "legal", "invoice", "meeting-minutes", "internal-policy"

Respond ONLY with a valid JSON:
{"classificationLevel":"PUBLIC|INTERNAL|CONFIDENTIAL|STRICTLY_CONFIDENTIAL","confidence":0.0-1.0,"reason":"Brief explanation","suggestedTags":["tag1","tag2"],"detectedSensitiveInfo":["type1"]}`;

// ============ HELPER FUNCTIONS ============

/**
 * Remove YAML front matter (--- ... ---) from content
 */
function stripYamlFrontMatter(content) {
  // Remove the --- ... --- block at the beginning
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '').trim();
}

/**
 * Extract level from filename
 */
function extractLevel(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('sample_public_') || lower.includes('public_')) return 'PUBLIC';
  if (lower.includes('sample_internal_') || lower.includes('internal_')) return 'INTERNAL';
  if (lower.includes('sample_confidential_') || lower.includes('confidential_')) return 'CONFIDENTIAL';
  if (lower.includes('sample_strictly_') || lower.includes('strictly_confidential')) return 'STRICTLY_CONFIDENTIAL';
  // For financial and onboarding files, return null (will be classified by content)
  if (lower.includes('sample_financial_') || lower.includes('sample_onboarding_')) return null;
  return null;
}

/**
 * Extract title from content
 */
function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled Document';
}

/**
 * Determine expected classification based on content analysis
 */
function determineClassification(level, content) {
  const lowerContent = content.toLowerCase();
  const hasHkid = /\b[A-Z]\d{6}\(\d\)\b|\bHKID\b/i.test(content);
  const hasPassport = /\b[A-Z]{1,2}\d{6,7}\b/i.test(content);
  const hasBankAccount = /\b\d{3}-\d{3}-\d{6,}\b|\baccount.*\d{10,}/i.test(content);
  const hasSalary = /salary|compensation|bonus|pay|remuneration/i.test(lowerContent);
  const hasFinancial = /budget|revenue|profit|forecast|financial/i.test(lowerContent);
  const hasLegal = /litigation|lawsuit|regulatory|sec|compliance/i.test(lowerContent);
  const hasEmployeePii = /employee.*id|emp-\d{4}|person.*chan/i.test(lowerContent);
  
  // For files already marked as STRICTLY_CONFIDENTIAL
  if (level === 'STRICTLY_CONFIDENTIAL') {
    const tags = ['strictly-confidential'];
    const detected = [];
    
    if (hasHkid || hasPassport) { tags.push('pii-high-risk', 'pii-detected'); detected.push('hkid', 'passport'); }
    if (hasBankAccount) { tags.push('pii-high-risk', 'bank-account'); detected.push('bank-account'); }
    if (hasSalary || hasFinancial) { tags.push('finance-detected', 'payroll-detected'); detected.push('salary-information', 'financial-data'); }
    if (hasLegal) { tags.push('legal', 'regulatory'); detected.push('legal-matter'); }
    if (hasEmployeePii) { tags.push('pii-detected'); detected.push('employee-pii'); }
    
    return {
      classificationLevel: 'STRICTLY_CONFIDENTIAL',
      confidence: 0.95,
      reason: 'Contains highly sensitive PII, financial data, or regulatory information requiring strict access control',
      suggestedTags: tags.slice(0, 8),
      detectedSensitiveInfo: detected
    };
  }
  
  // For CONFIDENTIAL files
  if (level === 'CONFIDENTIAL') {
    const tags = ['confidential', 'business-data'];
    const detected = [];
    
    if (hasFinancial) { tags.push('finance-detected'); detected.push('financial-metrics'); }
    if (hasEmployeePii) { tags.push('hr'); detected.push('employee-info'); }
    
    return {
      classificationLevel: 'CONFIDENTIAL',
      confidence: 0.92,
      reason: 'Contains sensitive business information, internal financial data or employee information',
      suggestedTags: tags.slice(0, 6),
      detectedSensitiveInfo: detected
    };
  }
  
  // For INTERNAL files
  if (level === 'INTERNAL') {
    const tags = ['internal'];
    const detected = [];
    
    if (hasEmployeePii) { tags.push('hr', 'internal-policy'); detected.push('employee-ids'); }
    if (/meeting|sprint|agenda|training/i.test(lowerContent)) { tags.push('meeting-minutes'); }
    if (/it|sprint|ops|runbook|handbook/i.test(lowerContent)) { tags.push('it-department'); }
    
    return {
      classificationLevel: 'INTERNAL',
      confidence: 0.90,
      reason: 'Internal operational document without sensitive personal or financial data',
      suggestedTags: tags.slice(0, 5),
      detectedSensitiveInfo: detected
    };
  }
  
  // For PUBLIC files
  return {
    classificationLevel: 'PUBLIC',
    confidence: 0.95,
    reason: 'Public-facing content with no sensitive information',
    suggestedTags: ['public', 'marketing'],
    detectedSensitiveInfo: []
  };
}

// ============ CUSTOM FINANCIAL SAMPLES ============

const customSamples = [
  // PUBLIC samples (21 more needed)
  { level: 'PUBLIC', title: 'Company Newsletter March 2026', content: `COMPANY NEWSLETTER
March 2026 Edition

Welcome to our monthly newsletter!

Highlights This Month:
- Team building event photos from February
- New coffee machines installed on all floors
- Spring cleaning day scheduled for April 5th
- Sports day registration now open

Employee Spotlight:
Congratulations to our Q1 winners of the Innovation Award!

Fun Facts:
- 95% employee satisfaction rate
- 50+ new hires this quarter
- 10,000 cups of coffee consumed monthly

Upcoming Events:
- March 15: Town Hall Meeting
- March 22: Tech Talk: AI in the Workplace
- April 5: Spring Cleaning Day

Health Tip: Remember to take regular breaks and stretch!

Subscribe to our blog: blog.company.com
Follow us on LinkedIn: @CompanyOfficial

Public - Share freely` },
  { level: 'PUBLIC', title: 'Job Posting - Software Engineer', content: `CAREER OPPORTUNITY
Software Engineer
Join Our Growing Team!

About Us:
We are a leading technology company based in Hong Kong, serving clients across Asia Pacific.

Position: Software Engineer
Experience: 2-5 years
Location: Hong Kong

Requirements:
- Bachelor's degree in Computer Science or related field
- Proficiency in Java, Python, or JavaScript
- Experience with cloud platforms (AWS, Azure)
- Good communication skills

What We Offer:
- Competitive salary and benefits
- Flexible working hours
- Professional development opportunities
- Health insurance

Apply now: careers@company.com
Visit: www.company.com/careers

Equal Opportunity Employer` },
  { level: 'PUBLIC', title: 'Office Renovation Notice', content: `OFFICE RENOVATION NOTICE
Building Management

Dear All,

We are pleased to announce that the 5th floor renovation will begin on April 1, 2026.

Project Timeline:
- Phase 1: April 1-15 (Electrical work)
- Phase 2: April 16-30 (Interior installation)
- Phase 3: May 1-10 (Final touches)

Alternative Workspaces:
During renovation, affected teams will be relocated to temporary spaces on the 6th floor.

Facilities Available:
- Temporary meeting rooms available for booking
- Cafeteria remains fully operational
- Parking: Normal operations

We apologize for any inconvenience and appreciate your patience during this improvement project.

Building Management Team
Public Notice` },
  { level: 'PUBLIC', title: 'Product Demo Registration', content: `FREE PRODUCT DEMO
Enterprise Solutions Live Demo

Date: April 20, 2026
Time: 2:00 PM - 4:00 PM HKT
Location: Online Webinar

Register Now: demo.company.com

What You'll Learn:
- How our AI-powered analytics work
- Real-world case studies from clients
- Live Q&A with product experts
- Special demo pricing for attendees

Featured Products:
- Analytics Dashboard
- Security Suite
- Cloud Integration Tools

Presenter: Jane Smith, VP of Product
Host: John Doe, Customer Success Manager

Free Registration - Limited Spots
Open to all businesses` },
  { level: 'PUBLIC', title: 'Holiday Schedule 2026', content: `PUBLIC HOLIDAYS 2026
Hong Kong SAR

January: New Year's Day (Jan 1)
February: Lunar New Year (Jan 29-31)
March: Ching Ming Festival (Apr 5)
April: Easter Friday (Apr 3), Easter Monday (Apr 6)
May: Labour Day (May 1)
June: Dragon Boat Festival (May 31)
July: Hong Kong Special Administrative Region Establishment Day (July 1)
September: Mid-Autumn Festival (Sep 17)
October: National Day (Oct 1), Chung Yeung Festival (Oct 25)
December: Christmas Day, Boxing Day (Dec 25-26)

For more information, visit: www.gov.hk/holidays` },
  { level: 'PUBLIC', title: 'Community Event Invitation', content: `COMMUNITY HEALTH DAY
Free Health Screening & Wellness Fair

Date: April 12, 2026
Time: 10:00 AM - 4:00 PM
Venue: Central Park, Hong Kong

Free Services:
- Blood pressure screening
- Eye check-ups
- Dental consultations
- Nutrition advice

Activities:
- Yoga sessions (11am, 2pm)
- Healthy cooking demonstrations
- Children's games and activities
- Raffle prizes

All are welcome! Free admission.

Organized by: ABC Community Foundation
Supported by: Hong Kong Health Department
Public Event - Invite Everyone` },
  { level: 'PUBLIC', title: 'Customer Satisfaction Survey Results', content: `CUSTOMER SATISFACTION REPORT
Q1 2026 Results

Survey Period: January - March 2026
Responses: 2,500+ customers

Overall Satisfaction: 4.3/5.0

By Category:
- Product Quality: 4.4
- Customer Service: 4.2
- Delivery Speed: 4.5
- Value for Money: 4.1

Key Highlights:
- 92% would recommend us to others
- 88% satisfied with response time
- 85% found our staff helpful

Areas for Improvement:
- Mobile app user experience
- Product documentation clarity

Thank you to all customers who participated!

Published: March 2026
Public Report` },
  { level: 'PUBLIC', title: 'Tech Meetup Announcement', content: `TECH COMMUNITY MEETUP
AI & Machine Learning Night

Date: April 18, 2026
Time: 6:30 PM
Location: WeWork Central, Hong Kong

Agenda:
6:30 PM - Registration & Networking
7:00 PM - Talk 1: "LLMs in Enterprise"
7:45 PM - Talk 2: "MLOps Best Practices"
8:30 PM - Networking & Refreshments

Speakers:
- Dr. Sarah Lee, AI Research Lead at TechCorp
- Mr. James Wong, Senior ML Engineer

RSVP Required: meetup.com/techhongkong

Open to all tech enthusiasts!
Free admission
Public Event` },
  { level: 'PUBLIC', title: 'Sustainability Report Summary', content: `SUSTAINABILITY REPORT 2025
Building a Greener Future

Our Commitment:
- Carbon neutral target: 2030
- 100% renewable energy: 2028

2025 Achievements:
- Reduced paper usage by 40%
- LED lighting in all offices
- 85% waste recycling rate
- Planted 500 trees

Environmental Goals 2026:
- Reduce carbon emissions by 25%
- Achieve 90% recyclable packaging
- Electric vehicle fleet expansion

Published for public awareness
www.company.com/sustainability` },
  { level: 'PUBLIC', title: 'Partner Appreciation Event', content: `ANNUAL PARTNER APPRECIATION NIGHT
You Are Invited!

Date: April 25, 2026
Time: 7:00 PM
Venue: Grand Hyatt Hong Kong

An Evening of:
- Fine dining experience
- Live entertainment
- Award ceremony
- Networking opportunities

Dress Code: Smart Casual

RSVP by April 15: partners@company.com

We value our partnership and look forward to celebrating with you!

Best regards,
The Partnership Team
Public Invitation` },
  { level: 'PUBLIC', title: 'Webinar Registration', content: `FREE WEBINAR
Digital Transformation Essentials

Date: May 5, 2026
Time: 10:00 AM HKT
Duration: 90 minutes
Platform: Zoom

What You'll Learn:
- Steps to start your digital journey
- Common pitfalls to avoid
- Tools and technologies that work
- Q&A with experts

Presenter:
Michael Chen, Digital Strategist

Who Should Attend:
- Business owners
- Department heads
- IT managers
- Anyone interested in digital transformation

Register: webinar.company.com
Free - Open to public` },

  // INTERNAL samples (23 more needed)
  { level: 'INTERNAL', title: 'IT Security Policy Update', content: `IT SECURITY POLICY
Version 3.2 | Internal Distribution Only

Effective: April 1, 2026

Key Changes:
1. Password requirements updated (min 12 characters)
2. MFA mandatory for all systems
3. VPN required for remote access
4. New endpoint protection software

Compliance Deadline: April 15, 2026

Affected Systems:
- Email (new MFA setup required)
- HR Portal
- Project Management Tool
- Code Repository

IT Helpdesk: ext. 1234 or it-support@company.com

Internal Use Only` },
  { level: 'ININTERNAL', title: 'Sprint Retrospective Notes', content: `SPRINT RETROSPECTIVE
Sprint 24 | March 10-21, 2026

Team: Platform Engineering

What Went Well:
- Feature deployment on schedule
- Code review turnaround improved
- Team collaboration improved

What Could Be Better:
- Documentation quality
- Meeting efficiency
- Bug fix velocity

Action Items:
1. Update wiki with API documentation by March 28
2. Implement daily standup time limit (15 min)
3. Add automated tests for critical paths

Participants: 8 team members
Internal Meeting Notes` },
  { level: 'INTERNAL', title: 'Employee Handbook Excerpt', content: `EMPLOYEE HANDBOOK
Working Hours & Leave Policy

Standard Working Hours:
Monday - Friday: 9:00 AM - 6:00 PM
Flexible start: 8:00 AM - 10:00 AM
Lunch break: 12:00 PM - 1:00 PM

Remote Work Policy:
- 2 days WFH per week (manager approval)
- Core hours: 10:00 AM - 4:00 PM

Annual Leave Entitlement:
- Year 1-2: 12 days
- Year 3-5: 15 days
- Year 6+: 18 days

Sick Leave: 14 days per year
Medical Certificate required after 1 day

Internal Document - Employee Reference` },
  { level: 'INTERNAL', title: 'Department Meeting Schedule Q2', content: `Q2 2026 MEETING CALENDAR
Engineering Department

Weekly Meetings:
- Monday: 9:30 AM - Team Standup (15 min)
- Wednesday: 2:00 PM - Sprint Planning (1 hr)
- Friday: 4:00 PM - Sprint Review (30 min)

Monthly Meetings:
- First Tuesday: 10:00 AM - Architecture Review
- Third Thursday: 3:00 PM - Tech Talk Series
- Last Friday: 4:30 PM - Team Social

Quarterly:
- Month 3, Week 4: All-Hands Meeting
- Month 3, Week 4: Performance Review

Room Bookings: Use Outlook calendar
Internal Schedule` },
  { level: 'INTERNAL', title: 'Code of Conduct Reminder', content: `CODE OF CONDUCT REMINDER
All Staff | Annual Acknowledgment Required

Core Values:
- Integrity: Act honestly and ethically
- Respect: Treat everyone with dignity
- Excellence: Strive for quality
- Collaboration: Work together effectively

Expected Behaviors:
- Professional communication
- Timely response to emails (within 24 hrs)
- Respectful meeting etiquette
- Proper use of company resources

Prohibited:
- Harassment or discrimination
- Conflicts of interest
- Unauthorized data sharing
- Substance abuse at work

Deadline for acknowledgment: March 31, 2026
Complete in HR Portal

Internal Policy Document` },
  { level: 'INTERNAL', title: 'Facilities Request Form', content: `FACILITIES REQUEST FORM
Internal Use

Request Type:
[ ] New Equipment
[ ] Furniture Adjustment
[ ] Space Reconfiguration
[x] Maintenance Issue

Details:
Issue: Air conditioning not cooling properly
Location: Floor 5, Area B
Date Noticed: March 20, 2026
Priority: Medium

Requester: John Smith (EMP-1234)
Department: Engineering
Contact: ext. 4567

Facilities Response:
Assigned to: Building Ops
Expected Resolution: 2-3 business days

Internal Use Only` },
  { level: 'INTERNAL', title: 'Software License Inventory', content: `SOFTWARE LICENSE INVENTORY
IT Department | March 2026

Active Licenses:

| Software | Vendor | Total | Used | Available |
|----------|--------|-------|------|----------|
| Microsoft 365 | Microsoft | 500 | 485 | 15 |
| Adobe Creative Cloud | Adobe | 50 | 48 | 2 |
| JetBrains All Products | JetBrains | 30 | 28 | 2 |
| Slack Business+ | Slack | 500 | 475 | 25 |
| Zoom Business | Zoom | 200 | 190 | 10 |

Upcoming Renewals:
- Adobe CC: May 2026
- JetBrains: June 2026

Cost Center: IT-Operations
Budget: $50,000/month

Internal Inventory Report` },
  { level: 'INTERNAL', title: 'New Hire Orientation Schedule', content: `NEW EMPLOYEE ONBOARDING
Week 1 Schedule | March 24-28, 2026

Day 1 (Monday):
9:00 - HR Registration
10:00 - IT Setup & Access
11:00 - Security Training
2:00 - Team Introduction

Day 2 (Tuesday):
9:00 - Department Overview
11:00 - Tool Training
2:00 - Mentorship Program Introduction

Day 3 (Wednesday):
9:00 - Product Training
2:00 - Process Documentation Review

Day 4 (Thursday):
9:00 - Customer Journey Training
2:00 - Shadow Senior Team Member

Day 5 (Friday):
9:00 - First Project Kickoff
11:00 - Check-in with Manager
2:00 - Onboarding Feedback

HR Contact: hr-team@company.com
Internal Orientation` },
  { level: 'INTERNAL', title: 'Incident Response Checklist', content: `INCIDENT RESPONSE CHECKLIST
IT Security Team | Internal Use

Step 1: Initial Assessment
[ ] Identify affected systems
[ ] Determine severity (P1-P4)
[ ] Assign incident commander

Step 2: Containment
[ ] Isolate affected systems
[ ] Disable compromised accounts
[ ] Block malicious IPs

Step 3: Investigation
[ ] Collect logs
[ ] Identify root cause
[ ] Document timeline

Step 4: Resolution
[ ] Apply patches/fixes
[ ] Restore services
[ ] Verify resolution

Step 5: Post-Incident
[ ] Write incident report
[ ] Update runbook
[ ] Schedule review meeting

Escalation Matrix: See Appendix A
Internal Document` },
  { level: 'INTERNAL', title: 'Performance Review Guidelines', content: `PERFORMANCE REVIEW GUIDELINES
Manager Reference | HR Department

Review Cycle:
- Mid-Year: July
- Annual: December

Rating Scale:
1 = Needs Improvement
2 = Meets Expectations
3 = Exceeds Expectations
4 = Outstanding

Evaluation Criteria:
- Job Performance (40%)
- Teamwork (20%)
- Innovation (20%)
- Professional Development (20%)

Calibration Sessions:
- Department heads meet to ensure consistency
- All P4 ratings require VP approval

Timeline:
- Manager submission: 2 weeks before deadline
- Employee self-review: Due same day
- Calibration: 1 week
- Feedback sessions: Final week

Internal HR Document` },
  { level: 'INTERNAL', title: 'Project Status Report Template', content: `PROJECT STATUS REPORT
Weekly Update Template

Project Name: [Enter Project Name]
Report Date: [Date]
Prepared By: [Name]

Overall Status: [Green/Yellow/Red]

Progress This Week:
- Milestone 1: 100% complete
- Milestone 2: 75% complete
- Milestone 3: 25% complete

Next Week's Plan:
- Continue Milestone 2
- Start Milestone 4 preparation

Blockers:
- None / [List issues]

Budget Status:
- Spent: XX%
- Forecast: On Track / Variance

Risk Level: Low / Medium / High

Team Members: 5 FTEs
Internal Report` },
  { level: 'INTERNAL', title: 'Travel Expense Guidelines', content: `TRAVEL & EXPENSE POLICY
Finance Department

Booking Procedures:
1. Use Concur travel system
2. Book 14+ days in advance
3. Economy class for flights <6 hours
4. Business class requires VP approval

Daily Allowances (HKD):
- Breakfast: 80
- Lunch: 120
- Dinner: 200
- Transport: As actual

Receipt Requirements:
- All expenses >$100 must have receipt
- Submit within 30 days
- Use mobile app for receipt capture

Approval Hierarchy:
- <$5,000: Manager
- $5,000-$20,000: Director
- >$20,000: VP

Questions: finance@company.com
Internal Policy` },
  { level: 'INTERNAL', title: 'Knowledge Base Article Template', content: `KNOWLEDGE BASE ARTICLE
IT Help Desk

Title: [Issue or Topic]

Summary:
[One paragraph description]

Symptoms:
- [List observable symptoms]

Cause:
[Explain root cause]

Resolution:
Step 1: [Description]
Step 2: [Description]
Step 3: [Description]

Verification:
[How to confirm fix worked]

Related Articles:
- [Link to related KB]

Last Updated: [Date]
Author: [Name]
Internal KB Article` },
  { level: 'INTERNAL', title: 'Vendor Contact Directory', content: `VENDOR CONTACT DIRECTORY
Procurement Department | Updated March 2026

IT Services:
- AWS Support: support@aws.amazon.com
- Microsoft Azure: azure-support@microsoft.com
- Cisco TAC: tac@cisco.com

Facilities:
- Cleaning Service: service@cleanpro.hk
- Pest Control: info@pestguard.hk
- Security: security@secureserv.hk

Office Supplies:
- Stationery: orders@officesupply.hk
- IT Equipment: sales@techsupply.com

Catering:
- Events: events@cateringpro.hk
- Daily Meals: meals@foodserv.hk

Contract Manager: procurement@company.com
Internal Reference Only` },

  // CONFIDENTIAL samples (19 more needed)
  { level: 'CONFIDENTIAL', title: 'Quarterly Sales Pipeline Report', content: `CONFIDENTIAL
SALES PIPELINE REPORT
Q1 2026

Total Pipeline Value: HK$125M
Active Opportunities: 45
Win Rate: 32%

Pipeline by Stage:

| Stage | Count | Value | Avg Deal Size |
|-------|-------|-------|---------------|
| Prospecting | 12 | HK$15M | HK$1.25M |
| Qualification | 15 | HK$30M | HK$2.0M |
| Proposal | 10 | HK$40M | HK$4.0M |
| Negotiation | 8 | HK$40M | HK$5.0M |

Top Opportunities:
1. Bank of Asia: HK$8M (Negotiation)
2. TechStart Ltd: HK$5M (Proposal)
3. Global Trade Co: HK$4.5M (Proposal)

Regional Breakdown:
Hong Kong: 55%
Mainland China: 30%
Southeast Asia: 15%

Sales Director: James Lee
CONFIDENTIAL - Sales Leadership Only` },
  { level: 'CONFIDENTIAL', title: 'Headcount Planning Document', content: `CONFIDENTIAL
HEADCOUNT PLANNING FY2027
Finance & HR Joint Document

Current Headcount: 450 FTEs
Planned Headcount: 520 FTEs (+15%)

New Positions by Department:

| Department | Current | New | Total |
|------------|---------|-----|-------|
| Engineering | 150 | 35 | 185 |
| Sales | 80 | 20 | 100 |
| Marketing | 40 | 8 | 48 |
| Operations | 60 | 7 | 67 |
| Support | 120 | 0 | 120 |

Hiring Timeline:
- Q1 FY27: 40 positions
- Q2 FY27: 20 positions
- Q3 FY27: 10 positions

Budget Impact:
- Additional salary cost: HK$15M/year
- Recruitment cost: HK$2M
- Training cost: HK$1.5M

Approval Required: CEO + CFO
CONFIDENTIAL - Executive Level` },
  { level: 'CONFIDENTIAL', title: 'Customer Contract Terms', content: `CONFIDENTIAL
MASTER SERVICE AGREEMENT
Draft Terms for ABC Corporation

Contract Value: HK$5M/year
Duration: 3 years

Key Terms:
- Service Level Agreement: 99.9% uptime
- Support Response: <4 hours (Critical), <24 hours (Standard)
- Data Retention: 7 years
- Termination Notice: 90 days

Pricing:
| Service | Monthly Fee |
|---------|-------------|
| Basic Package | HK$200,000 |
| Premium Support | HK$100,000 |
| Custom Integration | HK$120,000 |

Payment Terms: Net 30
Renewal: Auto-renewal unless 90-day notice

Legal Review: Required
CONFIDENTIAL - Legal & Sales Only` },
  { level: 'CONFIDENTIAL', title: 'Competitive Analysis Report', content: `CONFIDENTIAL
COMPETITIVE LANDSCAPE ANALYSIS
March 2026

Main Competitors:

| Competitor | Market Share | Strength | Weakness |
|------------|--------------|----------|----------|
| TechCorp | 35% | Strong brand | High price |
| DataPro | 25% | Technology | Weak support |
| SecureNet | 20% | Security | Limited features |
| Our Company | 15% | Innovation | New to market |

Win/Loss Analysis:
- Won: 32 deals
- Lost: 68 deals

Common Loss Reasons:
1. Price too high (45%)
2. Not enough brand recognition (25%)
3. Feature gaps (20%)

Strategic Recommendations:
1. Launch competitive pricing tier
2. Increase marketing spend by 30%
3. Fast-track feature roadmap

Prepared by: Product Strategy Team
CONFIDENTIAL - Leadership Only` },
  { level: 'CONFIDENTIAL', title: 'Profit & Loss Summary', content: `CONFIDENTIAL
P&L SUMMARY
January - February 2026

Revenue: HK$18.5M
Cost of Goods: HK$7.4M
Gross Profit: HK$11.1M (60%)

Operating Expenses:
- Sales & Marketing: HK$3.2M
- R&D: HK$2.8M
- General & Admin: HK$1.5M
Total OpEx: HK$7.5M

Net Profit: HK$3.6M (19%)

Variance vs Budget:
- Revenue: +5% (favorable)
- Gross Margin: -2% (unfavorable)
- OpEx: On budget

Key Drivers:
- Higher than expected enterprise deals
- Increased cloud hosting costs
- Marketing campaign underperforming

Forecast for March:
- Revenue: HK$10M
- Net Profit: HK$1.8M

CONFIDENTIAL - Finance & Executive Only` },
  { level: 'CONFIDENTIAL', title: 'Merger Evaluation Notes', content: `CONFIDENTIAL
PARTNERSHIP OPPORTUNITY ANALYSIS
Target: DataSync Solutions Ltd

Deal Overview:
- Target Revenue: HK$50M
- Asking Price: HK$80M (1.6x revenue)
- Synergy Potential: HK$10M/year

Strategic Fit:
- Technology: Complementary
- Customer Base: 30% overlap
- Team: Strong engineering

Due Diligence Status:
- Financial: Complete
- Legal: In Progress
- Technical: Scheduled

Risk Factors:
- Integration complexity
- Key employee retention
- Culture alignment

Recommendation: Proceed to LOI stage

Investment Committee: Review scheduled April 5
CONFIDENTIAL - Executive & Board` },
  { level: 'CONFIDENTIAL', title: 'Customer Churn Analysis', content: `CONFIDENTIAL
CUSTOMER CHURN ANALYSIS
Q1 2026

Total Customers: 1,200
Churned: 36 (3%)

Churn by Segment:

| Segment | Customers | Churned | Rate |
|---------|-----------|---------|------|
| Enterprise | 150 | 3 | 2% |
| Mid-Market | 450 | 12 | 2.7% |
| SMB | 600 | 21 | 3.5% |

Churn Reasons:
- Price sensitivity: 40%
- Competitor switch: 30%
- Product fit: 20%
- Other: 10%

At-Risk Accounts (Top 10):
1. MegaCorp Ltd - Engagement Score: 25
2. GlobalTrade - Engagement Score: 28
3. RetailPro - Engagement Score: 30
...

Action Plan:
- Deploy customer success managers
- Launch retention campaigns
- Review pricing strategy

CONFIDENTIAL - CS & Sales Leadership` },
  { level: 'CONFIDENTIAL', title: 'Strategic Initiative Roadmap', content: `CONFIDENTIAL
STRATEGIC INITIATIVES 2026-2028
Three-Year Roadmap

2026 - Foundation:
- Launch AI-powered analytics
- Expand to 3 new markets
- Achieve SOC 2 certification
Budget: HK$25M

2027 - Growth:
- Launch enterprise platform v2
- Open Singapore office
- Target 50% market penetration
Budget: HK$40M

2028 - Scale:
- IPO preparation
- M&A of complementary technology
- Global expansion (EU, US)
Budget: HK$60M

Key Milestones:
- Q2 2026: AI feature launch
- Q4 2026: Reach 1,000 customers
- Q2 2027: Series C funding
- Q4 2028: IPO target

Board Approved: February 2026
CONFIDENTIAL - Executive Only` },
  { level: 'CONFIDENTIAL', title: 'Technology Stack Assessment', content: `CONFIDENTIAL
TECHNOLOGY STACK ASSESSMENT
IT Architecture Review

Current Stack:
- Frontend: React, Angular
- Backend: Java Spring, Node.js
- Database: PostgreSQL, MongoDB
- Cloud: AWS (primary), Azure (backup)
- CI/CD: Jenkins, GitHub Actions

Technical Debt Analysis:
- Legacy code: 30% of codebase
- Untested code: 15%
- Deprecated dependencies: 45 packages

Migration Plan:
Phase 1 (2026): Modernize authentication
Phase 2 (2027): Database consolidation
Phase 3 (2028): Full cloud migration

Estimated Cost: HK$8M
Timeline: 24 months

Risk: Medium
Recommendation: Proceed with caution

CONFIDENTIAL - IT Leadership` },
  { level: 'CONFIDENTIAL', title: 'Pricing Strategy Document', content: `CONFIDENTIAL
PRICING STRATEGY UPDATE
Effective Q2 2026

Current Pricing Issues:
- Enterprise deals 20% below target margin
- SMB pricing not competitive
- Channel partner margin too high

Proposed Changes:

| Product | Current | New | Change |
|---------|---------|-----|--------|
| Basic | HK$999/mo | HK$1,199/mo | +20% |
| Professional | HK$2,999/mo | HK$3,499/mo | +17% |
| Enterprise | Custom | Custom +10% | +10% |

Competitor Parity:
- Match TechCorp on SMB
- 5% below DataPro on Enterprise

Implementation:
- Communicate changes by April 15
- Apply to new contracts only
- Existing contracts honored until renewal

Expected Impact:
- Revenue increase: HK$5M/year
- Margin improvement: +3%

CONFIDENTIAL - Sales & Finance Only` },

  // STRICTLY_CONFIDENTIAL samples (21 more needed)
  { level: 'STRICTLY_CONFIDENTIAL', title: 'Security Incident Report', content: `STRICTLY CONFIDENTIAL
SECURITY INCIDENT REPORT
INC-2026-0034

Incident Date: March 15, 2026
Severity: HIGH
Status: Resolved

Summary:
Unauthorized access attempt detected on customer database containing personal information.

Impact Assessment:
- Records Affected: 5,000 customer records
- Data Types: Names, emails, addresses
- Financial Data: None exposed
- No PII (no HKID, bank accounts)

Technical Details:
- Attack Vector: SQL Injection via API endpoint
- Duration: 2 hours before detection
- Source IP: 203.45.67.xxx (China)

Response Actions:
1. Patched vulnerability within 1 hour
2. Disabled affected API endpoints
3. Notified affected customers
4. Engaged forensic team

Root Cause: Insufficient input sanitization
Corrective Action: Security code review process implemented

Reported to: CEO, CISO, Legal
STRICTLY CONFIDENTIAL - Incident Response Team` },
  { level: 'STRICTLY_CONFIDENTIAL', title: 'Legal Matter - Litigation', content: `STRICTLY CONFIDENTIAL
LITIGATION MATTER SUMMARY
Case: XYZ Corp vs. Our Company

Case Number: HCA 1234/2026
Court: High Court of Hong Kong
Status: Active - Discovery Phase

Allegations:
- Breach of contract
- Misappropriation of trade secrets
- Unfair business practices

Claim Amount: HK$50M

Key Evidence:
- Email correspondence (500+ pages)
- Internal documents (1,200+ pages)
- Witness statements (8 individuals)

Defense Strategy:
- Deny all allegations
- Counterclaim for defamation
- Request dismissal based on lack of evidence

Legal Team:
- Lead Counsel: Ms. Wong (Snr Partner)
- Associate: Mr. Lee
- External: King & Wood Mallesons

Estimated Legal Costs: HK$8M
Reserve Required: HK$15M

Board Briefing Required: Yes
STRICTLY CONFIDENTIAL - Legal & Executive` },
  { level: 'STRICTLY_CONFIDENTIAL', title: 'Employee Termination File', content: `STRICTLY CONFIDENTIAL
TERMINATION RECORD
Case: EMP-2026-0478

Employee: Mr. David Chan
Employee ID: EMP-3456
Department: Sales
Position: Senior Account Manager
Employment Period: 2019-2026 (7 years)

Termination Date: March 20, 2026
Termination Type: Misconduct (summary dismissal)

Grounds:
1. Breach of company policy (sharing customer data)
2. Conflict of interest (undisclosed side business)
3. Falsification of expense claims

Evidence:
- Email logs showing data sharing
- Bank statements showing payments from competitor
- 15 expense claims totaling HK$45,000 flagged

Final Settlement:
- Notice Pay: waived (due to misconduct)
- Accrued Leave: HK$28,000 (paid)
- Provident Fund: HK$180,000 (paid)

Non-Disclosure: Required (3 years)
Non-Compete: 12 months (within Hong Kong)

Signed: HR Director, CEO
STRICTLY CONFIDENTIAL - HR & Legal` },
  { level: 'STRICTLY_CONFIDENTIAL', title: 'Regulatory Examination Response', content: `STRICTLY CONFIDENTIAL
REGULATORY EXAMINATION RESPONSE
Hong Kong Privacy Commissioner

Reference: PCPD/EXAM/2026/0345
Received: March 10, 2026
Response Due: April 10, 2026

Nature of Examination:
- Data Protection compliance audit
- Cross-border data transfer practices
- Customer consent procedures

Information Required:
1. Complete data inventory (all systems)
2. Privacy policy documentation
3. Consent records for 500 randomly selected customers
4. Staff training records
5. Third-party data sharing agreements

Potential Findings:
- Minor: Documentation gaps
- Moderate: Consent language clarity
- Severe: None identified

Remediation Plan:
- Update privacy notices: 2 weeks
- Enhance consent mechanisms: 4 weeks
- Staff re-training: 6 weeks

Executive Sponsor: CEO
Legal Counsel: Required
STRICTLY CONFIDENTIAL - Legal, Compliance, Executive` },
  { level: 'STRICTLY_CONFIDENTIAL', title: 'Acquisition Due Diligence', content: `STRICTLY CONFIDENTIAL
ACQUISITION DUE DILIGENCE
Target: CloudTech Solutions Ltd
Deal Value: HK$500M

Financial Due Diligence:

| Metric | 2024 | 2025 | 2026E |
|--------|------|------|-------|
| Revenue | HK$80M | HK$95M | HK$115M |
| EBITDA | HK$12M | HK$16M | HK$20M |
| Net Debt | HK$25M | HK$30M | HK$35M |

Bank Account Details (for escrow):
HSBC: 004-XXX-XXX-5678
Account Name: CloudTech Solutions Ltd

Key Personnel Compensation:
- CEO Michael Wong: HKID M987654(3), Salary HK$3.5M
- CFO Susan Lee: HKID K456789(1), Salary HK$2.8M
- CTO David Chen: HKID A123456(9), Salary HK$2.5M

Tax Issues Identified:
- Undisclosed tax liability: HK$5M
- Transfer pricing adjustments: Under review

Legal Issues:
- Pending lawsuit: HK$8M provision

Recommendation: Proceed with adjustments
Investment Committee Approval: Required
STRICTLY CONFIDENTIAL - Deal Team Only` },
  { level: 'STRICTLY_CONFIDENTIAL', title: 'Executive Employment Contracts', content: `STRICTLY CONFIDENTIAL
EXECUTIVE COMPENSATION PACKAGES
Board Approved - March 2026

CEO - Mr. John Smith:
- Base Salary: HK$3,000,000/year
- Annual Bonus: Up to 100% of base
- Stock Options: 100,000 shares (4-year vest)
- Signing Bonus: HK$1,000,000
- HKID: K123456(7)
- Bank Account: HSBC 004-XXX-XXX-1111

CFO - Ms. Sarah Wong:
- Base Salary: HK$2,200,000/year
- Annual Bonus: Up to 80% of base
- Stock Options: 60,000 shares (4-year vest)
- Signing Bonus: HK$600,000
- HKID: G789012(3)
- Bank Account: Hang Seng 391-XXX-XXX-2222

CTO - Mr. James Chen:
- Base Salary: HK$2,000,000/year
- Annual Bonus: Up to 60% of base
- Stock Options: 50,000 shares (4-year vest)
- HKID: A567890(1)
- Bank Account: HSBC 004-XXX-XXX-3333

Severance Terms: 12 months base salary
Non-Compete: 24 months
Non-Disclosure: Permanent

Board Secretary: Ms. Patricia Chan
STRICTLY CONFIDENTIAL - Board Only` },
  { level: 'STRICTLY_CONFIDENTIAL', title: 'VIP Client Financial Profile', content: `STRICTLY CONFIDENTIAL
VIP CLIENT PROFILE
Client: MegaBank International

Account Manager: Alice Lee
Client Since: 2018

Account Details:
- Account Number: 004-XXX-XXX-9999
- Credit Limit: USD 10M
- Current Balance: USD 8.5M
- Average Monthly Revenue: USD 250,000

Key Contact Information:
- Primary: John Chen (CFO)
  HKID: M456789(0)
  Phone: +852 XXXX XXXX
  Email: john.chen@megabank.com
  
- Secondary: Mary Wong (Treasury)
  HKID: G321654(7)

Bank Relationships:
- Primary Banking: HSBC
- Secondary Banking: Goldman Sachs
- Investment Banker: JPMorgan

Financial Health:
- Credit Rating: AA
- Annual Revenue: USD 500M
- Employees: 2,000

Risk Flags:
- PEP (Politically Exposed Person) - John Chen
- Enhanced Due Diligence Required

Relationship Strategy: Premium white-glove service
STRICTLY CONFIDENTIAL - Relationship Manager Only` },
  { level: 'STRICTLY_CONFIDENTIAL', title: 'Investor Shareholder Register', content: `STRICTLY CONFIDENTIAL
SHAREHOLDER REGISTER
As of March 15, 2026

Major Shareholders:

| Shareholder | Shares | Percentage | Type |
|-------------|--------|------------|------|
| Founder Trust | 15,000,000 | 30% | Trust |
| Sequoia Capital | 8,000,000 | 16% | VC Fund |
| ABC Holdings | 5,000,000 | 10% | Corporate |
| Management Team | 4,500,000 | 9% | Common |
| Public Float | 17,500,000 | 35% | Listed |

Directors' Holdings:
- John Smith (CEO): 2,000,000 shares
  HKID: K123456(7)
  
- Sarah Wong (CFO): 1,500,000 shares
  HKID: G789012(3)
  
- James Chen (CTO): 1,000,000 shares
  HKID: A567890(1)

Share Option Pool: 5,000,000 (10%)

Upcoming Changes:
- New investor: XYZ Fund (5% pending)
- Lock-up expiry: June 2026

Transfer Agent: Computershare Hong Kong
STRICTLY CONFIDENTIAL - Company Secretary` },
  { level: 'STRICTLY_CONFIDENTIAL', title: 'Cyber Insurance Claim', content: `STRICTLY CONFIDENTIAL
CYBER INSURANCE CLAIM
Claim Number: CYB-2026-0089

Incident: Ransomware Attack
Date of Loss: February 28, 2026
Claim Filed: March 5, 2026

Coverage Summary:
- Policy Number: CYB-1234-5678
- Insurer: Zurich Insurance
- Coverage Limit: USD 5M
- Deductible: USD 50,000

Claimed Amount: USD 2.8M

Breakdown:
- Incident Response: USD 800,000
  (Forensic experts, legal counsel, PR)
- System Restoration: USD 1,200,000
  (IT staff overtime, external consultants)
- Business Interruption: USD 600,000
  (Lost revenue during downtime)
- Notification Costs: USD 200,000
  (Customer notification, credit monitoring)

Evidence Submitted:
- Forensic report
- Incident timeline
- Financial documentation
- Police report

Status: Under Review
Adjuster: Mr. Robert Brown
Next Update: April 15, 2026

STRICTLY CONFIDENTIAL - Finance & Legal` },
  { level: 'STRICTLY_CONFIDENTIAL', title: 'Confidential Settlement Agreement', content: `STRICTLY CONFIDENTIAL
SETTLEMENT AGREEMENT
Without Prejudice

Parties:
Claimant: Former Employee (Name Redacted)
HKID: KXXXXXX(X)
Employee ID: EMP-2018-0567

Company: Our Company Ltd

Settlement Terms:
1. Lump Sum Payment: HK$1,500,000
   Payable to: Claimant's nominated bank account
   Bank: HSBC 004-XXX-XXX-4567
   
2. Reference Letter: Provided (positive tone)

3. Mutual Non-Disclosure: 5 years

4. Non-Disparagement: Both parties

5. No Admission of Liability

6. Settlement in Full and Final

Payment Details:
- Prepared by: Finance Department
- Authorized by: CFO, HR Director
- Method: Bank transfer within 14 days

Legal Representation:
- Claimant: Ms. Linda Chan, Esq.
- Company: Mr. Peter Wong, Esq.

Signed: Both parties (dates redacted)
Witness: HR Manager
STRICTLY CONFIDENTIAL - HR & Legal` },
  { level: 'STRICTLY_CONFIDENTIAL', title: 'Board Meeting Sensitive Discussion', content: `STRICTLY CONFIDENTIAL
BOARD MEETING - IN CAMERA SESSION
Minutes Extract | March 25, 2026

Present: All Directors (8 members)
CEO, CFO, General Counsel (non-voting)

Agenda Item 5: Potential Takeover Approach

Discussion Summary:

Mr. Lee (Chair): "We've received preliminary interest from a private equity group."

Legal Implications:
- Takeover Code implications
- Disclosure requirements
- Director duties

Financial Advisor Views:
- Recommended price range: HK$15-18 per share
- Current share price: HK$12
- Premium range: 25-50%

Confidentiality Concerns:
- Board members with inside information
- Trading blackout: Implemented
- SEC notification: Required if proceeding

Decision:
- Form Special Committee
- Engage financial advisors
- No public announcement at this time

Leak Investigation:
- Background check on information flow
- Results to be shared at next meeting

STRICTLY CONFIDENTIAL - Board Members Only` }
];

// ============ MAIN PROCESSING ============

function readAndProcessSamples() {
  const samples = [];
  const levelCounts = { PUBLIC: 0, INTERNAL: 0, CONFIDENTIAL: 0, STRICTLY_CONFIDENTIAL: 0 };
  const targetPerLevel = 50;
  
  // Read all MD files from the md subdirectory
  const mdFiles = fs.readdirSync(MD_SAMPLES_DIR)
    .filter(f => f.endsWith('.md') && !f.includes('README'))
    .map(f => ({ file: f, path: path.join(MD_SAMPLES_DIR, f) }));
  
  console.log(`Found ${mdFiles.length} sample files in ${MD_SAMPLES_DIR}`);
  
  // Process files in random order for variety
  const shuffled = mdFiles.sort(() => Math.random() - 0.5);
  
  for (const fileInfo of shuffled) {
    const file = fileInfo.file;
    const level = extractLevel(file);
    
    // For financial and onboarding files, classify based on content
    let inferredLevel = level;
    if (!level) {
      const content = fs.readFileSync(fileInfo.path, 'utf-8').toLowerCase();
      if (file.toLowerCase().includes('financial')) {
        // Financial files are typically confidential or strictly confidential
        if (/salary|payroll|compensation|bank account|credit card|hkid|passport/i.test(content)) {
          inferredLevel = 'STRICTLY_CONFIDENTIAL';
        } else {
          inferredLevel = 'CONFIDENTIAL';
        }
      } else if (file.toLowerCase().includes('onboarding')) {
        // Onboarding files are typically internal
        inferredLevel = 'INTERNAL';
      }
    }
    
    if (!inferredLevel) continue;
    
    // Check if we already have enough samples for this level
    if (levelCounts[inferredLevel] >= targetPerLevel) continue;
    
    const content = fs.readFileSync(fileInfo.path, 'utf-8');
    
    // Remove YAML front matter
    const cleanContent = stripYamlFrontMatter(content);
    const title = extractTitle(cleanContent);
    const expected = determineClassification(inferredLevel, cleanContent);
    
    // Truncate very long content for training efficiency
    const truncatedContent = cleanContent.length > 2000 
      ? cleanContent.substring(0, 2000) + '\n\n[Content truncated for training]'
      : cleanContent;
    
    samples.push({
      level: inferredLevel,
      title,
      content: truncatedContent,
      expected,
      source: file
    });
    
    levelCounts[inferredLevel]++;
    
    // Check if we've reached target for all levels
    if (Object.values(levelCounts).every(c => c >= targetPerLevel)) break;
  }
  
  // Add custom samples if we need more
  for (const custom of customSamples) {
    const level = custom.level;
    if (levelCounts[level] < targetPerLevel) {
      samples.push({
        level,
        title: custom.title,
        content: custom.content,
        expected: determineClassification(level, custom.content),
        source: 'custom'
      });
      levelCounts[level]++;
    }
  }
  
  console.log('\nSamples from files:');
  for (const [level, count] of Object.entries(levelCounts)) {
    console.log(`  ${level}: ${count}`);
  }
  
  return samples;
}

// ============ GENERATE JSONL ============

function generateJsonl(samples) {
  return samples.map((sample, idx) => {
    const userPrompt = `Classify the following document:

Document Title: ${sample.title}

${sample.content}`;

    const expectedResponse = {
      classificationLevel: sample.expected.classificationLevel,
      confidence: sample.expected.confidence,
      reason: sample.expected.reason,
      suggestedTags: sample.expected.suggestedTags,
      detectedSensitiveInfo: sample.expected.detectedSensitiveInfo
    };

    return JSON.stringify({
      systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents: [
        { role: "user", parts: [{ text: userPrompt }] },
        { role: "model", parts: [{ text: JSON.stringify(expectedResponse) }] }
      ]
    });
  });
}

// ============ STATISTICS ============

function generateStatistics(samples) {
  const stats = {};
  
  for (const sample of samples) {
    const level = sample.level;
    if (!stats[level]) {
      stats[level] = { total: 0, sources: {} };
    }
    stats[level].total++;
    
    const source = sample.source;
    if (!stats[level].sources[source]) {
      stats[level].sources[source] = 0;
    }
    stats[level].sources[source]++;
  }
  
  return stats;
}

// ============ MAIN ============

const outputDir = __dirname;

// Step 1: Read and process samples
const samples = readAndProcessSamples();

// Step 2: Generate JSONL
const jsonlContent = generateJsonl(samples);

// Step 3: Write JSONL
const jsonlPath = path.join(outputDir, 'classification-samples-v2-full.jsonl');
fs.writeFileSync(jsonlPath, jsonlContent.join('\n'), 'utf-8');
console.log(`\nGenerated ${samples.length} classification samples`);
console.log(`Written to: ${jsonlPath}`);

// Step 4: Generate statistics
const stats = generateStatistics(samples);

// Step 5: Write summary CSV
let csv = 'Level,Source,Count\n';
for (const [level, data] of Object.entries(stats)) {
  for (const [source, count] of Object.entries(data.sources)) {
    csv += `${level},${source},${count}\n`;
  }
}

const csvPath = path.join(outputDir, 'classification-samples-v2-summary.csv');
fs.writeFileSync(csvPath, csv, 'utf-8');
console.log(`Summary written to: ${csvPath}`);

// Step 6: Print summary
console.log('\n' + '='.repeat(80));
console.log('FINAL SAMPLE DISTRIBUTION');
console.log('='.repeat(80));

for (const [level, data] of Object.entries(stats)) {
  console.log(`\n${level} (${data.total} samples):`);
  const sourceList = Object.entries(data.sources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  for (const [source, count] of sourceList) {
    console.log(`  - ${source}: ${count}`);
  }
  if (Object.keys(data.sources).length > 5) {
    console.log(`  ... and ${Object.keys(data.sources).length - 5} more sources`);
  }
}

// Print a few example samples
console.log('\n' + '='.repeat(80));
console.log('SAMPLE PREVIEW (first 3 of each level)');
console.log('='.repeat(80));

const byLevel = {};
for (const sample of samples) {
  if (!byLevel[sample.level]) byLevel[sample.level] = [];
  if (byLevel[sample.level].length < 3) {
    byLevel[sample.level].push(sample);
  }
}

for (const [level, levelSamples] of Object.entries(byLevel)) {
  console.log(`\n--- ${level} ---`);
  for (const s of levelSamples) {
    console.log(`Title: ${s.title}`);
    console.log(`Expected: ${JSON.stringify(s.expected, null, 2)}`);
    console.log('');
  }
}
