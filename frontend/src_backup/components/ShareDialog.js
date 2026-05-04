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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ShareDialog;
var react_1 = require("react");
var api_1 = require("../api");
var authStore_1 = require("../store/authStore");
require("../modal.css");
function ExistingSharesTab(_a) {
    var _this = this;
    var _documentId = _a.documentId, existingShares = _a.existingShares, loadExistingShares = _a.loadExistingShares, handleRevokeShare = _a.handleRevokeShare, _onClose = _a.onClose;
    var user = (0, authStore_1.useAuthStore)().user;
    var _b = (0, react_1.useState)(''), recipientSearch = _b[0], setRecipientSearch = _b[1];
    var _c = (0, react_1.useState)([]), recipientSuggestions = _c[0], setRecipientSuggestions = _c[1];
    var _d = (0, react_1.useState)(false), recipientSearching = _d[0], setRecipientSearching = _d[1];
    var _e = (0, react_1.useState)(null), addingToShareId = _e[0], setAddingToShareId = _e[1];
    var _f = (0, react_1.useState)(null), updatingShareId = _f[0], setUpdatingShareId = _f[1];
    (0, react_1.useEffect)(function () {
        var q = recipientSearch.trim();
        if (q.length < 2) {
            setRecipientSuggestions([]);
            return;
        }
        var t = window.setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
            var res, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        setRecipientSearching(true);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, api_1.apiClient.searchUsers(q, 10)];
                    case 2:
                        res = _b.sent();
                        setRecipientSuggestions((res.data || []).filter(function (u) { return u.id !== (user === null || user === void 0 ? void 0 : user.userId); }));
                        return [3 /*break*/, 5];
                    case 3:
                        _a = _b.sent();
                        setRecipientSuggestions([]);
                        return [3 /*break*/, 5];
                    case 4:
                        setRecipientSearching(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); }, 250);
        return function () { return window.clearTimeout(t); };
    }, [recipientSearch, user === null || user === void 0 ? void 0 : user.userId]);
    var handleAddRecipient = function (shareId, userId) { return __awaiter(_this, void 0, void 0, function () {
        var err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setAddingToShareId(shareId);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.updateShareRecipients(shareId, { addRecipientIds: [userId] })];
                case 2:
                    _c.sent();
                    loadExistingShares();
                    setRecipientSearch('');
                    setRecipientSuggestions([]);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    alert(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to add recipient');
                    return [3 /*break*/, 5];
                case 4:
                    setAddingToShareId(null);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleRemoveRecipient = function (shareId, userId) { return __awaiter(_this, void 0, void 0, function () {
        var err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm('Remove this person from the share?'))
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.updateShareRecipients(shareId, { removeRecipientIds: [userId] })];
                case 2:
                    _c.sent();
                    loadExistingShares();
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _c.sent();
                    alert(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to remove recipient');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleUpdatePermission = function (shareId, permission) { return __awaiter(_this, void 0, void 0, function () {
        var err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setUpdatingShareId(shareId);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.updateShare(shareId, { permission: permission })];
                case 2:
                    _c.sent();
                    loadExistingShares();
                    return [3 /*break*/, 5];
                case 3:
                    err_3 = _c.sent();
                    alert(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to update permission');
                    return [3 /*break*/, 5];
                case 4:
                    setUpdatingShareId(null);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    if (existingShares.length === 0) {
        return (<div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
        No shares found for this document. Use &quot;Internal Share&quot; to create one.
      </div>);
    }
    return (<div style={{ maxHeight: '500px', overflowY: 'auto' }}>
      {existingShares.map(function (share) { return (<div key={share.id} style={{
                padding: '15px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                marginBottom: '12px',
                background: '#fafafa'
            }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <strong>INTERNAL</strong>
              <span style={{ marginLeft: '10px', color: '#666' }}>{share.permission}</span>
            </div>
            <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                background: share.status === 'ACTIVE' ? '#d4edda' : '#f8d7da',
                color: share.status === 'ACTIVE' ? '#155724' : '#721c24'
            }}>
              {share.status}
            </span>
          </div>

          {/* Internal shares only - show recipients list */}
          <div style={{ marginBottom: '12px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Shared with:</div>
              {(share.recipients || []).length === 0 ? (<div style={{ fontSize: '13px', color: '#666' }}>No recipients</div>) : (<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(share.recipients || []).map(function (r) { return (<span key={r.userId} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: '#e3f2fd',
                        fontSize: '13px'
                    }}>
                      {r.fullName} ({r.accountId})
                      {r.department && <span style={{ color: '#666' }}>• {r.department}</span>}
                      {share.status === 'ACTIVE' && (<button type="button" onClick={function () { return handleRemoveRecipient(share.id, r.userId); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#d32f2f', fontWeight: 700 }} title="Remove">
                          ×
                        </button>)}
                    </span>); })}
                </div>)}

              {share.status === 'ACTIVE' && (<div style={{ marginTop: '10px' }}>
                  {addingToShareId === share.id ? (<>
                      <input type="text" placeholder="Search by name or account ID..." value={recipientSearch} onChange={function (e) { return setRecipientSearch(e.target.value); }} autoFocus style={{ width: '100%', padding: '8px', marginBottom: '6px' }}/>
                      <button type="button" onClick={function () { setAddingToShareId(null); setRecipientSearch(''); setRecipientSuggestions([]); }} style={{ fontSize: '12px', marginBottom: '8px' }}>
                        Cancel
                      </button>
                      {recipientSearching && <div style={{ fontSize: '12px', color: '#666' }}>Searching...</div>}
                      {recipientSuggestions.length > 0 && (<div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '4px', padding: '6px' }}>
                          {recipientSuggestions
                            .filter(function (u) { return !(share.recipients || []).some(function (r) { return r.userId === u.id; }); })
                            .map(function (u) { return (<button key={u.id} type="button" onClick={function () { return handleAddRecipient(share.id, u.id); }} style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '6px 8px',
                                border: '1px solid #eee',
                                borderRadius: '4px',
                                marginBottom: '4px',
                                background: '#fff',
                                cursor: 'pointer',
                                fontSize: '13px'
                            }}>
                                {u.fullName} ({u.accountId}) • {u.department || '—'}
                              </button>); })}
                        </div>)}
                    </>) : (<button type="button" onClick={function () { return setAddingToShareId(share.id); }} style={{ padding: '6px 12px', fontSize: '13px', background: '#e3f2fd', color: '#1976d2', border: '1px solid #90caf9', borderRadius: '4px', cursor: 'pointer' }}>
                      + Add recipient
                    </button>)}
                </div>)}

              {share.status === 'ACTIVE' && (<div style={{ marginTop: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Permission: </label>
                  <select value={share.permission} onChange={function (e) { return handleUpdatePermission(share.id, e.target.value); }} disabled={updatingShareId === share.id} style={{ padding: '6px 10px', marginLeft: '8px', borderRadius: '4px' }}>
                    <option value="READ_ONLY">Read Only</option>
                    <option value="DOWNLOAD">Download</option>
                    <option value="EDIT">Edit</option>
                    <option value="FULL">Full Access</option>
                  </select>
                </div>)}
            </div>

          <div style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
            Created: {new Date(share.createdAt).toLocaleString()}
            {share.expiresAt && <> • Expires: {new Date(share.expiresAt).toLocaleString()}</>}
            {share.accessCount !== undefined && <> • Accessed: {share.accessCount} times</>}
            {share.requiresApproval && <> • {share.approvalGranted ? 'Approved' : 'Pending Approval'}</>}
          </div>

          {share.status === 'ACTIVE' && (<button onClick={function () { return handleRevokeShare(share.id); }} className="secondary" style={{ fontSize: '14px', padding: '6px 12px' }}>
              Revoke
            </button>)}
        </div>); })}
    </div>);
}
function ShareDialog(_a) {
    var _this = this;
    var documentId = _a.documentId, documentName = _a.documentName, onClose = _a.onClose, onSuccess = _a.onSuccess, _b = _a.initialTab, initialTab = _b === void 0 ? 'internal' : _b;
    var user = (0, authStore_1.useAuthStore)().user;
    var _c = (0, react_1.useState)(initialTab), activeTab = _c[0], setActiveTab = _c[1];
    (0, react_1.useEffect)(function () {
        if (initialTab)
            setActiveTab(initialTab);
    }, [initialTab]);
    // Form state
    // Share type is always INTERNAL (external sharing disabled)
    var _d = (0, react_1.useState)('READ_ONLY'), permission = _d[0], setPermission = _d[1];
    var _e = (0, react_1.useState)(''), recipientSearch = _e[0], setRecipientSearch = _e[1];
    var _f = (0, react_1.useState)([]), selectedRecipients = _f[0], setSelectedRecipients = _f[1];
    var _g = (0, react_1.useState)([]), selectedRecipientUsers = _g[0], setSelectedRecipientUsers = _g[1];
    var _h = (0, react_1.useState)([]), recipientSuggestions = _h[0], setRecipientSuggestions = _h[1];
    var _j = (0, react_1.useState)(false), recipientSearching = _j[0], setRecipientSearching = _j[1];
    // Internal share settings
    var _k = (0, react_1.useState)(''), description = _k[0], setDescription = _k[1];
    // Existing shares
    var _l = (0, react_1.useState)([]), existingShares = _l[0], setExistingShares = _l[1];
    // UI state
    var _m = (0, react_1.useState)(false), loading = _m[0], setLoading = _m[1];
    var _o = (0, react_1.useState)(''), error = _o[0], setError = _o[1];
    var _p = (0, react_1.useState)(false), success = _p[0], setSuccess = _p[1];
    var _q = (0, react_1.useState)(false), requiresApproval = _q[0], setRequiresApproval = _q[1];
    (0, react_1.useEffect)(function () {
        if (activeTab === 'internal') {
            // reset search UI when switching to internal tab
            setRecipientSearch('');
            setRecipientSuggestions([]);
        }
        else if (activeTab === 'existing') {
            loadExistingShares();
        }
    }, [activeTab]);
    // Realtime recipient search (server-side)
    (0, react_1.useEffect)(function () {
        if (activeTab !== 'internal')
            return;
        var q = recipientSearch.trim();
        if (q.length < 2) {
            setRecipientSuggestions([]);
            return;
        }
        var t = window.setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
            var res, users, err_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setRecipientSearching(true);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, api_1.apiClient.searchUsers(q, 10)];
                    case 2:
                        res = _a.sent();
                        users = (res.data || []).filter(function (u) { return u.id !== (user === null || user === void 0 ? void 0 : user.userId); });
                        setRecipientSuggestions(users);
                        return [3 /*break*/, 5];
                    case 3:
                        err_4 = _a.sent();
                        // fail silently for suggestions; sharing endpoint will still validate recipients
                        setRecipientSuggestions([]);
                        return [3 /*break*/, 5];
                    case 4:
                        setRecipientSearching(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); }, 250);
        return function () { return window.clearTimeout(t); };
    }, [recipientSearch, activeTab, user === null || user === void 0 ? void 0 : user.userId]);
    var loadExistingShares = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, err_5;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, api_1.apiClient.getDocumentShares(documentId)];
                case 1:
                    response = _c.sent();
                    setExistingShares(response.data || []);
                    return [3 /*break*/, 3];
                case 2:
                    err_5 = _c.sent();
                    setError(((_b = (_a = err_5.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load shares');
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var handleShare = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var shareData, response, err_6;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    e.preventDefault();
                    setLoading(true);
                    setError('');
                    setSuccess(false);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    shareData = {
                        documentId: documentId,
                        shareType: 'INTERNAL', // Always internal (external sharing disabled)
                        permission: permission,
                    };
                    if (selectedRecipients.length > 0) {
                        shareData.recipientIds = selectedRecipients;
                    }
                    if (description)
                        shareData.description = description;
                    return [4 /*yield*/, api_1.apiClient.createShareLink(shareData)];
                case 2:
                    response = _c.sent();
                    setSuccess(true);
                    setRequiresApproval(response.data.requiresApproval || false);
                    if (onSuccess)
                        onSuccess();
                    // Refresh existing shares
                    if (activeTab === 'existing') {
                        loadExistingShares();
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_6 = _c.sent();
                    setError(((_b = (_a = err_6.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to create share link');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleRevokeShare = function (shareId, reason) { return __awaiter(_this, void 0, void 0, function () {
        var err_7;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm('Are you sure you want to revoke this share link?'))
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.revokeShareLink(shareId, reason || 'Revoked by owner')];
                case 2:
                    _c.sent();
                    loadExistingShares();
                    return [3 /*break*/, 4];
                case 3:
                    err_7 = _c.sent();
                    setError(((_b = (_a = err_7.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to revoke share');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var addRecipient = function (u) {
        if (!(u === null || u === void 0 ? void 0 : u.id))
            return;
        if (selectedRecipients.includes(u.id))
            return;
        setSelectedRecipients(function (prev) { return __spreadArray(__spreadArray([], prev, true), [u.id], false); });
        setSelectedRecipientUsers(function (prev) { return __spreadArray(__spreadArray([], prev, true), [u], false); });
        setRecipientSearch('');
        setRecipientSuggestions([]);
    };
    var removeRecipient = function (userId) {
        setSelectedRecipients(function (prev) { return prev.filter(function (id) { return id !== userId; }); });
        setSelectedRecipientUsers(function (prev) { return prev.filter(function (u) { return u.id !== userId; }); });
    };
    return (<div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '700px' }} onClick={function (e) { return e.stopPropagation(); }}>
        <div className="modal-header">
          <h2>Share Document: {documentName}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
            <button onClick={function () { return setActiveTab('internal'); }} style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderBottom: activeTab === 'internal' ? '3px solid #007bff' : 'none',
            fontWeight: activeTab === 'internal' ? 'bold' : 'normal'
        }}>
              Internal Share
            </button>
            <button onClick={function () { return setActiveTab('existing'); }} style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderBottom: activeTab === 'existing' ? '3px solid #007bff' : 'none',
            fontWeight: activeTab === 'existing' ? 'bold' : 'normal'
        }}>
              Existing Shares ({existingShares.length})
            </button>
          </div>

          {error && (<div className="error-message" style={{ marginBottom: '15px' }}>
              {error}
            </div>)}

          {success && !requiresApproval && (<div className="success-message" style={{ marginBottom: '15px' }}>
              ✓ Share link created successfully!
            </div>)}

          {success && requiresApproval && (<div className="info-message" style={{ marginBottom: '15px' }}>
              ℹ Share link created and pending approval from administrator
            </div>)}

          {/* Internal Share Tab */}
          {activeTab === 'internal' && (<form onSubmit={handleShare}>
              {/* Recipient Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Select Recipients *
                </label>
                <input type="text" placeholder="Search by name / account ID / email (type 2+ chars)..." value={recipientSearch} onChange={function (e) { return setRecipientSearch(e.target.value); }} style={{ width: '100%', padding: '8px', marginBottom: '10px' }}/>

                {recipientSearching && (<div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    Searching...
                  </div>)}

                {recipientSuggestions.length > 0 && (<div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '4px', padding: '8px', marginBottom: '10px' }}>
                    {recipientSuggestions.map(function (u) { return (<button key={u.id} type="button" onClick={function () { return addRecipient(u); }} style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px',
                        border: '1px solid #eee',
                        borderRadius: '6px',
                        marginBottom: '6px',
                        background: '#fff',
                        cursor: 'pointer'
                    }}>
                        <div style={{ fontWeight: 600 }}>
                          {u.fullName} ({u.accountId})
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {u.email} • {u.department || '—'} • {u.position || '—'}
                        </div>
                      </button>); })}
                  </div>)}

                {selectedRecipientUsers.length > 0 ? (<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedRecipientUsers.map(function (u) { return (<span key={u.id} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: '999px',
                        background: '#e3f2fd',
                        color: '#0d47a1',
                        fontSize: '13px'
                    }}>
                        {u.fullName} ({u.accountId})
                        <button type="button" onClick={function () { return removeRecipient(u.id); }} style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: '#0d47a1',
                        fontWeight: 700
                    }} aria-label="Remove recipient" title="Remove">
                          ×
                        </button>
                      </span>); })}
                  </div>) : (<div style={{ fontSize: '12px', color: '#666' }}>
                    No recipients selected yet.
                  </div>)}
              </div>

              {/* Permission */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Permission Level *
                </label>
                <select value={permission} onChange={function (e) { return setPermission(e.target.value); }} style={{ width: '100%', padding: '8px' }} required>
                  <option value="READ_ONLY">Read Only</option>
                  <option value="DOWNLOAD">Download</option>
                  <option value="EDIT">Edit</option>
                  <option value="FULL">Full Access</option>
                </select>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Description (Optional)
                </label>
                <textarea value={description} onChange={function (e) { return setDescription(e.target.value); }} placeholder="Why are you sharing this document?" style={{ width: '100%', padding: '8px', minHeight: '60px' }}/>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} className="secondary">
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={loading || selectedRecipients.length === 0}>
                  {loading ? 'Creating...' : 'Share Internally'}
                </button>
              </div>
            </form>)}

          {/* Existing Shares Tab - Manage shares and shared persons */}
          {activeTab === 'existing' && (<ExistingSharesTab documentId={documentId} existingShares={existingShares} loadExistingShares={loadExistingShares} handleRevokeShare={handleRevokeShare} onClose={onClose}/>)}
        </div>
      </div>
    </div>);
}
