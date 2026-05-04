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
exports.default = AdminPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var LLMTuningTab_1 = require("./LLMTuningTab");
var UebaTuningTab_1 = require("./UebaTuningTab");
var authStore_1 = require("../../store/authStore");
require("./AdminPage.css");
function AdminPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _a = (0, react_1.useState)('users'), activeTab = _a[0], setActiveTab = _a[1];
    var _b = (0, react_1.useState)([]), users = _b[0], setUsers = _b[1];
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(''), error = _d[0], setError = _d[1];
    var _e = (0, react_1.useState)(false), showCreateForm = _e[0], setShowCreateForm = _e[1];
    var _f = (0, react_1.useState)(false), showWipeModal = _f[0], setShowWipeModal = _f[1];
    var _g = (0, react_1.useState)(''), wipeConfirmText = _g[0], setWipeConfirmText = _g[1];
    var _h = (0, react_1.useState)(true), wipeDeleteFiles = _h[0], setWipeDeleteFiles = _h[1];
    var _j = (0, react_1.useState)(false), wiping = _j[0], setWiping = _j[1];
    var _k = (0, react_1.useState)(null), initialPassword = _k[0], setInitialPassword = _k[1];
    var _l = (0, react_1.useState)([]), departments = _l[0], setDepartments = _l[1];
    var _m = (0, react_1.useState)(''), accountIdPreview = _m[0], setAccountIdPreview = _m[1];
    var _o = (0, react_1.useState)(null), resettingUebaUserId = _o[0], setResettingUebaUserId = _o[1];
    var _p = (0, react_1.useState)(false), incidentRunning = _p[0], setIncidentRunning = _p[1];
    var _q = (0, react_1.useState)([]), pendingShareApprovals = _q[0], setPendingShareApprovals = _q[1];
    var _r = (0, react_1.useState)(0), pendingShareTotal = _r[0], setPendingShareTotal = _r[1];
    var _s = (0, react_1.useState)(false), pendingShareLoading = _s[0], setPendingShareLoading = _s[1];
    var _t = (0, react_1.useState)(null), approvingShareId = _t[0], setApprovingShareId = _t[1];
    var _u = (0, react_1.useState)(null), rejectingShareId = _u[0], setRejectingShareId = _u[1];
    var _v = (0, react_1.useState)(false), showRejectShareModal = _v[0], setShowRejectShareModal = _v[1];
    var _w = (0, react_1.useState)(null), rejectTargetShare = _w[0], setRejectTargetShare = _w[1];
    var _x = (0, react_1.useState)(''), rejectReason = _x[0], setRejectReason = _x[1];
    var _y = (0, react_1.useState)('CONFIDENTIAL'), rejectCorrectedLevel = _y[0], setRejectCorrectedLevel = _y[1];
    var _z = (0, react_1.useState)(''), userQuery = _z[0], setUserQuery = _z[1];
    var _0 = (0, react_1.useState)('ALL'), statusFilter = _0[0], setStatusFilter = _0[1];
    var _1 = (0, react_1.useState)('ALL'), roleFilter = _1[0], setRoleFilter = _1[1];
    var _2 = (0, react_1.useState)('blocked-ips'), securitySubTab = _2[0], setSecuritySubTab = _2[1];
    var _3 = (0, react_1.useState)({
        accountId: '',
        email: '',
        fullName: '',
        department: '',
        // Default to lowest-privilege business role
        roles: ['EMPLOYEE']
    }), formData = _3[0], setFormData = _3[1];
    (0, react_1.useEffect)(function () {
        loadUsers();
        loadDepartments();
        loadPendingShareApprovals();
    }, []);
    (0, react_1.useEffect)(function () {
        var dept = formData.department;
        var role = formData.roles[0] || 'EMPLOYEE';
        if (!dept || !role) {
            setAccountIdPreview('');
            setFormData(function (prev) { return (__assign(__assign({}, prev), { accountId: '' })); });
            return;
        }
        var t = window.setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
            var res, nextId_1, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, api_1.apiClient.getNextAccountId(dept, role)];
                    case 1:
                        res = _b.sent();
                        nextId_1 = res.data.accountId;
                        setAccountIdPreview(nextId_1);
                        setFormData(function (prev) { return (__assign(__assign({}, prev), { accountId: nextId_1 })); });
                        return [3 /*break*/, 3];
                    case 2:
                        _a = _b.sent();
                        setAccountIdPreview('');
                        setFormData(function (prev) { return (__assign(__assign({}, prev), { accountId: '' })); });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }, 250);
        return function () { return window.clearTimeout(t); };
    }, [formData.department, formData.roles]);
    var loadDepartments = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, api_1.apiClient.getDepartments()];
                case 1:
                    response = _a.sent();
                    setDepartments(response.data || []);
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    console.error('Failed to load departments:', err_1);
                    // Fallback to default departments if API fails
                    setDepartments(['IT Department', 'Finance', 'HR']);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var loadUsers = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, visibleUsers, err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getAllUsers()
                        // Filter out archived identities (archived_*) and logically deleted accounts (deletedAt is set)
                    ];
                case 2:
                    response = _c.sent();
                    visibleUsers = (response.data || []).filter(function (u) {
                        return !u.accountId.startsWith('archived_') && !u.deletedAt;
                    });
                    setUsers(visibleUsers);
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _c.sent();
                    setError(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load users');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var loadPendingShareApprovals = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, pageData, err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setPendingShareLoading(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getPendingShareApprovals(0, 8)];
                case 2:
                    response = _c.sent();
                    pageData = response.data || { content: [], totalElements: 0 };
                    setPendingShareApprovals(pageData.content || []);
                    setPendingShareTotal(pageData.totalElements || 0);
                    return [3 /*break*/, 5];
                case 3:
                    err_3 = _c.sent();
                    setError(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load pending share approvals');
                    setPendingShareApprovals([]);
                    setPendingShareTotal(0);
                    return [3 /*break*/, 5];
                case 4:
                    setPendingShareLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleCreateUser = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var response, err_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    e.preventDefault();
                    setError('');
                    setInitialPassword(null);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, api_1.apiClient.createUser(formData)
                        // Show initial password (ONE-TIME DISPLAY)
                    ];
                case 2:
                    response = _c.sent();
                    // Show initial password (ONE-TIME DISPLAY)
                    if (response.data.initialPassword) {
                        setInitialPassword(response.data.initialPassword);
                    }
                    // Reset form and reload users
                    setFormData({
                        accountId: '',
                        email: '',
                        fullName: '',
                        department: '',
                        roles: ['EMPLOYEE']
                    });
                    setAccountIdPreview('');
                    return [4 /*yield*/, loadUsers()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_4 = _c.sent();
                    setError(((_b = (_a = err_4.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to create user');
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleUnlock = function (userId) { return __awaiter(_this, void 0, void 0, function () {
        var err_5;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.unlockUser(userId)];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, loadUsers()];
                case 2:
                    _c.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_5 = _c.sent();
                    setError(((_b = (_a = err_5.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to unlock user');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleDisable = function (userId) { return __awaiter(_this, void 0, void 0, function () {
        var err_6;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm('Are you sure you want to disable this user?'))
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, api_1.apiClient.disableUser(userId)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, loadUsers()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_6 = _c.sent();
                    setError(((_b = (_a = err_6.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to disable user');
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleEnable = function (userId) { return __awaiter(_this, void 0, void 0, function () {
        var err_7;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.enableUser(userId)];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, loadUsers()];
                case 2:
                    _c.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_7 = _c.sent();
                    setError(((_b = (_a = err_7.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to enable user');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleIncidentWorkflow = function (user) { return __awaiter(_this, void 0, void 0, function () {
        var err_8;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm("Run incident workflow for ".concat(user.accountId, "?\n\nThis will revoke their encryption key, force a password change, and create a security alert."))) {
                        return [2 /*return*/];
                    }
                    setIncidentRunning(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, api_1.apiClient.adminRevokeForceResetAndAlert(user.id, "Incident workflow triggered for ".concat(user.accountId))];
                case 2:
                    _c.sent();
                    alert('Incident workflow executed:\n- Key revoked\n- Password change required\n- Security alert logged');
                    return [4 /*yield*/, loadUsers()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 6];
                case 4:
                    err_8 = _c.sent();
                    setError(((_b = (_a = err_8.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to execute incident workflow');
                    return [3 /*break*/, 6];
                case 5:
                    setIncidentRunning(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var handleResetPassword = function (userId) { return __awaiter(_this, void 0, void 0, function () {
        var response, err_9;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm('Are you sure you want to change this user\'s password?\n\nA new random temporary password will be generated and shown once, and the user must change it on next login.'))
                        return [2 /*return*/];
                    setError('');
                    setInitialPassword(null);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, api_1.apiClient.resetUserPassword(userId)
                        // Show temporary password (ONE-TIME DISPLAY)
                    ];
                case 2:
                    response = _c.sent();
                    // Show temporary password (ONE-TIME DISPLAY)
                    if (response.data.temporaryPassword) {
                        setInitialPassword(response.data.temporaryPassword);
                    }
                    return [4 /*yield*/, loadUsers()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_9 = _c.sent();
                    setError(((_b = (_a = err_9.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to reset password');
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleResetUebaScore = function (user) { return __awaiter(_this, void 0, void 0, function () {
        var shouldEnable, err_10;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    shouldEnable = !user.accountEnabled
                        ? confirm("User ".concat(user.accountId, " is disabled. Re-enable account while resetting UEBA score?"))
                        : false;
                    if (!confirm("Reset UEBA score to 100 for ".concat(user.accountId, "?")))
                        return [2 /*return*/];
                    setResettingUebaUserId(user.id);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, api_1.apiClient.resetUserUebaScore(user.id, shouldEnable)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, loadUsers()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 6];
                case 4:
                    err_10 = _c.sent();
                    setError(((_b = (_a = err_10.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to reset UEBA score for selected user');
                    return [3 /*break*/, 6];
                case 5:
                    setResettingUebaUserId(null);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var handleDelete = function (userId) { return __awaiter(_this, void 0, void 0, function () {
        var response, err_11, apiMessage, apiDetails, friendly;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!confirm('Are you sure you want to PERMANENTLY delete this user account?\n\nThe account must already be disabled. This operation cannot be undone.'))
                        return [2 /*return*/];
                    setError('');
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, api_1.apiClient.deleteUser(userId)
                        // If backend sends a specific message, show it
                    ];
                case 2:
                    response = _e.sent();
                    // If backend sends a specific message, show it
                    if (response.message) {
                        alert(response.message);
                    }
                    return [4 /*yield*/, loadUsers()];
                case 3:
                    _e.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_11 = _e.sent();
                    apiMessage = (_b = (_a = err_11.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message;
                    apiDetails = (_d = (_c = err_11.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.details;
                    friendly = apiDetails ||
                        apiMessage ||
                        'Failed to delete account. Make sure the user is disabled and not the last ADMIN.';
                    setError(friendly);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleRoleChange = function (role) {
        setFormData(function (prev) { return (__assign(__assign({}, prev), { roles: [role] })); });
    };
    var handleWipeDocuments = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_12;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    setError('');
                    setWiping(true);
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.wipeDocumentLibrary('WIPE_DOCUMENTS', wipeDeleteFiles)];
                case 2:
                    _e.sent();
                    alert('Document Library has been reset (database cleared'
                        + (wipeDeleteFiles ? ', uploads files deleted).' : ').'));
                    setShowWipeModal(false);
                    setWipeConfirmText('');
                    return [3 /*break*/, 5];
                case 3:
                    err_12 = _e.sent();
                    setError(((_b = (_a = err_12.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || ((_d = (_c = err_12.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) || 'Reset Document Library failed');
                    return [3 /*break*/, 5];
                case 4:
                    setWiping(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleApprovePendingShare = function (shareId) { return __awaiter(_this, void 0, void 0, function () {
        var err_13;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setApprovingShareId(shareId);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, api_1.apiClient.approveShareLink(shareId)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, loadPendingShareApprovals()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 6];
                case 4:
                    err_13 = _c.sent();
                    setError(((_b = (_a = err_13.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to approve share link');
                    return [3 /*break*/, 6];
                case 5:
                    setApprovingShareId(null);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var openRejectShareModal = function (share) {
        setRejectTargetShare(share);
        setRejectReason('');
        setRejectCorrectedLevel((share === null || share === void 0 ? void 0 : share.documentClassificationLevel) || 'CONFIDENTIAL');
        setShowRejectShareModal(true);
    };
    var handleRejectPendingShare = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_14;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!(rejectTargetShare === null || rejectTargetShare === void 0 ? void 0 : rejectTargetShare.id))
                        return [2 /*return*/];
                    setRejectingShareId(rejectTargetShare.id);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, api_1.apiClient.rejectShareLink(rejectTargetShare.id, {
                            reason: rejectReason || undefined,
                            correctedClassificationLevel: rejectCorrectedLevel
                        })];
                case 2:
                    _c.sent();
                    setShowRejectShareModal(false);
                    setRejectTargetShare(null);
                    return [4 /*yield*/, loadPendingShareApprovals()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 6];
                case 4:
                    err_14 = _c.sent();
                    setError(((_b = (_a = err_14.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to reject share link');
                    return [3 /*break*/, 6];
                case 5:
                    setRejectingShareId(null);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    if (loading) {
        return (<div className="container">
        <h2>Loading users...</h2>
      </div>);
    }
    var tabStyle = function (tab) { return ({
        padding: '10px 20px',
        border: 'none',
        borderBottom: activeTab === tab ? '3px solid #2196f3' : '3px solid transparent',
        background: activeTab === tab ? (theme === 'dark' ? '#333' : '#f0f7ff') : 'transparent',
        color: theme === 'dark' ? '#fff' : '#333',
        cursor: 'pointer',
        fontWeight: activeTab === tab ? 600 : 400,
        fontSize: '15px'
    }); };
    var rolesSet = Array.from(new Set(users.flatMap(function (u) { return u.roles || []; }))).sort();
    var filteredUsers = users.filter(function (u) {
        var _a, _b, _c, _d;
        var q = userQuery.trim().toLowerCase();
        var queryMatched = !q
            || ((_a = u.accountId) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(q))
            || ((_b = u.fullName) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(q))
            || ((_c = u.email) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes(q))
            || ((_d = u.department) === null || _d === void 0 ? void 0 : _d.toLowerCase().includes(q));
        var statusMatched = statusFilter === 'ALL'
            || (statusFilter === 'LOCKED' && u.accountLocked)
            || (statusFilter === 'DISABLED' && !u.accountEnabled)
            || (statusFilter === 'ACTIVE' && u.accountEnabled && !u.accountLocked);
        var roleMatched = roleFilter === 'ALL' || (u.roles || []).includes(roleFilter);
        return queryMatched && statusMatched && roleMatched;
    });
    var activeCount = users.filter(function (u) { return u.accountEnabled && !u.accountLocked; }).length;
    var lockedCount = users.filter(function (u) { return u.accountLocked; }).length;
    var disabledCount = users.filter(function (u) { return !u.accountEnabled; }).length;
    return (<div className="container admin-page-shell">
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Admin Panel</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={function () { return navigate('/admin/blockchain-health'); }}>
            Blockchain Health
          </button>
          <button onClick={function () { return navigate('/classification/review'); }}>
            Classification Review
          </button>
          <button onClick={function () { return navigate('/ueba/users'); }}>
            UEBA Users
          </button>
          <button onClick={function () { return navigate('/admin/blocked-ips'); }}>
            Blocked IPs
          </button>
          <button onClick={function () { return navigate('/dashboard/admin'); }}>
            Back to Dashboard
          </button>
        </div>
      </div>

      <div style={{
            marginBottom: '16px',
            padding: '12px 14px',
            borderRadius: '8px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#1f1f1f' : '#f8f9fa'
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600 }}>
            Pending Share Approvals ({pendingShareTotal})
          </div>
          <button onClick={loadPendingShareApprovals} disabled={pendingShareLoading} style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: 'none',
            background: pendingShareLoading ? '#999' : '#1976d2',
            color: '#fff',
            cursor: pendingShareLoading ? 'not-allowed' : 'pointer'
        }}>
            {pendingShareLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
          {pendingShareApprovals.length === 0 ? (<div style={{ fontSize: '13px', color: theme === 'dark' ? '#ccc' : '#666' }}>
              No pending share approvals.
            </div>) : (pendingShareApprovals.map(function (s) { return (<div key={s.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '10px',
                borderRadius: '6px',
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                border: "1px solid ".concat(theme === 'dark' ? '#3a3a3a' : '#eee')
            }}>
                <div style={{ fontSize: '13px' }}>
                  <div><strong>{s.documentName || "Document #".concat(s.documentId)}</strong></div>
                  <div style={{ color: theme === 'dark' ? '#ccc' : '#666' }}>
                    Creator: {s.creatorName || 'Unknown'} · Type: {s.shareType} · Permission: {s.permission}
                  </div>
                  <div style={{ color: theme === 'dark' ? '#ccc' : '#666' }}>
                    Current Level: {s.documentClassificationLevel || 'N/A'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={function () { return openRejectShareModal(s); }} style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                background: '#c62828',
                color: '#fff',
                cursor: 'pointer'
            }}>
                    Reject
                  </button>
                  <button onClick={function () { return handleApprovePendingShare(s.id); }} disabled={approvingShareId === s.id} style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                background: '#2e7d32',
                color: '#fff',
                cursor: approvingShareId === s.id ? 'not-allowed' : 'pointer'
            }}>
                    {approvingShareId === s.id ? 'Approving...' : 'Approve'}
                  </button>
                </div>
              </div>); }))}
        </div>
      </div>

      <div style={{
            display: 'flex',
            gap: '4px',
            borderBottom: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            marginBottom: '20px'
        }}>
        <button type="button" style={tabStyle('users')} onClick={function () { return setActiveTab('users'); }}>
          Users &amp; Orgs
        </button>
        <button type="button" style={tabStyle('llm')} onClick={function () { return setActiveTab('llm'); }}>
          LLM Tuning
        </button>
        <button type="button" style={tabStyle('ueba')} onClick={function () { return setActiveTab('ueba'); }}>
          UEBA Tuning
        </button>
        <button type="button" style={tabStyle('security')} onClick={function () { setActiveTab('security'); setSecuritySubTab('blocked-ips'); }}>
          Security
        </button>
      </div>

      {activeTab === 'security' && (<div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
            <button type="button" onClick={function () { return setSecuritySubTab('blocked-ips'); }} style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: securitySubTab === 'blocked-ips' ? '2px solid #dc3545' : '2px solid transparent',
                background: 'transparent',
                color: securitySubTab === 'blocked-ips' ? '#dc3545' : '#666',
                cursor: 'pointer',
                fontWeight: securitySubTab === 'blocked-ips' ? 600 : 400,
                fontSize: '14px'
            }}>
              Blocked IPs
            </button>
          </div>
          {securitySubTab === 'blocked-ips' && <BlockedIpsEmbed />}
        </div>)}

      {activeTab === 'llm' && <LLMTuningTab_1.default />}

      {activeTab === 'ueba' && <UebaTuningTab_1.default />}

      {activeTab === 'users' && (<>
      <div className="admin-summary-grid">
        <div className="admin-summary-card">
          <div className="admin-summary-label">Total Users</div>
          <div className="admin-summary-value">{users.length}</div>
        </div>
        <div className="admin-summary-card">
          <div className="admin-summary-label">Active</div>
          <div className="admin-summary-value" style={{ color: '#2e7d32' }}>{activeCount}</div>
        </div>
        <div className="admin-summary-card">
          <div className="admin-summary-label">Locked</div>
          <div className="admin-summary-value" style={{ color: '#c62828' }}>{lockedCount}</div>
        </div>
        <div className="admin-summary-card">
          <div className="admin-summary-label">Disabled</div>
          <div className="admin-summary-value" style={{ color: '#ef6c00' }}>{disabledCount}</div>
        </div>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>User Management</h2>
        <div>
          <button onClick={function () { return setShowWipeModal(true); }} style={{
                marginRight: '10px',
                background: '#dc3545',
                color: '#fff',
                border: 'none'
            }}>
            Reset Document Library
          </button>
          <button onClick={function () { return setShowCreateForm(!showCreateForm); }} className="primary">
            {showCreateForm ? 'Cancel' : 'Create New User'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Reset Document Library Modal */}
      {showWipeModal && (<div className="modal-overlay" onClick={function () { return !wiping && setShowWipeModal(false); }}>
          <div className="modal-content" onClick={function (e) { return e.stopPropagation(); }} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>Reset Document Library</h2>
              <button className="modal-close" onClick={function () { return !wiping && setShowWipeModal(false); }}>&times;</button>
            </div>

            <div className="modal-body">
              <div style={{ padding: '12px', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '8px' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px', color: '#856404' }}>
                  ⚠️ Dangerous operation (cannot be undone)
                </div>
                <div style={{ fontSize: '13px', color: '#856404', lineHeight: 1.5 }}>
                  This will remove all document-related data (documents / signatures / share links / upload jobs / workflow tasks, etc.).
                  {wipeDeleteFiles ? ' It will also delete files in the uploads folder.' : ' (Uploads files will be kept.)'}
                </div>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="checkbox" checked={wipeDeleteFiles} onChange={function (e) { return setWipeDeleteFiles(e.target.checked); }} disabled={wiping}/>
                  Also delete uploads files (deleteFiles=true)
                </label>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700 }}>
                  Type <span style={{ fontFamily: 'monospace' }}>WIPE_DOCUMENTS</span> to confirm
                </label>
                <input type="text" value={wipeConfirmText} onChange={function (e) { return setWipeConfirmText(e.target.value); }} disabled={wiping} placeholder="WIPE_DOCUMENTS"/>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={function () { return !wiping && setShowWipeModal(false); }} disabled={wiping}>
                Cancel
              </button>
              <button className="primary" onClick={handleWipeDocuments} disabled={wiping || wipeConfirmText !== 'WIPE_DOCUMENTS'} style={{ background: '#dc3545' }}>
                {wiping ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>)}

      {/* Initial/Temporary Password Display (ONE-TIME ONLY) */}
      {initialPassword && (<div style={{
                    padding: '20px',
                    background: '#fff3cd',
                    border: '2px solid #ffc107',
                    borderRadius: '8px',
                    marginBottom: '20px'
                }}>
          <h3 style={{ marginTop: 0, color: '#856404' }}>⚠️ IMPORTANT: Save This Password</h3>
          <p style={{ marginBottom: '10px' }}>
            The temporary password is shown below. <strong>This will only be displayed once.</strong>
          </p>
          <div style={{
                    padding: '15px',
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    letterSpacing: '1px',
                    textAlign: 'center'
                }}>
            {initialPassword}
          </div>
          <button onClick={function () { return __awaiter(_this, void 0, void 0, function () {
                    var err_15, textarea;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, navigator.clipboard.writeText(initialPassword)];
                            case 1:
                                _a.sent();
                                alert('Password copied to clipboard!');
                                return [3 /*break*/, 3];
                            case 2:
                                err_15 = _a.sent();
                                textarea = document.createElement('textarea');
                                textarea.value = initialPassword;
                                textarea.style.position = 'fixed';
                                textarea.style.opacity = '0';
                                document.body.appendChild(textarea);
                                textarea.select();
                                try {
                                    document.execCommand('copy');
                                }
                                catch (_b) { }
                                document.body.removeChild(textarea);
                                alert('Password copied to clipboard!');
                                return [3 /*break*/, 3];
                            case 3: return [2 /*return*/];
                        }
                    });
                }); }} style={{ marginTop: '10px' }} className="primary">
            Copy to Clipboard
          </button>
          <button onClick={function () { return setInitialPassword(null); }} style={{ marginTop: '10px', marginLeft: '10px' }}>
            Clear (I've saved it)
          </button>
        </div>)}

      {/* Create User Form */}
      {showCreateForm && (<div style={{
                    padding: '20px',
                    background: '#f8f9fa',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    marginBottom: '20px'
                }}>
          <h2>Create New User</h2>
          <form onSubmit={handleCreateUser}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label>Account ID (auto-generated)</label>
                <input type="text" value={formData.accountId} readOnly placeholder="Will be generated after selecting Department + Role"/>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                  Format: <strong>DEPT_ROLE_YEAR_SEQ</strong> (e.g., <strong>IT_EM_2026_001</strong>)
                  {accountIdPreview ? (<> • Next ID: <strong>{accountIdPreview}</strong></>) : null}
                </div>
              </div>
              <div>
                <label>Email *</label>
                <input type="email" value={formData.email} onChange={function (e) { return setFormData(__assign(__assign({}, formData), { email: e.target.value })); }} required placeholder="e.g., john.doe@company.com"/>
              </div>
              <div>
                <label>Full Name *</label>
                <input type="text" value={formData.fullName} onChange={function (e) { return setFormData(__assign(__assign({}, formData), { fullName: e.target.value })); }} required placeholder="e.g., John Doe"/>
              </div>
              <div>
                <label>Department *</label>
                <select value={formData.department} onChange={function (e) { return setFormData(__assign(__assign({}, formData), { department: e.target.value })); }} required style={{
                    padding: '8px',
                    width: '100%',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                }}>
                  <option value="">Select department</option>
                  {departments.map(function (dept) { return (<option key={dept} value={dept}>{dept}</option>); })}
                </select>
              </div>
              <div>
                <label>Role *</label>
                <select value={formData.roles[0] || 'EMPLOYEE'} onChange={function (e) { return handleRoleChange(e.target.value); }} required style={{
                    padding: '8px',
                    width: '100%',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                }}>
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="REVIEWER">REVIEWER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: '20px' }}>
              <button type="submit" className="primary">Create User</button>
              <button type="button" onClick={function () { return setShowCreateForm(false); }} style={{ marginLeft: '10px' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>)}

      {/* Users Table */}
      <div className="admin-users-filter-row">
        <input type="text" value={userQuery} onChange={function (e) { return setUserQuery(e.target.value); }} placeholder="Search account / name / email / department" className="admin-users-search"/>
        <select value={statusFilter} onChange={function (e) { return setStatusFilter(e.target.value); }} className="admin-users-select">
          <option value="ALL">All status</option>
          <option value="ACTIVE">Active</option>
          <option value="LOCKED">Locked</option>
          <option value="DISABLED">Disabled</option>
        </select>
        <select value={roleFilter} onChange={function (e) { return setRoleFilter(e.target.value); }} className="admin-users-select">
          <option value="ALL">All roles</option>
          {rolesSet.map(function (r) { return <option key={r} value={r}>{r}</option>; })}
        </select>
      </div>
      <div style={{ marginBottom: '12px', color: '#555', fontSize: '0.9em' }}>
        Showing {filteredUsers.length} / {users.length} users. Built-in `admin` is visible for auditing; profile edit is restricted but password reset is allowed.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-users-table">
          <thead>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left' }}>Account ID</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Full Name</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Department</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Roles</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>MFA</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(function (user, idx) {
                var isBuiltInAdmin = user.accountId === 'admin';
                return (<tr key={user.id} className={idx % 2 === 0 ? 'admin-users-row-even' : 'admin-users-row-odd'}>
                <td style={{ padding: '12px' }}>{user.accountId}</td>
                <td style={{ padding: '12px' }}>{user.fullName}</td>
                <td style={{ padding: '12px' }}>{user.email}</td>
                <td style={{ padding: '12px' }}>{user.department}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                        padding: '4px 8px',
                        background: user.roles.includes('ADMIN') ? '#ffc107' : '#28a745',
                        color: '#fff',
                        borderRadius: '4px',
                        fontSize: '12px'
                    }}>
                    {user.roles.join(', ')}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {user.mfaEnabled ? '✓' : '✗'}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {user.accountLocked ? (<span className="admin-status-pill admin-status-locked">Locked</span>) : !user.accountEnabled ? (<span className="admin-status-pill admin-status-disabled">Disabled</span>) : (<span className="admin-status-pill admin-status-active">Active</span>)}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button onClick={function () { return navigate("/admin/users/".concat(user.id, "/edit")); }} disabled={isBuiltInAdmin} style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        marginRight: '5px',
                        background: isBuiltInAdmin ? '#ccc' : '#6c757d',
                        color: isBuiltInAdmin ? '#666' : '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isBuiltInAdmin ? 'not-allowed' : 'pointer'
                    }}>
                    Edit
                  </button>
                  {user.accountLocked && !isBuiltInAdmin && (<button onClick={function () { return handleUnlock(user.id); }} style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            marginRight: '5px',
                            background: '#28a745',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}>
                      Unlock
                    </button>)}
                  {user.accountEnabled ? (<button onClick={function () { return handleDisable(user.id); }} style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            marginRight: '5px',
                            background: '#dc3545',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}>
                      Disable
                    </button>) : (<button onClick={function () { return handleEnable(user.id); }} style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            marginRight: '5px',
                            background: '#007bff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}>
                      Enable
                    </button>)}
                  <button onClick={function () { return handleResetPassword(user.id); }} style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        marginRight: '5px',
                        background: '#ffc107',
                        color: '#000',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                    Change Password
                  </button>
                  {!isBuiltInAdmin && (<button onClick={function () { return handleResetUebaScore(user); }} disabled={resettingUebaUserId === user.id} title="Reset UEBA score to 100" style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            marginRight: '5px',
                            background: '#6f42c1',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: resettingUebaUserId === user.id ? 'not-allowed' : 'pointer'
                        }}>
                      {resettingUebaUserId === user.id ? 'Resetting UEBA...' : 'Reset UEBA'}
                    </button>)}
                  {!isBuiltInAdmin && (<button onClick={function () { return handleIncidentWorkflow(user); }} title="Revoke key + force password change + security alert" disabled={incidentRunning} style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            marginRight: '5px',
                            background: '#c82333',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: incidentRunning ? 'wait' : 'pointer'
                        }}>
                      Incident: Revoke+Reset
                    </button>)}
                  {!user.accountEnabled && !isBuiltInAdmin && (<button onClick={function () { return handleDelete(user.id); }} style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            background: '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}>
                      Delete
                    </button>)}
                </td>
              </tr>);
            })}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (<div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          No users match current filters.
        </div>)}

      {showRejectShareModal && rejectTargetShare && (<div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
          <div style={{
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    padding: 24,
                    borderRadius: 8,
                    maxWidth: 520,
                    width: '100%'
                }}>
            <h3 style={{ marginTop: 0 }}>Reject Share Approval</h3>
            <p>
              Document <strong>{rejectTargetShare.documentName || "#".concat(rejectTargetShare.documentId)}</strong>
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6 }}>Correct classification level</label>
              <select value={rejectCorrectedLevel} onChange={function (e) { return setRejectCorrectedLevel(e.target.value); }} style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}>
                <option value="PUBLIC">PUBLIC</option>
                <option value="INTERNAL">INTERNAL</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                <option value="STRICTLY_CONFIDENTIAL">STRICTLY_CONFIDENTIAL</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6 }}>Reject reason (optional)</label>
              <input type="text" value={rejectReason} onChange={function (e) { return setRejectReason(e.target.value); }} placeholder="e.g. External sharing policy not satisfied" style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}/>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={function () { setShowRejectShareModal(false); setRejectTargetShare(null); }} disabled={rejectingShareId === rejectTargetShare.id}>
                Cancel
              </button>
              <button type="button" onClick={handleRejectPendingShare} disabled={rejectingShareId === rejectTargetShare.id} style={{ background: '#c62828', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: rejectingShareId === rejectTargetShare.id ? 'wait' : 'pointer' }}>
                {rejectingShareId === rejectTargetShare.id ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>)}
        </>)}
    </div>);
}
// Embedded Blocked IPs component for Admin Security tab
function BlockedIpsEmbed() {
    var _this = this;
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _a = (0, react_1.useState)([]), blockedIps = _a[0], setBlockedIps = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(null), unblocking = _d[0], setUnblocking = _d[1];
    var _e = (0, react_1.useState)(false), showBlockForm = _e[0], setShowBlockForm = _e[1];
    var _f = (0, react_1.useState)(''), newBlockIp = _f[0], setNewBlockIp = _f[1];
    var _g = (0, react_1.useState)(''), newBlockReason = _g[0], setNewBlockReason = _g[1];
    var _h = (0, react_1.useState)(false), blocking = _h[0], setBlocking = _h[1];
    (0, react_1.useEffect)(function () {
        load();
    }, []);
    var load = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, ips, list, err_16;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getBlockedIps()];
                case 2:
                    res = _d.sent();
                    ips = (_a = res.data) === null || _a === void 0 ? void 0 : _a.blockedIps;
                    if (ips) {
                        list = Object.values(ips);
                        list.sort(function (a, b) { return new Date(b.blockedAt).getTime() - new Date(a.blockedAt).getTime(); });
                        setBlockedIps(list);
                    }
                    else {
                        setBlockedIps([]);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_16 = _d.sent();
                    setError(((_c = (_b = err_16.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to load blocked IPs');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleUnblock = function (ipAddress) { return __awaiter(_this, void 0, void 0, function () {
        var err_17;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm("Unblock IP address ".concat(ipAddress, "?")))
                        return [2 /*return*/];
                    setUnblocking(ipAddress);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.unblockIp(ipAddress)];
                case 2:
                    _c.sent();
                    alert("IP ".concat(ipAddress, " has been unblocked"));
                    load();
                    return [3 /*break*/, 5];
                case 3:
                    err_17 = _c.sent();
                    alert(((_b = (_a = err_17.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to unblock IP');
                    return [3 /*break*/, 5];
                case 4:
                    setUnblocking(null);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleUnblockAll = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, err_18;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (blockedIps.length === 0) {
                        alert('No blocked IPs to unblock');
                        return [2 /*return*/];
                    }
                    if (!confirm("Unblock ALL ".concat(blockedIps.length, " IP address(es)?")))
                        return [2 /*return*/];
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.unblockAllIps()];
                case 2:
                    res = _d.sent();
                    alert(((_a = res.data) === null || _a === void 0 ? void 0 : _a.message) || "Unblocked ".concat(blockedIps.length, " IP(s)"));
                    load();
                    return [3 /*break*/, 4];
                case 3:
                    err_18 = _d.sent();
                    alert(((_c = (_b = err_18.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to unblock IPs');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleBlockIp = function () { return __awaiter(_this, void 0, void 0, function () {
        var ipv4Regex, ipv6Regex, localhostRegex, err_19;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!newBlockIp.trim()) {
                        alert('Please enter an IP address');
                        return [2 /*return*/];
                    }
                    ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
                    ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
                    localhostRegex = /^localhost$/i;
                    if (!ipv4Regex.test(newBlockIp.trim()) && !ipv6Regex.test(newBlockIp.trim()) && !localhostRegex.test(newBlockIp.trim())) {
                        alert('Please enter a valid IP address (e.g., 192.168.1.1)');
                        return [2 /*return*/];
                    }
                    setBlocking(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.blockIp(newBlockIp.trim(), newBlockReason.trim() || 'Manual block by admin')];
                case 2:
                    _c.sent();
                    alert("IP ".concat(newBlockIp, " has been blocked"));
                    setNewBlockIp('');
                    setNewBlockReason('');
                    setShowBlockForm(false);
                    load();
                    return [3 /*break*/, 5];
                case 3:
                    err_19 = _c.sent();
                    alert(((_b = (_a = err_19.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to block IP');
                    return [3 /*break*/, 5];
                case 4:
                    setBlocking(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var cardStyle = function (isAlt) { return ({
        background: isAlt
            ? (theme === 'dark' ? '#1e1e1e' : '#fff')
            : (theme === 'dark' ? '#222' : '#f8f9fa'),
        borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#eee')
    }); };
    return (<div>
      {error && <div style={{ padding: '12px 16px', marginBottom: '16px', background: '#ffebee', color: '#c62828', borderRadius: '6px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={load} disabled={loading} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: theme === 'dark' ? '#333' : '#e0e0e0', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button onClick={handleUnblockAll} disabled={loading || blockedIps.length === 0} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: blockedIps.length === 0 ? '#ccc' : '#dc3545', color: '#fff', cursor: blockedIps.length === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
          Unblock All ({blockedIps.length})
        </button>
        <button onClick={function () { return setShowBlockForm(!showBlockForm); }} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: showBlockForm ? '#6c757d' : '#28a745', color: '#fff', cursor: 'pointer', fontSize: '14px' }}>
          {showBlockForm ? 'Cancel' : '+ Block IP Manually'}
        </button>
      </div>

      {showBlockForm && (<div style={{
                padding: '16px',
                marginBottom: '16px',
                background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#dee2e6'),
                borderRadius: '8px',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'flex-end'
            }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#888' }}>IP Address *</label>
            <input type="text" value={newBlockIp} onChange={function (e) { return setNewBlockIp(e.target.value); }} placeholder="e.g. 192.168.1.1" style={{ padding: '8px 12px', border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ccc'), borderRadius: '6px', background: theme === 'dark' ? '#1a1a1a' : '#fff', color: theme === 'dark' ? '#fff' : '#000', width: '180px', fontSize: '14px' }}/>
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#888' }}>Reason (optional)</label>
            <input type="text" value={newBlockReason} onChange={function (e) { return setNewBlockReason(e.target.value); }} placeholder="Reason for blocking" style={{ padding: '8px 12px', border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ccc'), borderRadius: '6px', background: theme === 'dark' ? '#1a1a1a' : '#fff', color: theme === 'dark' ? '#fff' : '#000', width: '100%', fontSize: '14px' }}/>
          </div>
          <button onClick={handleBlockIp} disabled={blocking || !newBlockIp.trim()} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: blocking ? '#6c757d' : '#dc3545', color: '#fff', cursor: blocking ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600 }}>
            {blocking ? 'Blocking...' : 'Block IP'}
          </button>
        </div>)}

      {loading && blockedIps.length === 0 ? (<div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>Loading...</div>) : blockedIps.length === 0 ? (<div style={{ textAlign: 'center', padding: '32px', background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa', borderRadius: '8px', color: '#888' }}>
          No blocked IPs.
        </div>) : (<div style={{ overflowX: 'auto', borderRadius: '8px', border: "1px solid ".concat(theme === 'dark' ? '#333' : '#dee2e6') }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#dee2e6') }}>IP Address</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#dee2e6') }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#dee2e6') }}>Level</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#dee2e6') }}>Frozen Until</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#888', borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#dee2e6') }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {blockedIps.length === 0 ? (<tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                    No blocked IPs
                  </td>
                </tr>) : blockedIps.map(function (ip, index) { return (<tr key={ip.ipAddress} style={cardStyle(index % 2 === 1)}>
                  <td style={{ padding: '10px 14px', fontSize: '14px' }}>
                    <code style={{ padding: '2px 6px', background: theme === 'dark' ? '#333' : '#eee', borderRadius: '4px', fontFamily: 'monospace' }}>{ip.ipAddress}</code>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '14px' }}>
                    <span style={{
                    padding: '4px 10px',
                    background: ip.blocked ? '#dc354520' : '#fd7e1420',
                    color: ip.blocked ? '#dc3545' : '#fd7e14',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600
                }}>
                      {ip.status || (ip.blocked ? 'PERMANENTLY BLOCKED' : 'FROZEN')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '14px', color: '#666' }}>
                    {ip.freezeLevelDescription}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '14px' }}>
                    {ip.frozenUntil ? (<span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {ip.frozenUntil}
                      </span>) : ip.blockedAt ? (<span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {ip.blockedAt}
                      </span>) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button onClick={function () { return handleUnblock(ip.ipAddress); }} disabled={unblocking === ip.ipAddress} style={{ padding: '6px 14px', borderRadius: '4px', border: 'none', background: unblocking === ip.ipAddress ? '#6c757d' : '#28a745', color: '#fff', cursor: unblocking === ip.ipAddress ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                      {unblocking === ip.ipAddress ? '...' : 'Unblock'}
                    </button>
                  </td>
                </tr>); })}
            </tbody>
          </table>
        </div>)}
    </div>);
}
