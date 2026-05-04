package com.dlp.platform.service.document;

import com.dlp.platform.dto.document.RuleDetectionResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service for detecting PII (Personally Identifiable Information)
 * using regex patterns and keyword matching
 *
 * Features:
 * - SSN (Social Security Number) detection
 * - Credit card number detection
 * - Credit card metadata detection (expiry/CVV) when explicitly labeled
 * - Email address detection
 * - Phone number detection (multiple formats)
 * - ID number detection (HKID, etc.)
 * - Bank account number detection
 * - Address detection (heuristic / labeled lines)
 * - Finance / document-type keyword detection (for tagging)
 * - High-risk classification for critical PII types
 */
@Service
@Slf4j
public class PIIDetectionService {

    // ===== PII Detection Patterns =====

    /**
     * US Social Security Number (SSN)
     * Formats: 123-45-6789, 123 45 6789, 123456789
     */
    private static final Pattern SSN_PATTERN = Pattern.compile(
        "\\b(?!000|666|9\\d{2})\\d{3}[-\\s]?(?!00)\\d{2}[-\\s]?(?!0000)\\d{4}\\b"
    );

    /**
     * Credit card candidate pattern (broad) - validated with Luhn to reduce false positives.
     * Supports spaces and dashes.
     */
    private static final Pattern CREDIT_CARD_CANDIDATE_PATTERN = Pattern.compile(
        "\\b(?:\\d[\\s\\-]*?){13,19}\\b"
    );

    /**
     * Credit card expiry date (ONLY when explicitly labeled).
     * Examples: "EXP: 12/27", "Expiry 12-2027", "Expiration Date 12/27".
     */
    private static final Pattern CARD_EXPIRY_LABELED_PATTERN = Pattern.compile(
        "\\b(?:exp(?:iry|iration)?(?:\\s*date)?|valid\\s*thru)\\s*[:#\\-]?\\s*(0?[1-9]|1[0-2])\\s*[-/]\\s*(\\d{2}|\\d{4})\\b",
        Pattern.CASE_INSENSITIVE
    );

    /**
     * CVV/CVC (ONLY when explicitly labeled).
     * Examples: "CVV: 123", "CVC 999", "Security Code: 123".
     */
    private static final Pattern CARD_CVV_LABELED_PATTERN = Pattern.compile(
        "\\b(?:cvv|cvc|security\\s*code)\\s*[:#\\-]?\\s*\\d{3,4}\\b",
        Pattern.CASE_INSENSITIVE
    );

    /**
     * Email addresses
     */
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b"
    );

    /**
     * Phone numbers (US, international)
     * Formats: (123) 456-7890, 123-456-7890, +1 123 456 7890, etc.
     */
    private static final Pattern PHONE_PATTERN = Pattern.compile(
        "\\b(?:\\+?1[-\\s]?)?\\(?\\d{3}\\)?[-\\s]?\\d{3}[-\\s]?\\d{4}\\b|" +  // US format
        "\\b\\+?\\d{1,3}[-\\s]?\\(?\\d{2,4}\\)?[-\\s]?\\d{3,4}[-\\s]?\\d{4}\\b"  // International
    );

    /**
     * Bank Account Number
     * Typically 8-17 digits
     */
    private static final Pattern BANK_ACCOUNT_PATTERN = Pattern.compile(
        "\\b(?:Account|Acct|A/C|Acc(?:ount)?\\s*(?:No|Number)|Bank\\s*Account)[-:#\\s]*" +
            "(?:\\d{6,20}|\\d{3}[-\\s]?\\d{3}[-\\s]?\\d{6,9})\\b",
        Pattern.CASE_INSENSITIVE
    );

    /**
     * IBAN (international bank account number) - often appears with the "IBAN" label.
     */
    private static final Pattern IBAN_PATTERN = Pattern.compile(
        "\\bIBAN[-:#\\s]*[A-Z]{2}\\d{2}[A-Z0-9]{11,30}\\b",
        Pattern.CASE_INSENSITIVE
    );

    /**
     * SWIFT/BIC code - often appears with the "SWIFT" or "BIC" label.
     * Example: HSBCHKHHXXX
     */
    private static final Pattern SWIFT_BIC_PATTERN = Pattern.compile(
        "\\b(?:SWIFT|BIC)[-:#\\s]*[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\\b",
        Pattern.CASE_INSENSITIVE
    );

    /**
     * IP Address (IPv4)
     */
    private static final Pattern IP_ADDRESS_PATTERN = Pattern.compile(
        "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b"
    );

    /**
     * Date of Birth patterns
     * Formats: MM/DD/YYYY, DD-MM-YYYY, YYYY/MM/DD
     */
    private static final Pattern DOB_PATTERN = Pattern.compile(
        "\\b(?:DOB|Date of Birth|Birth Date)[-:#\\s]*" +
        "(?:\\d{1,2}[-/]\\d{1,2}[-/]\\d{2,4}|\\d{2,4}[-/]\\d{1,2}[-/]\\d{1,2})\\b",
        Pattern.CASE_INSENSITIVE
    );

    /**
     * Hong Kong ID Card (HKID)
     * Typical format:
     * - Prefix: 1 or 2 letters (e.g., A, AB)
     * - Digits: 6 numerals
     * - Check digit: (0-9) or (A)
     *
     * Examples: A123456(7), AB123456(A)
     */
    private static final Pattern HKID_PATTERN = Pattern.compile(
        "\\b[A-Z]{1,2}\\d{6}\\s*\\([\\dA]\\)\\b",
        Pattern.CASE_INSENSITIVE
    );

    /**
     * Address line detection (ONLY when explicitly labeled).
     * Captures lines like:
     * - "Address: 1/F, Block A, ... "
     * - "Billing Address - ..."
     */
    private static final Pattern ADDRESS_LABELED_LINE_PATTERN = Pattern.compile(
        "(?im)^(?:billing\\s+address|shipping\\s+address|delivery\\s+address|residential\\s+address|mailing\\s+address|address)\\s*[:\\-]\\s*.+$"
    );

    // Heuristic address keywords (weak signal, used only for detection/tagging; not high-risk by itself)
    private static final Set<String> ADDRESS_KEYWORDS = Set.of(
        "address", "addr", "street", "st", "road", "rd", "avenue", "ave",
        "building", "bldg", "block", "blk", "floor", "fl", "flat", "unit", "room", "rm",
        "district", "postcode", "postal", "zip", "po box",
        "hong kong", "kowloon", "new territories"
    );

    // ===== Sensitive Keywords =====

    private static final Set<String> FINANCE_KEYWORDS = Set.of(
        // financial reports / accounting
        "balance sheet", "profit and loss", "p&l", "income statement", "cash flow", "cashflow",
        "forecast", "budget", "financial statement", "general ledger", "trial balance",
        // payments / banking
        "bank statement", "account payable", "accounts payable", "account receivable", "accounts receivable",
        "payment", "transfer", "remittance", "swift", "iban",
        // payroll / tax
        "salary", "income", "wage", "compensation", "bonus", "payroll", "mpf", "tax", "tax return",
        // common finance data
        "invoice", "billing", "purchase order", "po number", "credit score", "investment", "portfolio"
    );

    private static final Set<String> INVOICE_KEYWORDS = Set.of(
        "invoice", "tax invoice", "bill to", "ship to", "vat", "gst", "subtotal", "total due", "due date"
    );

    private static final Set<String> HR_KEYWORDS = Set.of(
        "onboarding", "employee", "staff", "emergency contact", "employment", "offer letter",
        "salary", "payroll", "mpf", "id card", "passport"
    );

    private static final Set<String> PAYROLL_KEYWORDS = Set.of(
        "payroll", "salary register", "pay slip", "payslip", "wage", "overtime",
        "bonus", "commission", "mpf", "tax", "withholding", "allowance"
    );

    private static final Set<String> CUSTOMER_DATA_KEYWORDS = Set.of(
        "customer list", "client list", "crm export", "contact list", "lead list",
        "customer id", "client id", "account id", "customer profile",
        "email", "phone", "address", "contact"
    );

    private static final Set<String> CONTRACT_KEYWORDS = Set.of(
        "nda", "non-disclosure", "confidentiality agreement",
        "agreement", "contract", "terms and conditions",
        "effective date", "governing law", "party", "counterparty",
        "liability", "indemnity", "termination", "signature"
    );

    private static final Set<String> CONFIDENTIAL_KEYWORDS = Set.of(
        "confidential", "secret", "proprietary", "trade secret", "classified",
        "restricted", "internal only", "do not distribute", "attorney-client privilege"
    );

    private static final Set<String> PERSONAL_KEYWORDS = Set.of(
        "social security", "ssn", "passport", "driver license", "birth certificate",
        "citizenship", "immigration", "visa", "national id"
    );

    /**
     * Detect PII (and finance-related markers for tagging) in text content
     *
     * @param text Text content to analyze
     * @return Detection results with counts and risk levels
     */
    public RuleDetectionResult detectPII(String text) {
        if (text == null || text.isEmpty()) {
            log.debug("Empty text provided for PII detection");
            return RuleDetectionResult.builder().build();
        }

        log.info("Starting PII detection on {} characters of text", text.length());

        List<RuleDetectionResult.Detection> detections = new ArrayList<>();

        // Detect SSN
        int ssnCount = countMatches(SSN_PATTERN, text);
        if (ssnCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("SSN")
                .count(ssnCount)
                .highRisk(true)  // SSN is always high risk
                .build());
            log.warn("Detected {} SSN(s) in document", ssnCount);
        }

        // Detect Credit Cards (validate with Luhn algorithm to reduce false positives)
        int creditCardCount = countValidCreditCards(text);
        if (creditCardCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("CREDIT_CARD")
                .count(creditCardCount)
                .highRisk(true)  // Credit card is high risk
                .build());
            log.warn("Detected {} credit card(s) in document", creditCardCount);
        }

        // Detect credit card expiry (labeled)
        int expiryCount = countMatches(CARD_EXPIRY_LABELED_PATTERN, text);
        if (expiryCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("CREDIT_CARD_EXPIRY")
                .count(expiryCount)
                .highRisk(false) // expiry alone is sensitive, but not enough to force STRICTLY_CONFIDENTIAL
                .build());
            log.debug("Detected {} credit card expiry field(s)", expiryCount);
        }

        // Detect CVV/CVC (labeled)
        int cvvCount = countMatches(CARD_CVV_LABELED_PATTERN, text);
        if (cvvCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("CREDIT_CARD_CVV")
                .count(cvvCount)
                .highRisk(true) // CVV is high risk by itself
                .build());
            log.warn("Detected {} CVV/CVC field(s)", cvvCount);
        }

        // Detect Emails
        int emailCount = countMatches(EMAIL_PATTERN, text);
        if (emailCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("EMAIL")
                .count(emailCount)
                .highRisk(false)  // Email is medium risk
                .build());
            log.debug("Detected {} email address(es)", emailCount);
        }

        // Detect Phone Numbers
        int phoneCount = countMatches(PHONE_PATTERN, text);
        if (phoneCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("PHONE")
                .count(phoneCount)
                .highRisk(false)  // Phone is medium risk
                .build());
            log.debug("Detected {} phone number(s)", phoneCount);
        }

        // Detect Bank Accounts
        int bankAcctCount = countMatches(BANK_ACCOUNT_PATTERN, text);
        if (bankAcctCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("BANK_ACCOUNT")
                .count(bankAcctCount)
                .highRisk(true)
                .build());
            log.warn("Detected {} bank account number(s)", bankAcctCount);
        }

        // Detect IBAN (finance marker)
        int ibanCount = countMatches(IBAN_PATTERN, text);
        if (ibanCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("IBAN")
                .count(ibanCount)
                .highRisk(false)
                .build());
            log.debug("Detected {} IBAN reference(s)", ibanCount);
        }

        // Detect SWIFT/BIC (finance marker)
        int swiftCount = countMatches(SWIFT_BIC_PATTERN, text);
        if (swiftCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("SWIFT_BIC")
                .count(swiftCount)
                .highRisk(false)
                .build());
            log.debug("Detected {} SWIFT/BIC reference(s)", swiftCount);
        }

        // Detect IP Addresses
        int ipCount = countMatches(IP_ADDRESS_PATTERN, text);
        if (ipCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("IP_ADDRESS")
                .count(ipCount)
                .highRisk(false)
                .build());
            log.debug("Detected {} IP address(es)", ipCount);
        }

        // Detect Date of Birth
        int dobCount = countMatches(DOB_PATTERN, text);
        if (dobCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("DATE_OF_BIRTH")
                .count(dobCount)
                .highRisk(true)
                .build());
            log.warn("Detected {} date of birth reference(s)", dobCount);
        }

        // Detect Hong Kong ID
        int hkidCount = countMatches(HKID_PATTERN, text);
        if (hkidCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("HKID")
                .count(hkidCount)
                .highRisk(true)
                .build());
            log.warn("Detected {} Hong Kong ID(s)", hkidCount);
        }

        // Detect address (labeled lines first)
        int labeledAddressCount = countMatches(ADDRESS_LABELED_LINE_PATTERN, text);
        int keywordAddressCount = 0;
        if (labeledAddressCount == 0) {
            // fallback heuristic: require at least one address keyword AND at least one digit (house/flat/building numbers)
            String lowerText = text.toLowerCase();
            boolean hasKeyword = ADDRESS_KEYWORDS.stream().anyMatch(lowerText::contains);
            boolean hasDigit = lowerText.matches(".*\\d.*");
            if (hasKeyword && hasDigit) {
                keywordAddressCount = 1; // binary signal (present/absent)
            }
        }
        int addressCount = labeledAddressCount + keywordAddressCount;
        if (addressCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("ADDRESS")
                .count(addressCount)
                .highRisk(false) // address is PII but we keep it medium-risk to avoid over-classification
                .build());
            log.debug("Detected {} address signal(s) (labeledLines={}, heuristic={})",
                addressCount, labeledAddressCount, keywordAddressCount);
        }

        // Detect Sensitive Keywords
        detectKeywords(text, detections);

        RuleDetectionResult result = RuleDetectionResult.builder()
            .detections(detections)
            .build();

        log.info("PII detection completed: {} detection types found, high-risk: {}",
            detections.size(), result.hasHighRiskDetections());

        return result;
    }

    /**
     * Count pattern matches in text
     */
    private int countMatches(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        return count;
    }

    /**
     * Validate credit card numbers using Luhn algorithm
     */
    private int countValidCreditCards(String text) {
        Matcher matcher = CREDIT_CARD_CANDIDATE_PATTERN.matcher(text);
        int validCount = 0;

        while (matcher.find()) {
            String cardNumber = matcher.group().replaceAll("\\D", ""); // Remove non-digits
            // common card lengths
            if (cardNumber.length() >= 13 && cardNumber.length() <= 19 && isValidLuhn(cardNumber)) {
                validCount++;
            }
        }

        return validCount;
    }

    /**
     * Luhn algorithm for credit card validation
     */
    private boolean isValidLuhn(String cardNumber) {
        int sum = 0;
        boolean alternate = false;

        for (int i = cardNumber.length() - 1; i >= 0; i--) {
            int digit = Character.getNumericValue(cardNumber.charAt(i));

            if (alternate) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }

            sum += digit;
            alternate = !alternate;
        }

        return (sum % 10 == 0);
    }

    /**
     * Detect sensitive keywords
     */
    private void detectKeywords(String text, List<RuleDetectionResult.Detection> detections) {
        String lowerText = text.toLowerCase();

        // Finance keywords (for tagging; not necessarily PII by itself)
        int financeCount = countKeywords(lowerText, FINANCE_KEYWORDS);
        if (financeCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("FINANCE_KEYWORDS")
                .count(financeCount)
                .highRisk(false)
                .build());
            log.debug("Detected {} finance keyword(s)", financeCount);
        }

        // Invoice keywords
        int invoiceCount = countKeywords(lowerText, INVOICE_KEYWORDS);
        if (invoiceCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("INVOICE_KEYWORDS")
                .count(invoiceCount)
                .highRisk(false)
                .build());
            log.debug("Detected {} invoice keyword(s)", invoiceCount);
        }

        // HR keywords
        int hrCount = countKeywords(lowerText, HR_KEYWORDS);
        if (hrCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("HR_KEYWORDS")
                .count(hrCount)
                .highRisk(false)
                .build());
            log.debug("Detected {} HR keyword(s)", hrCount);
        }

        // Payroll keywords
        int payrollCount = countKeywords(lowerText, PAYROLL_KEYWORDS);
        if (payrollCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("PAYROLL_KEYWORDS")
                .count(payrollCount)
                .highRisk(false)
                .build());
            log.debug("Detected {} payroll keyword(s)", payrollCount);
        }

        // Customer data keywords
        int customerCount = countKeywords(lowerText, CUSTOMER_DATA_KEYWORDS);
        if (customerCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("CUSTOMER_DATA_KEYWORDS")
                .count(customerCount)
                .highRisk(false)
                .build());
            log.debug("Detected {} customer-data keyword(s)", customerCount);
        }

        // Contract / NDA keywords
        int contractCount = countKeywords(lowerText, CONTRACT_KEYWORDS);
        if (contractCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("CONTRACT_KEYWORDS")
                .count(contractCount)
                .highRisk(false)
                .build());
            log.debug("Detected {} contract keyword(s)", contractCount);
        }

        // Confidential keywords
        int confidentialCount = countKeywords(lowerText, CONFIDENTIAL_KEYWORDS);
        if (confidentialCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("CONFIDENTIAL_KEYWORDS")
                .count(confidentialCount)
                .highRisk(false)  // Classification markers, not PII itself
                .build());
            log.debug("Detected {} confidential keyword(s)", confidentialCount);
        }

        // Personal keywords
        // Keywords alone are a weak signal. Treat as medium risk to avoid forcing STRICTLY_CONFIDENTIAL
        // on documents that merely mention "passport/visa" without actual identifiers.
        int personalCount = countKeywords(lowerText, PERSONAL_KEYWORDS);
        if (personalCount > 0) {
            detections.add(RuleDetectionResult.Detection.builder()
                .type("PERSONAL_KEYWORDS")
                .count(personalCount)
                .highRisk(false)
                .build());
            log.debug("Detected {} personal keyword(s)", personalCount);
        }
    }

    /**
     * Count keyword occurrences
     */
    private int countKeywords(String text, Set<String> keywords) {
        int count = 0;
        for (String keyword : keywords) {
            int index = 0;
            while ((index = text.indexOf(keyword, index)) != -1) {
                count++;
                index += keyword.length();
            }
        }
        return count;
    }

    /**
     * Get detection summary for logging/reporting
     */
    public String getDetectionSummary(RuleDetectionResult result) {
        if (result == null || !result.hasDetections()) {
            return "No PII detected";
        }

        StringBuilder summary = new StringBuilder("Detected: ");
        List<String> items = new ArrayList<>();

        for (RuleDetectionResult.Detection detection : result.getDetections()) {
            items.add(String.format("%s(%d%s)",
                detection.getType(),
                detection.getCount(),
                detection.isHighRisk() ? "!" : ""));
        }

        summary.append(String.join(", ", items));

        if (result.hasHighRiskDetections()) {
            summary.append(" [HIGH RISK]");
        }

        return summary.toString();
    }
}
