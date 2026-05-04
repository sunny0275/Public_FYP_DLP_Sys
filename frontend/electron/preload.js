"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
// Expose a restricted API to the renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Get app version
    getAppVersion: function () { return electron_1.ipcRenderer.invoke('get-app-version'); },
    // Get user data path
    getUserDataPath: function () { return electron_1.ipcRenderer.invoke('get-user-data-path'); },
    // File operations
    readFile: function (filePath) { return electron_1.ipcRenderer.invoke('read-file', filePath); },
    // Set current user accountId - notify main process via IPC
    setAccountId: function (accountId) {
        electron_1.ipcRenderer.send('set-account-id', accountId);
    },
    // Get current user accountId (from main process)
    getAccountId: function () { return electron_1.ipcRenderer.invoke('get-account-id'); },
    // Get local IP address (non-loopback) for audit logging
    getLocalIpAddress: function () { return electron_1.ipcRenderer.invoke('get-local-ip-address'); },
    // Auth init response - send auth data from renderer to main process
    sendAuthInitResponse: function (accountId, accessToken) {
        electron_1.ipcRenderer.send('DLP_AUTH_INIT_RESPONSE', accountId, accessToken);
    },
    // Listen for suspicious activity
    onSuspiciousActivity: function (callback) {
        electron_1.ipcRenderer.on('suspicious-activity', function (_event, activity) { return callback(activity); });
    },
    // Listen for screenshot blocked events - HIGH SEVERITY
    onScreenshotBlocked: function (callback) {
        electron_1.ipcRenderer.on('screenshot-blocked', function (_event, data) { return callback(data); });
    },
    // Listen for recording start events
    onRecordingStart: function (callback) {
        electron_1.ipcRenderer.on('recording-start', function (_event, data) { return callback(data); });
    },
    // Listen for recording stop events
    onRecordingStop: function (callback) {
        electron_1.ipcRenderer.on('recording-stop', function (_event, data) { return callback(data); });
    },
    onResizePreview: function (callback) {
        electron_1.ipcRenderer.on('resize-preview', function () { return callback(); });
    },
    removeResizePreviewListener: function () {
        electron_1.ipcRenderer.removeAllListeners('resize-preview');
    },
    isContentProtected: function () { return electron_1.ipcRenderer.invoke('is-content-protected'); },
    setContentProtection: function (enabled) { return electron_1.ipcRenderer.invoke('set-content-protection', enabled); },
    // Document viewing state for conditional security logging
    // Only log screenshot/recording tool warnings when actively viewing documents
    setDocumentViewing: function (active) {
        electron_1.ipcRenderer.send('set-document-viewing', active);
    },
    isDocumentViewing: function () { return electron_1.ipcRenderer.invoke('is-document-viewing'); },
    // Remove listeners
    removeSuspiciousActivityListener: function () {
        electron_1.ipcRenderer.removeAllListeners('suspicious-activity');
    },
    removeScreenshotBlockedListener: function () {
        electron_1.ipcRenderer.removeAllListeners('screenshot-blocked');
    },
    removeRecordingStartListener: function () {
        electron_1.ipcRenderer.removeAllListeners('recording-start');
    },
    removeRecordingStopListener: function () {
        electron_1.ipcRenderer.removeAllListeners('recording-stop');
    }
});
