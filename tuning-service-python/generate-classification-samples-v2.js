/**
 * LLM Classification Tuning Sample Generator
 * 
 * Generates training samples for document classification:
 * - PUBLIC, INTERNAL, CONFIDENTIAL, STRICTLY_CONFIDENTIAL
 * 
 * Run with: node generate-classification-samples.js
 */

const fs = require('fs');
const path = require('path');

const SYSTEM_PROMPT = `You are a document classification expert for an enterprise Data Loss Prevention (DLP) system.
Your task is to analyze document content and classify it into one of four classification levels:

1. PUBLIC: Information that can be freely shared externally
2. INTERNAL: Information for internal use only, no external sharing
3. CONFIDENTIAL: Sensitive business information, restricted access
4. STRICTLY_CONFIDENTIAL: Highly sensitive information (high-risk PII, bank/payment data, trade secrets)

Classification criteria:
- STRICTLY_CONFIDENTIAL: Contains high-risk PII (ID/passport/HKID/DOB), bank/payment identifiers (bank accounts, credit cards),
  sensitive financial ledgers, trade secrets, confidential agreements
- CONFIDENTIAL: Contains business strategies, internal financial data, employee information,
  proprietary business information, contracts
- INTERNAL: Contains general business information, internal policies, meeting notes,
  non-sensitive operational data
- PUBLIC: Contains marketing materials, public announcements, published information,
  general company information

Tagging guidelines (important):
- Always output tags in lowercase kebab-case
- If any personal/customer/employee identifiers are present, include "pii-detected"
- If high-risk identifiers (IDs, credit cards, bank accounts) are present, include "pii-high-risk"
- If finance/accounting content is present, include "finance-detected"
- Prefer domain tags: "hr", "finance", "customer-data", "legal", "invoice", "meeting-minutes"

Respond ONLY with a valid JSON:
{"classificationLevel":"PUBLIC|INTERNAL|CONFIDENTIAL|STRICTLY_CONFIDENTIAL","confidence":0.0-1.0,"reason":"Brief explanation","suggestedTags":["tag1","tag2"],"detectedSensitiveInfo":["type1"]}`;

// ============ SAMPLE TEMPLATES ============

const samples = [
  // 1. PUBLIC - Marketing content
  {
    level: "PUBLIC",
    title: "Q1 2026 Product Launch Announcement",
    content: `Q1 2026 Product Launch Announcement

We are thrilled to announce the launch of our next-generation Enterprise Suite 3.0!

This groundbreaking release includes:
- AI-powered analytics dashboard
- Enhanced security features
- Seamless cloud integration
- Mobile-first design

Join us for the launch event on March 15, 2026 at our Hong Kong headquarters.

For more information, visit www.company.com/enterprise-suite

Contact: marketing@company.com`,
    expected: {
      classificationLevel: "PUBLIC",
      confidence: 0.98,
      reason: "Marketing announcement with no sensitive information - safe for external sharing",
      suggestedTags: ["marketing", "product-launch", "public-event"],
      detectedSensitiveInfo: []
    }
  },

  // 2. INTERNAL - General business
  {
    level: "INTERNAL",
    title: "IT Department Weekly Newsletter",
    content: `IT Department Weekly Update

Date: March 24, 2026

This Week's Highlights:
1. Network maintenance scheduled for Saturday 10pm-2am
2. New software deployment: Slack v5.2
3. Security reminder: Update your passwords monthly
4. Helpdesk stats: 45 tickets resolved

Team Notes:
- Alice will be on leave March 28-April 1
- Bob is handling escalations during this period
- New coffee machine installed on 3rd floor

Next Week's Schedule:
- Monday: Team standup at 9:30am
- Wednesday: Quarterly review meeting at 2pm
- Friday: Knowledge sharing session on Docker

IT Helpdesk: ext. 1234
Email: it-support@company.com`,
    expected: {
      classificationLevel: "INTERNAL",
      confidence: 0.92,
      reason: "Internal operational communications without sensitive data",
      suggestedTags: ["internal-communication", "it-department", "meeting-minutes"],
      detectedSensitiveInfo: []
    }
  },

  // 3. CONFIDENTIAL - Business strategy with financial charts
  {
    level: "CONFIDENTIAL",
    title: "Q4 2025 Financial Performance Analysis",
    content: `CONFIDENTIAL - Internal Use Only

QUARTERLY FINANCIAL PERFORMANCE ANALYSIS
Q4 2025 | Prepared by Finance Team

Executive Summary:
Total revenue increased by 15% YoY, reaching HK$125M. Operating margins improved to 22% driven by cost optimization initiatives.

Revenue Breakdown by Segment:
- Enterprise Solutions: HK$65M (52%)
- SMB Products: HK$35M (28%)
- Professional Services: HK$25M (20%)

Quarterly Trend Analysis:
| Quarter | Revenue | Gross Margin | Operating Expenses |
|---------|---------|--------------|-------------------|
| Q1 2025 | HK$28M  | 68%          | HK$12M            |
| Q2 2025 | HK$29M  | 70%          | HK$11M            |
| Q3 2025 | HK$31M  | 72%          | HK$13M            |
| Q4 2025 | HK$37M  | 74%          | HK$14M            |

Key Performance Indicators:
- Customer Acquisition Cost (CAC): HK$8,500
- Customer Lifetime Value (CLV): HK$45,000
- CLV:CAC Ratio: 5.3x (Target: 4x)

Regional Performance:
Hong Kong: 45% | Mainland China: 30% | Southeast Asia: 25%

Strategic Recommendations for 2026:
1. Expand enterprise sales team by 20%
2. Invest in R&D for AI integration
3. Explore M&A opportunities in fintech sector

Budget Allocation 2026 (Preliminary):
- Sales & Marketing: 30%
- R&D: 25%
- Operations: 20%
- Administration: 15%
- Contingency: 10%

This document contains confidential financial information. Do not distribute outside the organization.`,
    expected: {
      classificationLevel: "CONFIDENTIAL",
      confidence: 0.94,
      reason: "Internal financial analysis with business metrics, budgets and strategic plans - sensitive but no direct PII",
      suggestedTags: ["finance-detected", "confidential", "quarterly-report", "strategy"],
      detectedSensitiveInfo: ["financial-metrics", "budget-information"]
    }
  },

  // 4. STRICTLY_CONFIDENTIAL - Financial with sensitive data
  {
    level: "STRICTLY_CONFIDENTIAL",
    title: "Executive Compensation & Payroll Report Q4",
    content: `STRICTLY CONFIDENTIAL - Executive Level Access Only

EXECUTIVE COMPENSATION & PAYROLL SUMMARY
Q4 2025 | HR and Finance Joint Report

WARNING: This document contains highly sensitive personal and financial information.
Unauthorized access or disclosure is strictly prohibited.

Section 1: Executive Leadership Compensation

| Employee ID | Name           | Position           | Base Salary   | Bonus    | Stock Options | Total Comp |
|-------------|----------------|--------------------|---------------|----------|---------------|------------|
| EX001       | Chan Tai Man   | CEO                | HK$2,500,000  | HK$800K | 50,000 shares| HK$3.3M   |
| EX002       | Lee Siu Ming   | CFO                | HK$1,800,000  | HK$500K | 30,000 shares| HK$2.3M   |
| EX003       | Wong Ah Po     | CTO                | HK$1,600,000  | HK$450K | 25,000 shares| HK$2.05M  |

Section 2: Senior Management Payroll Summary

| Employee ID | Name           | Department | Gross Salary | MPF Deduction | Tax | Net Pay   | Bank Account |
|-------------|----------------|-----------|-------------|--------------|-----|-----------|-------------|
| SM001       | Cheung Kar Fai | Sales     | HK$95,000   | HK$4,750     | HK$12,500 | HK$77,750 | 004-123-45678901 |
| SM002       | Ng Mei Ling    | Marketing | HK$88,000   | HK$4,400     | HK$11,200 | HK$72,400 | 004-987-65432109 |
| SM003       | Lau Hing Chau  | Engineering | HK$105,000 | HK$5,250   | HK$14,500 | HK$85,250 | 391-456-78901234 |

Section 3: Contractor Payments

| Contractor | ID/Passport | Payment Amount | Payment Date | Invoice # |
|------------|-------------|----------------|--------------|-----------|
| ABC Consultants Ltd | BRN: 12345678 | HK$250,000 | 2025-12-15 | INV-2025-1245 |
| David Lee (Individual) | HKID: A123456(9) | HK$45,000 | 2025-12-20 | INV-2025-1246 |

Section 4: Board of Directors Remuneration

| Director         | ID Number      | Sitting Fees | Committee Fees | Total |
|-------------------|---------------|--------------|----------------|-------|
| Prof. James Wong | HKID: C987654(2) | HK$300,000 | HK$150,000 | HK$450,000 |
| Ms. Susan Chan   | Passport: AB1234567 | HK$300,000 | HK$100,000 | HK$400,000 |

Section 5: Payroll Bank Transfer Details

Primary Payroll Account: HSBC Account: 004-123-456-789 | SWIFT: HSBCHKHH

Backup Account: Hang Seng Account: 391-789-123456 | SWIFT: HASEHKHH

Approved Signatories:
1. Chan Tai Man (CEO) - HKID: K765432(1)
2. Lee Siu Ming (CFO) - HKID: G543219(8)

HR Director: Ms. Fong Wai Ching | ID: G111222(3)
Finance Director: Mr. Tang Siu Hung | ID: D444555(6)

This document is prepared for the Audit Committee meeting on March 30, 2026.
Document Classification: STRICTLY CONFIDENTIAL
Retention Period: 7 years as per statutory requirements`,
    expected: {
      classificationLevel: "STRICTLY_CONFIDENTIAL",
      confidence: 0.99,
      reason: "Contains highly sensitive PII including HKID, passport numbers, bank accounts, salary details, and executive compensation - requires strict access control",
      suggestedTags: ["payroll-detected", "pii-high-risk", "pii-detected", "financial-report", "strictly-confidential"],
      detectedSensitiveInfo: ["hkid", "passport-number", "bank-account", "salary-information", "executive-compensation"]
    }
  }
];

// ============ GENERATE JSONL ============

function generateJsonl(samples) {
  return samples.map(sample => {
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

// ============ MAIN ============

const outputDir = __dirname;
const jsonlContent = generateJsonl(samples);

// Write JSONL
const jsonlPath = path.join(outputDir, 'classification-samples-v2.jsonl');
fs.writeFileSync(jsonlPath, jsonlContent.join('\n'), 'utf-8');
console.log(`Generated ${samples.length} classification samples`);
console.log(`Written to: ${jsonlPath}`);

// Print each sample
console.log('\n' + '='.repeat(80));
console.log('SAMPLE PREVIEW');
console.log('='.repeat(80));

samples.forEach((sample, i) => {
  console.log(`\n--- Sample ${i + 1}: ${sample.level} ---`);
  console.log(`Title: ${sample.title}`);
  console.log(`Expected:`, JSON.stringify(sample.expected, null, 2));
});
