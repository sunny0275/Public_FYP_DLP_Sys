"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = void 0;
var client_1 = require("./client");
var auth_1 = require("./auth");
var me_1 = require("./me");
var dashboard_1 = require("./dashboard");
var edr_1 = require("./edr");
var ueba_1 = require("./ueba");
var audit_1 = require("./audit");
var security_1 = require("./security");
var compliance_1 = require("./compliance");
var admin_1 = require("./admin");
var document_1 = require("./document");
var share_1 = require("./share");
var workflow_1 = require("./workflow");
var classification_1 = require("./classification");
var signature_1 = require("./signature");
var client = (0, client_1.createClient)();
exports.apiClient = __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({}, (0, auth_1.createAuthApi)(client)), (0, me_1.createMeApi)(client)), (0, dashboard_1.createDashboardApi)(client)), (0, edr_1.createEdrApi)(client)), (0, ueba_1.createUebaApi)(client)), (0, audit_1.createAuditApi)(client)), (0, security_1.createSecurityApi)(client)), (0, compliance_1.createComplianceApi)(client)), (0, admin_1.createAdminApi)(client)), (0, document_1.createDocumentApi)(client)), (0, share_1.createShareApi)(client)), (0, workflow_1.createWorkflowApi)(client)), (0, classification_1.createClassificationApi)(client)), (0, signature_1.createSignatureApi)(client));
