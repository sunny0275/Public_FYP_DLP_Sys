"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_router_dom_1 = require("react-router-dom");
var react_1 = require("react");
var authStore_1 = require("./store/authStore");
var api_1 = require("./api");
var PrivateRoute_1 = require("./components/PrivateRoute");
var dashboardPaths_1 = require("./utils/dashboardPaths");
var useScreenshotBlockedAlert_1 = require("./hooks/useScreenshotBlockedAlert");
var useSecurityMonitor_1 = require("./hooks/useSecurityMonitor");
// Auth pages
var LoginPage_1 = require("./pages/auth/LoginPage");
var ChangePasswordPage_1 = require("./pages/auth/ChangePasswordPage");
var PeriodicPasswordChangePage_1 = require("./pages/auth/PeriodicPasswordChangePage");
var MfaSetupPage_1 = require("./pages/auth/MfaSetupPage");
var MfaVerifyPage_1 = require("./pages/auth/MfaVerifyPage");
var ForgotPasswordPage_1 = require("./pages/auth/ForgotPasswordPage");
// Dashboard pages
var DashboardPage_1 = require("./pages/dashboard/DashboardPage");
var AdminDashboardPage_1 = require("./pages/dashboard/AdminDashboardPage");
// Document pages
var DocumentsPage_1 = require("./pages/documents/DocumentsPage");
var DocumentDetailPage_1 = require("./pages/documents/DocumentDetailPage");
var UploadPage_1 = require("./pages/documents/UploadPage");
var UploadResultPage_1 = require("./pages/documents/UploadResultPage");
var MySharesPage_1 = require("./pages/documents/MySharesPage");
var SharedDocumentPage_1 = require("./pages/documents/SharedDocumentPage");
// Admin pages
var AdminPage_1 = require("./pages/admin/AdminPage");
var EditUserPage_1 = require("./pages/admin/EditUserPage");
var RecoveryAccountsPage_1 = require("./pages/admin/RecoveryAccountsPage");
var BlockchainHealthPage_1 = require("./pages/admin/BlockchainHealthPage");
var BlockedIpsPage_1 = require("./pages/admin/BlockedIpsPage");
var WatermarkTracebackPage_1 = require("./pages/admin/WatermarkTracebackPage");
// Profile pages
var ProfilePage_1 = require("./pages/profile/ProfilePage");
// Workflow pages
var WorkflowFormPage_1 = require("./pages/workflow/WorkflowFormPage");
// Signature pages
var SignatureChainPage_1 = require("./pages/documents/SignatureChainPage");
// Classification pages
var ClassificationReviewPage_1 = require("./pages/classification/ClassificationReviewPage");
// Audit pages
var AuditLogPage_1 = require("./pages/audit/AuditLogPage");
// Notifications (alerts from audit: warnings, UEBA disable, etc.)
var NotificationsPage_1 = require("./pages/notifications/NotificationsPage");
// EDR pages
var EDRConsolePage_1 = require("./pages/edr/EDRConsolePage");
var EDRPoliciesPage_1 = require("./pages/edr/EDRPoliciesPage");
// UEBA pages
var UebaDashboardPage_1 = require("./pages/ueba/UebaDashboardPage");
var UebaIncidentsPage_1 = require("./pages/ueba/UebaIncidentsPage");
var UebaPoliciesPage_1 = require("./pages/ueba/UebaPoliciesPage");
var UebaUsersPage_1 = require("./pages/ueba/UebaUsersPage");
// Components
var DashboardLayout_1 = require("./components/DashboardLayout");
require("./App.css");
function MfaRedirect() {
    var user = (0, authStore_1.useAuthStore)().user;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var location = (0, react_router_dom_1.useLocation)();
    var requiresPasswordChange = !!user && (user.passwordChangeRequired || user.firstLogin);
    var requiresMfaSetup = !!user && !user.mfaEnabled && user.mfaRequired;
    (0, react_1.useEffect)(function () {
        if (user && !requiresPasswordChange && requiresMfaSetup && location.pathname !== '/mfa-setup') {
            navigate('/mfa-setup', { replace: true });
        }
    }, [requiresPasswordChange, requiresMfaSetup, navigate, location.pathname, user]);
    return null;
}
function AccountStatusGuard() {
    var _this = this;
    var _a = (0, authStore_1.useAuthStore)(), isAuthenticated = _a.isAuthenticated, clearAuth = _a.clearAuth;
    (0, react_1.useEffect)(function () {
        if (!isAuthenticated)
            return;
        var timer = null;
        var inFlight = false;
        var forceLogout = function () {
            clearAuth();
            window.location.href = '/login?reason=account_disabled';
        };
        var checkAccountStatus = function () { return __awaiter(_this, void 0, void 0, function () {
            var res, enabled, err_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (inFlight)
                            return [2 /*return*/];
                        inFlight = true;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, api_1.apiClient.getMyProfile()];
                    case 2:
                        res = _b.sent();
                        enabled = (_a = res === null || res === void 0 ? void 0 : res.data) === null || _a === void 0 ? void 0 : _a.accountEnabled;
                        if (enabled === false) {
                            alert('Your account has been disabled (UEBA policy violation). You are being signed out.');
                            forceLogout();
                        }
                        return [3 /*break*/, 5];
                    case 3:
                        err_1 = _b.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        inFlight = false;
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        checkAccountStatus();
        // Poll every 30 seconds for account status check (reduced from 5s to improve performance)
        timer = setInterval(checkAccountStatus, 30000);
        var onVisible = function () {
            if (!document.hidden)
                checkAccountStatus();
        };
        document.addEventListener('visibilitychange', onVisible);
        return function () {
            if (timer)
                clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [clearAuth, isAuthenticated]);
    return null;
}
function AppRoutes() {
    // Enable security monitoring for the entire app
    // This detects screenshot attempts, screen recording, and suspicious activities
    (0, useSecurityMonitor_1.useSecurityMonitor)({
        enabled: true,
        reportScreenshot: true,
        reportClipboard: true
    });
    // Listen for screenshot blocked events and show alerts (desktop app)
    (0, useScreenshotBlockedAlert_1.useScreenshotBlockedAlert)();
    // Get user from auth store
    var user = (0, authStore_1.useAuthStore)().user;
    // Sync user accountId to Electron main process for security event reporting
    // This ensures audit logs have correct user identification
    (0, react_1.useEffect)(function () {
        var electronApi = window === null || window === void 0 ? void 0 : window.electronAPI;
        if (!electronApi) {
            console.log('[App] electronAPI not available');
            return;
        }
        console.log('[App] useEffect triggered, user:', user === null || user === void 0 ? void 0 : user.accountId);
        if (user === null || user === void 0 ? void 0 : user.accountId) {
            electronApi.setAccountId(user.accountId);
            console.log('[App] AccountId synced to Electron:', user.accountId);
        }
        else {
            electronApi.setAccountId('');
            console.log('[App] No user, clearing AccountId');
        }
    }, [user]);
    var isAuthenticated = !!user && !user.mfaRequired;
    // First login / admin reset: change password then MFA setup
    var requiresPasswordChangeWithMfaSetup = !!user && (user.firstLogin || (user.passwordChangeRequired && !user.mfaEnabled));
    // Periodic expiry: change password only, MFA already set up
    var requiresPeriodicPasswordChange = !!user && user.passwordChangeRequired && !!user.mfaEnabled;
    var requiresPasswordChange = requiresPasswordChangeWithMfaSetup || requiresPeriodicPasswordChange;
    var passwordChangeRedirectPath = requiresPasswordChangeWithMfaSetup ? '/change-password' : '/update-password';
    var requiresMfaSetup = !!user && !user.mfaEnabled && user.mfaRequired;
    var requiresMfaVerify = !!user && user.mfaEnabled && user.mfaRequired;
    var roleDefaultPath = function () { return (0, dashboardPaths_1.getPreferredDashboardPath)(user); };
    return (<react_router_dom_1.Routes>
        {/* Public routes */}
        <react_router_dom_1.Route path="/login" element={!isAuthenticated ? <LoginPage_1.default /> : <react_router_dom_1.Navigate to={roleDefaultPath()} replace/>}/>
        <react_router_dom_1.Route path="/forgot-password" element={!isAuthenticated ? <ForgotPasswordPage_1.default /> : <react_router_dom_1.Navigate to={roleDefaultPath()} replace/>}/>
        <react_router_dom_1.Route path="/shared/:token" element={<SharedDocumentPage_1.default />}/>
        <react_router_dom_1.Route path="/mfa-verify" element={<MfaVerifyPage_1.default />}/>

        {/* Protected routes */}
        <react_router_dom_1.Route path="/home" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath} replace/>
            : <react_router_dom_1.Navigate to={roleDefaultPath()} replace/>}/>
        <react_router_dom_1.Route path="/dashboard" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath} replace/>
            : requiresMfaSetup
                ? <react_router_dom_1.Navigate to="/mfa-setup" replace/>
                : requiresMfaVerify
                    ? <react_router_dom_1.Navigate to="/mfa-verify" replace/>
                    : <PrivateRoute_1.default requiredRoles={['EMPLOYEE', 'REVIEWER', 'MANAGER']}>
                    <DashboardLayout_1.default><DashboardPage_1.default /></DashboardLayout_1.default>
                  </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/dashboard/manager" element={
        // Manager Dashboard removed: keep redirect for old bookmarks
        <react_router_dom_1.Navigate to="/dashboard" replace/>}/>
        <react_router_dom_1.Route path="/dashboard/security" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredPath="dashboard/security" requiredRoles={['ADMIN']}>
                  <react_router_dom_1.Navigate to="/audit?blockchain=1" replace/>
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/dashboard/admin" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <DashboardLayout_1.default><AdminDashboardPage_1.default /></DashboardLayout_1.default>
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/change-password" element={requiresPasswordChangeWithMfaSetup
            ? <ChangePasswordPage_1.default />
            : requiresPeriodicPasswordChange
                ? <react_router_dom_1.Navigate to="/update-password" replace/>
                : (isAuthenticated ? <ChangePasswordPage_1.default /> : <react_router_dom_1.Navigate to="/login"/>)}/>
        <react_router_dom_1.Route path="/update-password" element={requiresPeriodicPasswordChange
            ? <PeriodicPasswordChangePage_1.default />
            : requiresPasswordChangeWithMfaSetup
                ? <react_router_dom_1.Navigate to="/change-password" replace/>
                : (isAuthenticated ? <PeriodicPasswordChangePage_1.default /> : <react_router_dom_1.Navigate to="/login"/>)}/>
        <react_router_dom_1.Route path="/mfa-setup" element={
        // Allow MFA setup page ONLY if:
        // 1. User is in store AND (needs MFA setup OR is rebinding)
        // This ensures the page works after refresh as long as the user session is valid.
        !!user
            ? <MfaSetupPage_1.default />
            : <react_router_dom_1.Navigate to="/login"/>}/>
        <react_router_dom_1.Route path="/me" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default>
                  <ProfilePage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/admin" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <AdminPage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/admin/users/:userId/edit" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <EditUserPage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/admin/recovery" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <DashboardLayout_1.default><RecoveryAccountsPage_1.default /></DashboardLayout_1.default>
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/admin/blockchain-health" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <BlockchainHealthPage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/admin/blocked-ips" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <BlockedIpsPage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/admin/watermark-traceback" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredPath="dashboard/admin" requiredRoles={['ADMIN']}>
                  <DashboardLayout_1.default><WatermarkTracebackPage_1.default /></DashboardLayout_1.default>
                </PrivateRoute_1.default>}/>

        {/* Document routes - EMPLOYEE and MANAGER only, not REVIEWER */}
        <react_router_dom_1.Route path="/documents" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredRoles={['EMPLOYEE', 'MANAGER']}>
                  <DocumentsPage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/upload" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredRoles={['EMPLOYEE', 'MANAGER']}>
                  <UploadPage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/upload/result/:jobId" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredRoles={['EMPLOYEE', 'MANAGER']}>
                  <UploadResultPage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/documents/:id" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredRoles={['EMPLOYEE', 'MANAGER']}>
                  <DocumentDetailPage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/documents/:documentId/signatures" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredRoles={['EMPLOYEE', 'MANAGER', 'REVIEWER', 'ADMIN']}>
                  <SignatureChainPage_1.default />
                </PrivateRoute_1.default>}/>

        {/* Workflow routes */}
        {/* Classification Review routes */}
        <react_router_dom_1.Route path="/classification/review" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredRoles={['REVIEWER', 'ADMIN']}>
                  <ClassificationReviewPage_1.default />
                </PrivateRoute_1.default>}/>

        {/* Audit Log routes */}
        <react_router_dom_1.Route path="/audit" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredRoles={['ADMIN']}>
                  <AuditLogPage_1.default />
                </PrivateRoute_1.default>}/>

        <react_router_dom_1.Route path="/notifications" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default>
                  <NotificationsPage_1.default />
                </PrivateRoute_1.default>}/>

        {/* EDR Console routes */}
        <react_router_dom_1.Route path="/edr" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredRoles={['ADMIN']}>
                  <EDRConsolePage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/edr/policies" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredRoles={['ADMIN']}>
                  <EDRPoliciesPage_1.default />
                </PrivateRoute_1.default>}/>

        {/* UEBA routes - admin only */}
        <react_router_dom_1.Route path="/ueba" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredPath="ueba" requiredRoles={['ADMIN']}>
                  <UebaDashboardPage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/ueba/users" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredRoles={['ADMIN']}>
                  <UebaUsersPage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/ueba/incidents" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredRoles={['ADMIN']}>
                  <UebaIncidentsPage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/ueba/policies" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default requiredRoles={['ADMIN']}>
                  <UebaPoliciesPage_1.default />
                </PrivateRoute_1.default>}/>

        <react_router_dom_1.Route path="/workflows" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default>
                  <WorkflowFormPage_1.default />
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="/my-shares" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath}/>
            : <PrivateRoute_1.default>
                  <MySharesPage_1.default />
                </PrivateRoute_1.default>}/>

        {/* Default dashboard landing */}
        <react_router_dom_1.Route path="/" element={requiresPasswordChange
            ? <react_router_dom_1.Navigate to={passwordChangeRedirectPath} replace/>
            : <PrivateRoute_1.default>
                  <react_router_dom_1.Navigate to={roleDefaultPath()} replace/>
                </PrivateRoute_1.default>}/>
        <react_router_dom_1.Route path="*" element={<react_router_dom_1.Navigate to={isAuthenticated
                ? (requiresPasswordChange ? passwordChangeRedirectPath : roleDefaultPath())
                : "/login"}/>}/>
      </react_router_dom_1.Routes>);
}
function App() {
    return (<react_router_dom_1.BrowserRouter>
      <MfaRedirect />
      <AccountStatusGuard />
      <AppRoutes />
    </react_router_dom_1.BrowserRouter>);
}
exports.default = App;
