"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdminApi = createAdminApi;
function createAdminApi(client) {
    return {
        getClassificationTuningStatus: function () {
            return client.get('/admin/classification-tuning/status').then(function (r) { return r.data; });
        },
        triggerClassificationAutoTuning: function () {
            return client.post('/admin/classification-tuning/auto-trigger').then(function (r) { return r.data; });
        },
        getClassificationTuningSamples: function (limit) {
            if (limit === void 0) { limit = 50; }
            return client.get('/admin/classification-tuning/samples', { params: { limit: limit } }).then(function (r) { return r.data; });
        },
        clearClassificationTuningSamples: function () {
            return client.delete('/admin/classification-tuning/samples', { params: { confirm: true } }).then(function (r) { return r.data; });
        },
        importClassificationTuningExamples: function (file) {
            var formData = new FormData();
            formData.append('file', file);
            return client.post('/admin/classification-tuning/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }).then(function (r) { return r.data; });
        },
        // UEBA Tuning API
        getUebaTuningStatus: function () {
            return client.get('/admin/ueba-tuning/status').then(function (r) { return r.data; });
        },
        getUebaTuningVersion: function () {
            return client.get('/admin/ueba-tuning/version').then(function (r) { return r.data; });
        },
        triggerUebaAutoTuning: function () {
            return client.post('/admin/ueba-tuning/auto-trigger').then(function (r) { return r.data; });
        },
        getUebaTuningAutoToggle: function () {
            return client.get('/admin/ueba-tuning/auto-toggle').then(function (r) { return r.data; });
        },
        setUebaTuningAutoToggle: function (enabled) {
            return client.post('/admin/ueba-tuning/auto-toggle', null, {
                params: { enabled: enabled },
            }).then(function (r) { return r.data; });
        },
        setUebaMinExamples: function (value) {
            return client.put('/admin/ueba-tuning/min-examples', null, {
                params: { value: value },
            }).then(function (r) { return r.data; });
        },
        getUebaTuningExamples: function (limit) {
            if (limit === void 0) { limit = 50; }
            return client.get('/admin/ueba-tuning/examples', { params: { limit: limit } }).then(function (r) { return r.data; });
        },
        deleteUebaTuningExample: function (id) {
            return client.delete("/admin/ueba-tuning/examples/".concat(id)).then(function (r) { return r.data; });
        },
        clearUebaTuningExamples: function () {
            return client.delete('/admin/ueba-tuning/examples', { params: { confirm: true } }).then(function (r) { return r.data; });
        },
        importUebaTuningExamples: function (file) {
            var formData = new FormData();
            formData.append('file', file);
            return client.post('/admin/ueba-tuning/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }).then(function (r) { return r.data; });
        },
        // Classification Tuning API
        getClassificationTuningAutoToggle: function () {
            return client.get('/admin/classification-tuning/auto-toggle').then(function (r) { return r.data; });
        },
        setClassificationTuningAutoToggle: function (enabled) {
            return client.post('/admin/classification-tuning/auto-toggle', null, {
                params: { enabled: enabled },
            }).then(function (r) { return r.data; });
        },
        setClassificationMinExamples: function (value) {
            return client.put('/admin/classification-tuning/min-examples', null, {
                params: { value: value },
            }).then(function (r) { return r.data; });
        },
        getSystemHealth: function () { return client.get('/system/health').then(function (r) { return r.data; }); },
        getBlockchainHealth: function () { return client.get('/system/blockchain/health').then(function (r) { return r.data; }); },
        getLlmHealth: function () { return client.get('/system/llm/health').then(function (r) { return r.data; }); },
        getBlockchainTransaction: function (txHash) {
            return client.get("/system/blockchain/tx/".concat(encodeURIComponent(txHash))).then(function (r) { return r.data; });
        },
        resetUebaScores: function (enableAccounts) {
            if (enableAccounts === void 0) { enableAccounts = false; }
            return client.post('/admin/ueba/reset-scores', null, { params: { enableAccounts: enableAccounts } }).then(function (r) { return r.data; });
        },
        resetUserUebaScore: function (userId, enableAccount) {
            if (enableAccount === void 0) { enableAccount = false; }
            return client.post("/admin/users/".concat(userId, "/ueba/reset-score"), null, { params: { enableAccount: enableAccount } }).then(function (r) { return r.data; });
        },
        getJobQueue: function () { return client.get('/jobs/queue').then(function (r) { return r.data; }); },
        getUserSummary2: function () { return client.get('/admin/users/summary').then(function (r) { return r.data; }); },
        getSystemLogs: function () { return client.get('/logs/recent').then(function (r) { return r.data; }); },
        exportLogs: function (range) {
            if (range === void 0) { range = '24h'; }
            return client.get('/logs/export', { params: { range: range } }).then(function (r) { return r.data; });
        },
        wipeDocumentLibrary: function (confirm, deleteFiles) {
            if (deleteFiles === void 0) { deleteFiles = true; }
            return client.post('/admin/system/wipe-documents', null, { params: { confirm: confirm, deleteFiles: deleteFiles } }).then(function (r) { return r.data; });
        },
        createUser: function (data) {
            return client.post('/admin/users', data).then(function (r) { return r.data; });
        },
        getAllUsers: function () { return client.get('/admin/users').then(function (r) { return r.data; }); },
        getNextAccountId: function (department, role) {
            var params = {};
            if (department)
                params.department = department;
            if (role)
                params.role = role;
            return client.get('/admin/users/next-account-id', { params: params }).then(function (r) { return r.data; });
        },
        searchUsers: function (q, limit) {
            if (limit === void 0) { limit = 10; }
            return client.get('/users/search', { params: { q: q, limit: limit } }).then(function (r) { return r.data; });
        },
        restoreUser: function (userId) { return client.post("/admin/users/".concat(userId, "/restore")).then(function (r) { return r.data; }); },
        purgeUser: function (userId) { return client.delete("/admin/users/".concat(userId, "/purge")).then(function (r) { return r.data; }); },
        getUserById: function (userId) { return client.get("/admin/users/".concat(userId)).then(function (r) { return r.data; }); },
        updateUser: function (userId, data) {
            return client.put("/admin/users/".concat(userId), data).then(function (r) { return r.data; });
        },
        unlockUser: function (userId) { return client.put("/admin/users/".concat(userId, "/unlock")).then(function (r) { return r.data; }); },
        disableUser: function (userId) { return client.put("/admin/users/".concat(userId, "/disable")).then(function (r) { return r.data; }); },
        enableUser: function (userId) { return client.put("/admin/users/".concat(userId, "/enable")).then(function (r) { return r.data; }); },
        resetUserPassword: function (userId) { return client.put("/admin/users/".concat(userId, "/reset")).then(function (r) { return r.data; }); },
        deleteUser: function (userId) { return client.delete("/admin/users/".concat(userId)).then(function (r) { return r.data; }); },
        getDlpPolicies: function () { return client.get('/admin/policies/dlp').then(function (r) { return r.data; }); },
        updateDlpPolicies: function (config, reason) {
            return client.put('/admin/policies/dlp', config, { params: reason ? { reason: reason } : undefined }).then(function (r) { return r.data; });
        },
        getPolicyHistory: function (policyKey) { return client.get('/admin/policies/history', { params: { policyKey: policyKey } }).then(function (r) { return r.data; }); },
        rollbackPolicy: function (policyKey, version, reason) {
            return client.post('/admin/policies/rollback', { policyKey: policyKey, version: version, reason: reason || 'Policy rollback' }).then(function (r) { return r.data; });
        },
        getWatermarkSettings: function () { return client.get('/admin/watermark').then(function (r) { return r.data; }); },
        updateWatermarkSettings: function (settings, reason) {
            return client.put('/admin/watermark', settings, { params: reason ? { reason: reason } : undefined }).then(function (r) { return r.data; });
        },
        checkBlindWatermark: function (file) {
            var formData = new FormData();
            formData.append('file', file);
            return client
                .post('/admin/watermark/check', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
                .then(function (r) { return r.data; });
        },
        adminRevokeForceResetAndAlert: function (userId, reason) {
            return client.post('/keys/admin/revoke-force-reset', { userId: userId, reason: reason || 'Security incident response' }).then(function (r) { return r.data; });
        },
        adminRewrapOperationalKeys: function () {
            return client.post('/keys/admin/rewrap-operational-keys').then(function (r) { return r.data; });
        },
        // Watermark Traceback API
        watermarkTracebackSearch: function (params) {
            return client.post('/admin/watermark-traceback/search', null, { params: params }).then(function (r) { return r.data; });
        },
        watermarkTracebackByShortCode: function (shortCode, page, size) {
            if (page === void 0) { page = 0; }
            if (size === void 0) { size = 20; }
            return client.post('/admin/watermark-traceback/shortcode', null, { params: { shortCode: shortCode, page: page, size: size } }).then(function (r) { return r.data; });
        },
        // IP Management API
        getBlockedIps: function () {
            return client.get('/admin/ip/blocked').then(function (r) { return r.data; });
        },
        unblockIp: function (ipAddress) {
            return client.post('/admin/ip/unblock', { ipAddress: ipAddress }).then(function (r) { return r.data; });
        },
        blockIp: function (ipAddress, reason) {
            return client.post('/admin/ip/block', { ipAddress: ipAddress, reason: reason }).then(function (r) { return r.data; });
        },
        unblockAllIps: function () {
            return client.post('/admin/ip/unblock-all').then(function (r) { return r.data; });
        },
    };
}
