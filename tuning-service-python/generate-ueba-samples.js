/**
 * UEBA Tuning Sample Generator - Compact Version
 *
 * Generates 200 synthetic UEBA training examples in Vertex AI JSONL format.
 * Each category has 10-20 samples for balanced training.
 *
 * Run with: node generate-ueba-samples.js
 */

const fs = require('fs');
const path = require('path');

const SYSTEM_PROMPT = `You are a security analyst specializing in User and Entity Behavior Analytics (UEBA).

Your task is to analyze security events and determine if they represent TRUE ANOMALIES or just NORMAL BEHAVIORS.

## STRICT SECURITY RULES - THESE ARE ALWAYS SUSPICIOUS (HIGH or CRITICAL severity):

1. **SCREENSHOT/SCREEN_RECORDING actions (regardless of result)** → ALWAYS SUSPICIOUS:
   - "SCREENSHOT_ATTEMPT", "SCREENSHOT_PRESSED", "SCREENSHOT_WIN_SHARP_S" → HIGH severity, ALERT_ADMIN
   - "SCREEN_CAPTURE_SHORTCUT", "SCREENSHOT_TOOL_DETECTED" → HIGH severity, ALERT_ADMIN
   - "SCREEN_RECORDING_TOOL_DETECTED", "OBS", "BANDICAM", "LOOM", "CAMTASIA" → CRITICAL severity, DISABLE_ACCOUNT
   - "CLIPBOARD_IMAGE_DETECTED" while viewing documents → HIGH severity, ALERT_ADMIN
   - "RAPID_WINDOW_SWITCHING" (potential automated capture) → HIGH severity, ALERT_ADMIN
   - NOTE: Even if the screenshot was BLOCKED by DRM, the user's ATTEMPT to capture is suspicious!

2. **USB Security Violations** → CRITICAL (DISABLE_ACCOUNT):
   - "USB_BADUSB_DETECTED", "USB_KEYSTROKE_INJECTION", "USB_HID_ATTACK" → CRITICAL
   - "USB_UNKNOWN_DEVICE", "USB_AUTORUN_EXECUTED", "USB_MASS_STORAGE" → CRITICAL

3. **Malware/Virus Detection** → CRITICAL (DISABLE_ACCOUNT):
   - "MALWARE_DETECTED", "VIRUS_DETECTED", "RANSOMWARE_INDICATOR" → CRITICAL

4. **Malicious IP** → CRITICAL (RESTRICT):
   - "MALICIOUS_IP", "C2_IP_DETECTED", "TOR_EXIT_NODE_ACCESS" → CRITICAL

## FALSE POSITIVES (BENIGN - NORMAL behavior):
- Screen/window FOCUS, alt-tab, APP_SWITCH, WINDOW_BLUR → BENIGN (normal multitasking)
- WINDOW_FOCUS_LOST without screenshot attempt → BENIGN
- Brief disconnections, VPN reconnections → BENIGN
- First login failure then success → BENIGN (typo correction)
- Normal file access during work hours → BENIGN
- Auto-save, single file downloads → BENIGN
- MFA_SUCCESS, PASSWORD_CHANGE → BENIGN

## Response Format:
Respond ONLY with a valid JSON:
{"isAnomalous":true/false,"confidence":0.0-1.0,"anomalyType":"NONE|CREDENTIAL_ATTACK|DATA_EXFILTRATION|PRIVILEGE_ESCALATION|OFF_HOURS|UNAUTHORIZED_ACCESS|BEHAVIORAL_DEVIATION|SCREEN_RECORDING|ENDPOINT_TAMPERING","reason":"...","recommendedAction":"NONE|WARNING|RESTRICT|ALERT_ADMIN|DISABLE_ACCOUNT","severity":"LOW|MEDIUM|HIGH|CRITICAL"}`;

// ============ SAMPLE TEMPLATES ============

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const USERS = [
  "john.doe@company.com", "jane.smith@company.com", "bob.wilson@company.com",
  "alice.chen@company.com", "david.lee@company.com"
];

// 1. BENIGN: Normal activities (40 samples)
function generateBenignSamples() {
  const samples = [];
  const templates = [
    // Window management (15)
    { action: "WINDOW_FOCUS", category: "NORMAL", result: "SUCCESS", details: "User switched to email client", hour: 10 },
    { action: "WINDOW_FOCUS", category: "NORMAL", result: "SUCCESS", details: "User switched to document editor", hour: 14 },
    { action: "WINDOW_BLUR", category: "NORMAL", result: "SUCCESS", details: "User clicked outside current window", hour: 11 },
    { action: "ALT_TAB", category: "NORMAL", result: "SUCCESS", details: "Quick task switch to calculator", hour: 15 },
    { action: "APP_SWITCH", category: "NORMAL", result: "SUCCESS", details: "Switched from browser to chat", hour: 10 },
    { action: "SCREEN_SWITCH", category: "NORMAL", result: "SUCCESS", details: "Moved to second monitor", hour: 9 },
    { action: "MINIMIZE_WINDOW", category: "NORMAL", result: "SUCCESS", details: "Minimized browser tab", hour: 16 },
    { action: "MAXIMIZE_WINDOW", category: "NORMAL", result: "SUCCESS", details: "Expanded document to full screen", hour: 11 },
    { action: "CLOSE_WINDOW", category: "NORMAL", result: "SUCCESS", details: "Closed finished document", hour: 17 },
    { action: "RESTORE_WINDOW", category: "NORMAL", result: "SUCCESS", details: "Restored minimized chat window", hour: 10 },
    { action: "FOCUS_CHANGE", category: "NORMAL", result: "SUCCESS", details: "Browser to IDE focus change", hour: 14 },
    { action: "WINDOW_FOCUS", category: "NORMAL", result: "SUCCESS", details: "Email client activated", hour: 9 },
    { action: "WINDOW_BLUR", category: "NORMAL", result: "SUCCESS", details: "Lost focus after click outside", hour: 13 },
    { action: "ALT_TAB", category: "NORMAL", result: "SUCCESS", details: "Alt+tab to check notification", hour: 15 },
    { action: "APP_SWITCH", category: "NORMAL", result: "SUCCESS", details: "Switched to calendar app", hour: 10 },
    
    // Normal authentication (10)
    { action: "LOGIN_SUCCESS", category: "AUTH", result: "SUCCESS", details: "Normal login from office", hour: 9 },
    { action: "LOGIN_SUCCESS", category: "AUTH", result: "SUCCESS", details: "Normal login from office", hour: 13 },
    { action: "MFA_SUCCESS", category: "AUTH", result: "SUCCESS", details: "MFA approved via app", hour: 9 },
    { action: "PASSWORD_CHANGE", category: "AUTH", result: "SUCCESS", details: "Password changed successfully", hour: 10 },
    { action: "SESSION_RENEWED", category: "AUTH", result: "SUCCESS", details: "Session extended normally", hour: 14 },
    { action: "LOGIN_SUCCESS", category: "AUTH", result: "SUCCESS", details: "VPN connected from office", hour: 9 },
    { action: "LOGOUT", category: "AUTH", result: "SUCCESS", details: "Normal logout at end of day", hour: 18 },
    { action: "LOGIN_SUCCESS", category: "AUTH", result: "SUCCESS", details: "New device first login", hour: 10 },
    { action: "TOKEN_REFRESH", category: "AUTH", result: "SUCCESS", details: "Token refreshed successfully", hour: 15 },
    { action: "LOGIN_SUCCESS", category: "AUTH", result: "SUCCESS", details: "Normal login from office", hour: 11 },
    
    // Normal file operations (10)
    { action: "FILE_OPEN", category: "DOCUMENT", result: "SUCCESS", details: "Opened internal policy document", hour: 10 },
    { action: "FILE_SAVE", category: "DOCUMENT", result: "SUCCESS", details: "Document auto-saved", hour: 14 },
    { action: "FILE_DOWNLOAD", category: "DOCUMENT", result: "SUCCESS", details: "Downloaded approved template", hour: 11 },
    { action: "PRINT_REQUEST", category: "DOCUMENT", result: "SUCCESS", details: "Printed meeting notes", hour: 15 },
    { action: "FILE_OPEN", category: "DOCUMENT", result: "SUCCESS", details: "Opened shared report", hour: 10 },
    { action: "FILE_EDIT", category: "DOCUMENT", result: "SUCCESS", details: "Edited own document", hour: 13 },
    { action: "FILE_UPLOAD", category: "DOCUMENT", result: "SUCCESS", details: "Uploaded to team folder", hour: 14 },
    { action: "FILE_SHARE", category: "DOCUMENT", result: "SUCCESS", details: "Shared with team member", hour: 11 },
    { action: "FILE_VIEW", category: "DOCUMENT", result: "SUCCESS", details: "Viewed announcement", hour: 9 },
    { action: "FILE_SAVE", category: "DOCUMENT", result: "SUCCESS", details: "Saved meeting minutes", hour: 16 },
    
    // Brief failures (5)
    { action: "LOGIN_FAILED", category: "AUTH", result: "FAILED", details: "Wrong password, retry succeeded", hour: 9 },
    { action: "CONNECTION_TIMEOUT", category: "NETWORK", result: "TIMEOUT", details: "Brief network hiccup", hour: 14 },
    { action: "VPN_RECONNECT", category: "NETWORK", result: "SUCCESS", details: "VPN reconnected after brief drop", hour: 10 },
    { action: "SESSION_TIMEOUT", category: "AUTH", result: "TIMEOUT", details: "Idle timeout, re-login required", hour: 12 },
    { action: "FILE_LOCKED", category: "DOCUMENT", result: "BLOCKED", details: "Waited for colleague unlock", hour: 11 },
  ];

  for (const t of templates) {
    const user = USERS[Math.floor(Math.random() * USERS.length)];
    const day = DAYS[Math.floor(Math.random() * 5)]; // Weekdays only
    samples.push({
      userId: user,
      accountId: user.split('@')[0],
      action: t.action,
      category: t.category,
      result: t.result,
      details: t.details,
      hour: t.hour,
      day: day,
      isWorkingHours: t.hour >= 9 && t.hour <= 18,
      expected: {
        isAnomalous: false,
        confidence: 0.95,
        anomalyType: "NONE",
        reason: `Normal ${t.action} - ${t.details}`,
        recommendedAction: "NONE",
        severity: "LOW"
      }
    });
  }
  return samples;
}

// 2. SCREEN_RECORDING: HIGH severity (30 samples)
function generateScreenRecordingSamples() {
  const samples = [];
  const templates = [
    // Screenshot attempts (15)
    { action: "SCREENSHOT_ATTEMPT", result: "DETECTED", details: "User pressed print screen", hour: 14 },
    { action: "SCREENSHOT_WIN_SHARP_S", result: "DETECTED", details: "Win+Shift+S pressed", hour: 15 },
    { action: "SCREENSHOT_PRESSED", result: "DETECTED", details: "Print screen key detected", hour: 11 },
    { action: "CLIPBOARD_IMAGE_DETECTED", result: "DETECTED", details: "Image copied from confidential doc", hour: 14 },
    { action: "SCREENSHOT_ATTEMPT", result: "BLOCKED", details: "Screenshot blocked by DRM policy", hour: 10 },
    { action: "SCREENSHOT_ATTEMPT", result: "BLOCKED", details: "DRM prevented capture", hour: 15 },
    { action: "SCREENSHOT_TOOL_DETECTED", result: "DETECTED", details: "Snipping tool launched", hour: 14 },
    { action: "RAPID_WINDOW_SWITCHING", result: "DETECTED", details: "10 windows in 30 seconds", hour: 14 },
    { action: "SCREEN_CAPTURE_SHORTCUT", result: "DETECTED", details: "Capture shortcut triggered", hour: 11 },
    { action: "CLIPBOARD_IMAGE_DETECTED", result: "DETECTED", details: "Screenshot pasted to chat", hour: 15 },
    { action: "SCREENSHOT_ATTEMPT", result: "BLOCKED", details: "Blocked by DLP policy", hour: 14 },
    { action: "RAPID_WINDOW_SWITCHING", result: "DETECTED", details: "Automated capture pattern detected", hour: 14 },
    { action: "SCREENSHOT_PRESSED", result: "DETECTED", details: "User tried to capture chart", hour: 11 },
    { action: "CLIPBOARD_IMAGE_DETECTED", result: "DETECTED", details: "Screen region copied", hour: 15 },
    { action: "SCREENSHOT_ATTEMPT", result: "BLOCKED", details: "DRM protection triggered", hour: 10 },
    
    // Recording tools detected (10)
    { action: "OBS_DETECTED", result: "DETECTED", details: "OBS Studio recording software", hour: 14 },
    { action: "BANDICAM_DETECTED", result: "DETECTED", details: "Bandicam screen recorder", hour: 15 },
    { action: "LOOM_DETECTED", result: "DETECTED", details: "Loom recording extension", hour: 14 },
    { action: "CAMTASIA_DETECTED", result: "DETECTED", details: "Camtasia screen recorder", hour: 11 },
    { action: "SCREEN_RECORDING_TOOL", result: "DETECTED", details: "Unknown screen recorder", hour: 14 },
    { action: "OBS_DETECTED", result: "DETECTED", details: "OBS streaming software active", hour: 15 },
    { action: "LOOM_EXTENSION", result: "DETECTED", details: "Loom browser extension", hour: 11 },
    { action: "SNIPPING_TOOL", result: "DETECTED", details: "Windows snipping tool used", hour: 14 },
    { action: "GREENSHOT_DETECTED", result: "DETECTED", details: "GreenShot screenshot tool", hour: 15 },
    { action: "LIGHTSHOT_DETECTED", result: "DETECTED", details: "Lightshot screenshot tool", hour: 14 },
    
    // After hours (5)
    { action: "SCREENSHOT_ATTEMPT", result: "DETECTED", details: "Screenshot at 11pm", hour: 23 },
    { action: "OBS_DETECTED", result: "DETECTED", details: "Recording at midnight", hour: 0 },
    { action: "CLIPBOARD_IMAGE_DETECTED", result: "DETECTED", details: "Capture at 2am", hour: 2 },
    { action: "RAPID_WINDOW_SWITCHING", result: "DETECTED", details: "Capture pattern at 1am", hour: 1 },
    { action: "SCREEN_RECORDING_TOOL", result: "DETECTED", details: "Recorder at 3am", hour: 3 },
  ];

  for (const t of templates) {
    const user = USERS[Math.floor(Math.random() * USERS.length)];
    const day = DAYS[Math.floor(Math.random() * 7)];
    const isHighSeverity = t.action.includes('OBS') || t.action.includes('BANDICAM') || t.action.includes('LOOM') || t.action.includes('CAMTASIA');
    samples.push({
      userId: user,
      accountId: user.split('@')[0],
      action: t.action,
      category: "SECURITY",
      result: t.result,
      details: t.details,
      hour: t.hour,
      day: day,
      isWorkingHours: t.hour >= 9 && t.hour <= 18,
      expected: {
        isAnomalous: true,
        confidence: isHighSeverity ? 0.95 : 0.9,
        anomalyType: "SCREEN_RECORDING",
        reason: `${isHighSeverity ? 'CRITICAL' : 'HIGH'}: Screen capture detected - ${t.details}`,
        recommendedAction: isHighSeverity ? "DISABLE_ACCOUNT" : "ALERT_ADMIN",
        severity: isHighSeverity ? "CRITICAL" : "HIGH"
      }
    });
  }
  return samples;
}

// 3. CREDENTIAL_ATTACK: CRITICAL severity (20 samples)
function generateCredentialAttackSamples() {
  const samples = [];
  const templates = [
    { action: "BRUTE_FORCE_DETECTED", result: "BLOCKED", details: "100 failed attempts from external IP", hour: 3 },
    { action: "PASSWORD_SPRAY", result: "DETECTED", details: "Same password across 50 accounts", hour: 2 },
    { action: "CREDENTIAL_STUFFING", result: "BLOCKED", details: "Known leaked credentials used", hour: 4 },
    { action: "BRUTE_FORCE_DETECTED", result: "BLOCKED", details: "Rapid login attempts detected", hour: 1 },
    { action: "SQL_INJECTION", result: "BLOCKED", details: "Login form injection attempt", hour: 3 },
    { action: "BRUTE_FORCE_DETECTED", result: "BLOCKED", details: "Dictionary attack from TOR IP", hour: 2 },
    { action: "CREDENTIAL_STUFFING", result: "BLOCKED", details: "Breached credential database match", hour: 4 },
    { action: "PASSWORD_SPRAY", result: "DETECTED", details: "Common passwords tried", hour: 3 },
    { action: "LOGIN_FAILURES", result: "LOCKED", details: "Account locked after 10 failures", hour: 2 },
    { action: "BRUTE_FORCE_DETECTED", result: "BLOCKED", details: "Automated attack pattern", hour: 1 },
    // High priority user targeted
    { action: "BRUTE_FORCE_DETECTED", result: "BLOCKED", details: "Admin account targeted", hour: 3 },
    { action: "CREDENTIAL_STUFFING", result: "BLOCKED", details: "Executive account targeted", hour: 2 },
    { action: "BRUTE_FORCE_DETECTED", result: "BLOCKED", details: "Finance account targeted", hour: 4 },
    { action: "PASSWORD_SPRAY", result: "DETECTED", details: "IT admin accounts targeted", hour: 3 },
    { action: "BRUTE_FORCE_DETECTED", result: "BLOCKED", details: "CEO account attack attempt", hour: 2 },
    // Working hours attacks
    { action: "BRUTE_FORCE_DETECTED", result: "BLOCKED", details: "Attack during work hours", hour: 10 },
    { action: "CREDENTIAL_STUFFING", result: "BLOCKED", details: "Breach check during work hours", hour: 14 },
    { action: "PASSWORD_SPRAY", result: "DETECTED", details: "Attack during business hours", hour: 11 },
    { action: "BRUTE_FORCE_DETECTED", result: "BLOCKED", details: "Slow brute force attempt", hour: 9 },
    { action: "SQL_INJECTION", result: "BLOCKED", details: "Injection in business hours", hour: 15 },
  ];

  for (const t of templates) {
    const user = USERS[Math.floor(Math.random() * USERS.length)];
    samples.push({
      userId: user,
      accountId: user.split('@')[0],
      action: t.action,
      category: "AUTH",
      result: t.result,
      details: t.details,
      hour: t.hour,
      day: DAYS[Math.floor(Math.random() * 7)],
      isWorkingHours: t.hour >= 9 && t.hour <= 18,
      expected: {
        isAnomalous: true,
        confidence: 0.95,
        anomalyType: "CREDENTIAL_ATTACK",
        reason: `CRITICAL: Credential attack detected - ${t.details}`,
        recommendedAction: "DISABLE_ACCOUNT",
        severity: "CRITICAL"
      }
    });
  }
  return samples;
}

// 4. DATA_EXFILTRATION: HIGH severity (25 samples)
function generateDataExfiltrationSamples() {
  const samples = [];
  const templates = [
    // Large data transfers
    { action: "LARGE_UPLOAD", result: "DETECTED", details: "500MB to personal cloud", hour: 3 },
    { action: "BULK_DOWNLOAD", result: "DETECTED", details: "1000+ files downloaded", hour: 2 },
    { action: "UNUSUAL_PROTOCOL", result: "DETECTED", details: "FTP transfer to external IP", hour: 1 },
    { action: "DATA_COMPRESSION", result: "DETECTED", details: "Large ZIP sent externally", hour: 4 },
    { action: "ENCRYPTED_TRANSFER", result: "DETECTED", details: "Suspicious encrypted upload", hour: 3 },
    // Unauthorized destinations
    { action: "UNAUTHORIZED_DEST", result: "BLOCKED", details: "Transfer to competitor domain", hour: 14 },
    { action: "PERSONAL_EMAIL", result: "DETECTED", details: "Work files sent to personal Gmail", hour: 15 },
    { action: "USB_LARGE_COPY", result: "DETECTED", details: "Large copy to USB device", hour: 11 },
    { action: "CLOUD_UPLOAD", result: "DETECTED", details: "Files uploaded to personal Dropbox", hour: 14 },
    { action: "EXTERNAL_DRIVE", result: "DETECTED", details: "Data written to external HDD", hour: 15 },
    // Sensitive data
    { action: "SENSITIVE_UPLOAD", result: "BLOCKED", details: "Customer DB to external server", hour: 3 },
    { action: "FINANCIAL_DATA_EXPORT", result: "DETECTED", details: "Excel export unauthorized", hour: 14 },
    { action: "PII_UPLOAD", result: "BLOCKED", details: "Customer PII to personal cloud", hour: 15 },
    { action: "SOURCE_CODE_UPLOAD", result: "DETECTED", details: "Code repo to external git", hour: 11 },
    { action: "INTELLECTUAL_PROPERTY", result: "BLOCKED", details: "Product specs uploaded externally", hour: 14 },
    // After hours
    { action: "LARGE_UPLOAD", result: "DETECTED", details: "After hours bulk upload", hour: 23 },
    { action: "BULK_DOWNLOAD", result: "DETECTED", details: "Midnight mass download", hour: 1 },
    { action: "USB_LARGE_COPY", result: "DETECTED", details: "After hours USB copy", hour: 2 },
    { action: "CLOUD_UPLOAD", result: "DETECTED", details: "3am cloud sync", hour: 3 },
    { action: "DATA_COMPRESSION", result: "DETECTED", details: "Late night compression", hour: 1 },
    // Unusual patterns
    { action: "REPEATED_DOWNLOAD", result: "DETECTED", details: "Same files downloaded repeatedly", hour: 14 },
    { action: "OFF_PEAK_TRANSFER", result: "DETECTED", details: "Weekend large transfer", hour: 10, day: "SATURDAY" },
    { action: "UNUSUAL_TIMEZONE", result: "DETECTED", details: "Login from different timezone", hour: 14 },
    { action: "EXCESSIVE_QUERY", result: "DETECTED", details: "1000+ DB queries in hour", hour: 15 },
    { action: "REPORT_GENERATION", result: "DETECTED", details: "Suspicious report generation", hour: 3 },
  ];

  for (const t of templates) {
    const user = USERS[Math.floor(Math.random() * USERS.length)];
    samples.push({
      userId: user,
      accountId: user.split('@')[0],
      action: t.action,
      category: "DATA",
      result: t.result,
      details: t.details,
      hour: t.hour,
      day: t.day || DAYS[Math.floor(Math.random() * 7)],
      isWorkingHours: t.hour >= 9 && t.hour <= 18,
      expected: {
        isAnomalous: true,
        confidence: 0.9,
        anomalyType: "DATA_EXFILTRATION",
        reason: `HIGH: Data exfiltration indicators - ${t.details}`,
        recommendedAction: "ALERT_ADMIN",
        severity: "HIGH"
      }
    });
  }
  return samples;
}

// 5. PRIVILEGE_ESCALATION: HIGH severity (20 samples)
function generatePrivilegeEscalationSamples() {
  const samples = [];
  const templates = [
    { action: "ADMIN_ACCESS_ATTEMPT", result: "BLOCKED", details: "Non-admin tried admin panel", hour: 14 },
    { action: "SUDO_COMMAND", result: "DETECTED", details: "Unauthorized sudo attempt", hour: 15 },
    { action: "ACCESS_CONTROL_CHANGE", result: "DETECTED", details: "User modified own permissions", hour: 11 },
    { action: "PRIVILEGE_ESCALATION", result: "DETECTED", details: "Elevated to admin role", hour: 14 },
    { action: "UNAUTHORIZED_ACCESS", result: "BLOCKED", details: "Access to restricted folder", hour: 10 },
    { action: "ROLE_CHANGE", result: "DETECTED", details: "User promoted themselves", hour: 14 },
    { action: "ADMIN_ACCESS_ATTEMPT", result: "BLOCKED", details: "Finance accessed IT tools", hour: 15 },
    { action: "SUDO_COMMAND", result: "DETECTED", details: "Developer ran admin command", hour: 11 },
    // After hours
    { action: "ADMIN_ACCESS_ATTEMPT", result: "BLOCKED", details: "After hours admin access", hour: 23 },
    { action: "PRIVILEGE_ESCALATION", result: "DETECTED", details: "Midnight privilege change", hour: 2 },
    { action: "UNAUTHORIZED_ACCESS", result: "BLOCKED", details: "3am restricted access", hour: 3 },
    { action: "ROLE_CHANGE", result: "DETECTED", details: "Late night role modification", hour: 1 },
    // Successful escalation
    { action: "PRIVILEGE_ESCALATION", result: "SUCCESS", details: "Admin role gained", hour: 14 },
    { action: "ADMIN_ACCESS_ATTEMPT", result: "SUCCESS", details: "Admin panel accessed", hour: 15 },
    { action: "SUDO_COMMAND", result: "SUCCESS", details: "Root command executed", hour: 11 },
    // Multiple attempts
    { action: "PRIVILEGE_ESCALATION", result: "DETECTED", details: "Third escalation attempt", hour: 14 },
    { action: "UNAUTHORIZED_ACCESS", result: "BLOCKED", details: "Repeated access attempts", hour: 15 },
    { action: "ROLE_CHANGE", result: "DETECTED", details: "Permission cascade", hour: 11 },
    { action: "ACCESS_CONTROL_CHANGE", result: "DETECTED", details: "Multiple permission changes", hour: 14 },
    { action: "SUDO_COMMAND", result: "DETECTED", details: "Critical system command", hour: 15 },
  ];

  for (const t of templates) {
    const user = USERS[Math.floor(Math.random() * USERS.length)];
    samples.push({
      userId: user,
      accountId: user.split('@')[0],
      action: t.action,
      category: "ACCESS",
      result: t.result,
      details: t.details,
      hour: t.hour,
      day: DAYS[Math.floor(Math.random() * 7)],
      isWorkingHours: t.hour >= 9 && t.hour <= 18,
      expected: {
        isAnomalous: true,
        confidence: 0.85,
        anomalyType: "PRIVILEGE_ESCALATION",
        reason: `HIGH: Privilege escalation detected - ${t.details}`,
        recommendedAction: "ALERT_ADMIN",
        severity: "HIGH"
      }
    });
  }
  return samples;
}

// 6. OFF_HOURS activity: MEDIUM-HIGH severity (20 samples)
function generateOffHoursSamples() {
  const samples = [];
  const templates = [
    // Late night work
    { action: "LOGIN_SUCCESS", hour: 23, details: "Login at 11pm", context: "Unusual time" },
    { action: "FILE_ACCESS", hour: 0, details: "File access at midnight", context: "Off hours" },
    { action: "DATA_DOWNLOAD", hour: 1, details: "Download at 1am", context: "Suspicious timing" },
    { action: "LOGIN_SUCCESS", hour: 2, details: "Login at 2am", context: "Very unusual" },
    { action: "FILE_UPLOAD", hour: 3, details: "Upload at 3am", context: "Critical off hours" },
    // Weekend work
    { action: "LOGIN_SUCCESS", hour: 10, day: "SATURDAY", details: "Saturday login", context: "Weekend access" },
    { action: "FILE_ACCESS", hour: 14, day: "SUNDAY", details: "Sunday file access", context: "Weekend unusual" },
    { action: "REMOTE_ACCESS", hour: 11, day: "SATURDAY", details: "Weekend remote session", context: "Verify need" },
    { action: "DATA_DOWNLOAD", hour: 15, day: "SUNDAY", details: "Sunday download", context: "Weekend suspicious" },
    { action: "LOGIN_SUCCESS", hour: 16, day: "SATURDAY", details: "Saturday afternoon login", context: "Unusual weekend" },
    // Normal off hours (benign)
    { action: "LOGIN_SUCCESS", hour: 20, details: "Overtime login", context: "Normal overtime" },
    { action: "FILE_SAVE", hour: 19, details: "Evening work save", context: "Acceptable overtime" },
    { action: "MEETING_JOIN", hour: 18, details: "Late meeting attendance", context: "Scheduled meeting" },
    { action: "EMAIL_CHECK", hour: 20, details: "Evening email review", context: "Normal after hours" },
    { action: "DOCUMENT_EDIT", hour: 19, details: "Evening document work", context: "Reasonable overtime" },
    // Holiday work
    { action: "LOGIN_SUCCESS", hour: 10, day: "SUNDAY", details: "Sunday work session", context: "Verify if authorized" },
    { action: "FILE_ACCESS", hour: 14, day: "SATURDAY", details: "Weekend file work", context: "Check if planned" },
    // Extreme hours
    { action: "LOGIN_SUCCESS", hour: 4, details: "4am login", context: "Extremely unusual" },
    { action: "REMOTE_ACCESS", hour: 5, details: "5am remote session", context: "Critical anomaly" },
    { action: "DATA_EXPORT", hour: 4, details: "Data export at 4am", context: "High risk off hours" },
  ];

  for (const t of templates) {
    const user = USERS[Math.floor(Math.random() * USERS.length)];
    const isBenign = t.context.includes("Normal") || t.context.includes("Acceptable") || t.context.includes("reasonable");
    const isWeekend = t.day && (t.day === "SATURDAY" || t.day === "SUNDAY");
    const isExtreme = t.hour >= 4 && t.hour <= 6;
    
    samples.push({
      userId: user,
      accountId: user.split('@')[0],
      action: t.action,
      category: "ACCESS",
      result: "SUCCESS",
      details: t.details,
      hour: t.hour,
      day: t.day || DAYS[Math.floor(Math.random() * 5)],
      isWorkingHours: false,
      expected: isBenign ? {
        isAnomalous: false,
        confidence: 0.85,
        anomalyType: "NONE",
        reason: `Normal after hours activity - ${t.context}`,
        recommendedAction: "NONE",
        severity: "LOW"
      } : isExtreme ? {
        isAnomalous: true,
        confidence: 0.9,
        anomalyType: "OFF_HOURS",
        reason: `HIGH: Extreme off-hours activity - ${t.details}`,
        recommendedAction: "ALERT_ADMIN",
        severity: "HIGH"
      } : isWeekend ? {
        isAnomalous: true,
        confidence: 0.75,
        anomalyType: "OFF_HOURS",
        reason: `MEDIUM: Weekend access - ${t.context}`,
        recommendedAction: "WARNING",
        severity: "MEDIUM"
      } : {
        isAnomalous: true,
        confidence: 0.7,
        anomalyType: "OFF_HOURS",
        reason: `MEDIUM-HIGH: Off-hours activity - ${t.context}`,
        recommendedAction: "WARNING",
        severity: "MEDIUM"
      }
    });
  }
  return samples;
}

// 7. ENDPOINT_TAMPERING: HIGH severity (20 samples)
function generateEndpointTamperingSamples() {
  const samples = [];
  const templates = [
    { action: "ANTIVIRUS_DISABLED", result: "DETECTED", details: "Windows Defender turned off", hour: 14 },
    { action: "FIREWALL_CHANGE", result: "DETECTED", details: "Firewall rules modified", hour: 15 },
    { action: "REGISTRY_CHANGE", result: "DETECTED", details: "Suspicious registry edit", hour: 11 },
    { action: "SERVICE_STOPPED", result: "DETECTED", details: "Security service terminated", hour: 14 },
    { action: "PROCESS_INJECTION", result: "DETECTED", details: "Malicious process injection", hour: 3 },
    { action: "MEMORY_DUMP", result: "DETECTED", details: "LSASS memory dumped", hour: 2 },
    { action: "DISABLE_UAC", result: "DETECTED", details: "UAC turned off", hour: 14 },
    { action: "SECURITY_TOOL_KILL", result: "DETECTED", details: "EDR agent terminated", hour: 15 },
    // After hours tampering
    { action: "ANTIVIRUS_DISABLED", result: "DETECTED", details: "Defender disabled at night", hour: 23 },
    { action: "FIREWALL_CHANGE", result: "DETECTED", details: "Firewall off at midnight", hour: 1 },
    { action: "PROCESS_INJECTION", result: "DETECTED", details: "Injection at 2am", hour: 2 },
    { action: "SERVICE_STOPPED", result: "DETECTED", details: "Service killed at 3am", hour: 3 },
    // Suspicious modifications
    { action: "HOSTS_FILE_CHANGE", result: "DETECTED", details: "Hosts file modified", hour: 14 },
    { action: "DNS_CHANGE", result: "DETECTED", details: "DNS settings changed", hour: 15 },
    { action: "PROXY_CHANGE", result: "DETECTED", details: "Proxy configuration altered", hour: 11 },
    { action: "BOOT_MODIFICATION", result: "DETECTED", details: "Startup configuration changed", hour: 14 },
    // User initiated
    { action: "ANTIVIRUS_DISABLED", result: "DETECTED", details: "User disabled security", hour: 14 },
    { action: "FIREWALL_CHANGE", result: "DETECTED", details: "User modified firewall", hour: 10 },
    { action: "DISABLE_UAC", result: "DETECTED", details: "User turned off UAC", hour: 15 },
    { action: "REGISTRY_CHANGE", result: "DETECTED", details: "User edited registry", hour: 11 },
  ];

  for (const t of templates) {
    const user = USERS[Math.floor(Math.random() * USERS.length)];
    samples.push({
      userId: user,
      accountId: user.split('@')[0],
      action: t.action,
      category: "ENDPOINT",
      result: t.result,
      details: t.details,
      hour: t.hour,
      day: DAYS[Math.floor(Math.random() * 7)],
      isWorkingHours: t.hour >= 9 && t.hour <= 18,
      expected: {
        isAnomalous: true,
        confidence: 0.9,
        anomalyType: "ENDPOINT_TAMPERING",
        reason: `HIGH: Endpoint tampering detected - ${t.details}`,
        recommendedAction: "ALERT_ADMIN",
        severity: "HIGH"
      }
    });
  }
  return samples;
}

// 8. MALWARE/USB: CRITICAL severity (25 samples)
function generateMalwareSamples() {
  const samples = [];
  const templates = [
    // Malware detection
    { action: "MALWARE_DETECTED", result: "QUARANTINED", details: "Trojan detected and quarantined", hour: 14 },
    { action: "VIRUS_DETECTED", result: "BLOCKED", details: "Virus detected at entry point", hour: 15 },
    { action: "RANSOMWARE_INDICATOR", result: "DETECTED", details: "Ransomware behavior pattern", hour: 11 },
    { action: "BACKDOOR_DETECTED", result: "DETECTED", details: "Backdoor communication blocked", hour: 3 },
    { action: "KEYLOGGER_DETECTED", result: "DETECTED", details: "Keylogger software found", hour: 2 },
    // USB attacks
    { action: "USB_BADUSB_DETECTED", result: "BLOCKED", details: "BadUSB device rejected", hour: 14 },
    { action: "USB_KEYSTROKE_INJECTION", result: "BLOCKED", details: "Keystroke injection attack", hour: 15 },
    { action: "USB_HID_ATTACK", result: "BLOCKED", details: "USB HID attack detected", hour: 11 },
    { action: "USB_UNKNOWN_DEVICE", result: "BLOCKED", details: "Unknown USB device blocked", hour: 14 },
    { action: "USB_MALWARE", result: "BLOCKED", details: "Malware on USB device", hour: 15 },
    // Suspicious downloads
    { action: "SUSPICIOUS_DOWNLOAD", result: "BLOCKED", details: "Executable from unknown source", hour: 14 },
    { action: "RAR_JAR_DOWNLOAD", result: "BLOCKED", details: "Suspicious archive downloaded", hour: 15 },
    { action: "POWERSHELL_SCRIPT", result: "BLOCKED", details: "Malicious PowerShell detected", hour: 11 },
    { action: "SUSPICIOUS_EXEC", result: "BLOCKED", details: "Unknown executable blocked", hour: 14 },
    // After hours
    { action: "MALWARE_DETECTED", result: "QUARANTINED", details: "Malware at midnight", hour: 0 },
    { action: "USB_BADUSB_DETECTED", result: "BLOCKED", details: "BadUSB at 2am", hour: 2 },
    { action: "RANSOMWARE_INDICATOR", result: "DETECTED", details: "Ransomware at 3am", hour: 3 },
    { action: "SUSPICIOUS_DOWNLOAD", result: "BLOCKED", details: "Download at 1am", hour: 1 },
    // High value targets
    { action: "MALWARE_DETECTED", result: "QUARANTINED", details: "Malware on admin machine", hour: 14 },
    { action: "KEYLOGGER_DETECTED", result: "DETECTED", details: "Keylogger on finance device", hour: 15 },
    { action: "BACKDOOR_DETECTED", result: "DETECTED", details: "Backdoor on server", hour: 11 },
    // Additional malware
    { action: "ROOTKIT_INDICATOR", result: "DETECTED", details: "Rootkit behavior detected", hour: 14 },
    { action: "CRYPTO_MINER", result: "DETECTED", details: "Cryptominer detected", hour: 15 },
    { action: "SPYWARE_DETECTED", result: "DETECTED", details: "Spyware activity blocked", hour: 11 },
    { action: "TROJAN_DOWNLOADER", result: "BLOCKED", details: "Trojan downloader blocked", hour: 14 },
  ];

  for (const t of templates) {
    const user = USERS[Math.floor(Math.random() * USERS.length)];
    samples.push({
      userId: user,
      accountId: user.split('@')[0],
      action: t.action,
      category: "SECURITY",
      result: t.result,
      details: t.details,
      hour: t.hour,
      day: DAYS[Math.floor(Math.random() * 7)],
      isWorkingHours: t.hour >= 9 && t.hour <= 18,
      expected: {
        isAnomalous: true,
        confidence: 0.95,
        anomalyType: "MALWARE_DETECTED",
        reason: `CRITICAL: Security threat detected - ${t.details}`,
        recommendedAction: "DISABLE_ACCOUNT",
        severity: "CRITICAL"
      }
    });
  }
  return samples;
}

// ============ GENERATE SAMPLES ============

function generateSamples() {
  const allSamples = [
    ...generateBenignSamples(),           // 40
    ...generateScreenRecordingSamples(),   // 30
    ...generateCredentialAttackSamples(), // 20
    ...generateDataExfiltrationSamples(), // 25
    ...generatePrivilegeEscalationSamples(), // 20
    ...generateOffHoursSamples(),         // 20
    ...generateEndpointTamperingSamples(), // 20
    ...generateMalwareSamples(),           // 25
  ];
  
  console.log(`Total samples: ${allSamples.length}`);
  
  // Convert to JSONL format
  const jsonl = allSamples.map(sample => {
    const userPrompt = `Analyze the following security event:

## Current Event
- User ID: ${sample.userId}
- Account: ${sample.accountId}
- Action: ${sample.action}
- Category: ${sample.category}
- Result: ${sample.result}
- Details: ${sample.details}
- Hour of Day: ${String(sample.hour).padStart(2, '0')}:00
- Day of Week: ${sample.day}
- Is Working Hours: ${sample.isWorkingHours}`;

    const correctResponse = JSON.stringify({
      isAnomalous: sample.expected.isAnomalous,
      confidence: sample.expected.confidence,
      anomalyType: sample.expected.anomalyType,
      reason: sample.expected.reason,
      recommendedAction: sample.expected.recommendedAction,
      severity: sample.expected.severity
    });

    return JSON.stringify({
      systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents: [
        { role: "user", parts: [{ text: userPrompt }] },
        { role: "model", parts: [{ text: correctResponse }] }
      ]
    });
  });

  return { samples: allSamples, jsonl };
}

// ============ MAIN ============

const outputDir = __dirname;
const { samples, jsonl } = generateSamples();

// Write JSONL
const jsonlPath = path.join(outputDir, 'samples.jsonl');
fs.writeFileSync(jsonlPath, jsonl.join('\n'), 'utf-8');
console.log(`\nGenerated ${jsonl.length} training samples`);
console.log(`Written to: ${jsonlPath}`);

// Write summary CSV
const csvHeader = 'Category,Count,Anomalous,Benign\n';
const summary = {
  'BENIGN (LOW)': { total: 0, anomalous: 0, benign: 0 },
  'SCREEN_RECORDING': { total: 0, anomalous: 0, benign: 0 },
  'CREDENTIAL_ATTACK': { total: 0, anomalous: 0, benign: 0 },
  'DATA_EXFILTRATION': { total: 0, anomalous: 0, benign: 0 },
  'PRIVILEGE_ESCALATION': { total: 0, anomalous: 0, benign: 0 },
  'OFF_HOURS': { total: 0, anomalous: 0, benign: 0 },
  'ENDPOINT_TAMPERING': { total: 0, anomalous: 0, benign: 0 },
  'MALWARE': { total: 0, anomalous: 0, benign: 0 },
};

samples.forEach(s => {
  const type = s.expected.anomalyType === 'NONE' ? 'BENIGN (LOW)' : s.expected.anomalyType;
  if (!summary[type]) summary[type] = { total: 0, anomalous: 0, benign: 0 };
  summary[type].total++;
  if (s.expected.isAnomalous) summary[type].anomalous++;
  else summary[type].benign++;
});

let csv = csvHeader;
for (const [type, counts] of Object.entries(summary)) {
  csv += `${type},${counts.total},${counts.anomalous},${counts.benign}\n`;
}

const csvPath = path.join(outputDir, 'samples-summary.csv');
fs.writeFileSync(csvPath, csv, 'utf-8');
console.log(`Summary written to: ${csvPath}`);

// Print summary
console.log('\n=== Sample Distribution ===');
for (const [type, counts] of Object.entries(summary)) {
  console.log(`  ${type}: ${counts.total} (Anomalous: ${counts.anomalous}, Benign: ${counts.benign})`);
}
