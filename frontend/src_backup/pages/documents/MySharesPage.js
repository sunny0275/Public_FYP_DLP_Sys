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
exports.default = MySharesPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
var DashboardLayout_1 = require("../../components/DashboardLayout");
require("../../modal.css");
function MySharesPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _a = (0, react_1.useState)([]), shares = _a[0], setShares = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(0), page = _d[0], setPage = _d[1];
    var _e = (0, react_1.useState)(0), totalPages = _e[0], setTotalPages = _e[1];
    // Filters
    var _f = (0, react_1.useState)('all'), filterType = _f[0], setFilterType = _f[1];
    var _g = (0, react_1.useState)('all'), filterStatus = _g[0], setFilterStatus = _g[1];
    var _h = (0, react_1.useState)(''), searchQuery = _h[0], setSearchQuery = _h[1];
    // Bulk operations
    var _j = (0, react_1.useState)([]), selectedShares = _j[0], setSelectedShares = _j[1];
    // Share details modal
    var _k = (0, react_1.useState)(null), selectedShare = _k[0], setSelectedShare = _k[1];
    var _l = (0, react_1.useState)(false), showShareDetails = _l[0], setShowShareDetails = _l[1];
    // Edit share modal
    var _m = (0, react_1.useState)(null), editShare = _m[0], setEditShare = _m[1];
    var _o = (0, react_1.useState)(''), editExpiresAt = _o[0], setEditExpiresAt = _o[1];
    var _p = (0, react_1.useState)(''), editAccessLimit = _p[0], setEditAccessLimit = _p[1];
    var _q = (0, react_1.useState)('READ_ONLY'), editPermission = _q[0], setEditPermission = _q[1];
    var _r = (0, react_1.useState)(false), editAllowCopy = _r[0], setEditAllowCopy = _r[1];
    var _s = (0, react_1.useState)(false), editAllowPrint = _s[0], setEditAllowPrint = _s[1];
    var _t = (0, react_1.useState)(false), editAllowDownload = _t[0], setEditAllowDownload = _t[1];
    var _u = (0, react_1.useState)(false), editAllowEdit = _u[0], setEditAllowEdit = _u[1];
    var _v = (0, react_1.useState)(false), editSaving = _v[0], setEditSaving = _v[1];
    var _w = (0, react_1.useState)(''), editError = _w[0], setEditError = _w[1];
    (0, react_1.useEffect)(function () {
        loadShares();
    }, [page]);
    var loadShares = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, err_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getMyShares(page, 20)];
                case 2:
                    response = _e.sent();
                    setShares(((_a = response.data) === null || _a === void 0 ? void 0 : _a.content) || []);
                    setTotalPages(((_b = response.data) === null || _b === void 0 ? void 0 : _b.totalPages) || 1);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _e.sent();
                    setError(((_d = (_c = err_1.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || 'Failed to load shares');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleRevokeShare = function (shareId) { return __awaiter(_this, void 0, void 0, function () {
        var reason, err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    reason = prompt('Enter reason for revoking this share:');
                    if (!reason)
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.revokeShareLink(shareId, reason)];
                case 2:
                    _c.sent();
                    loadShares();
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _c.sent();
                    alert(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to revoke share');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleBulkRevoke = function () { return __awaiter(_this, void 0, void 0, function () {
        var reason, err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (selectedShares.length === 0) {
                        alert('Please select shares to revoke');
                        return [2 /*return*/];
                    }
                    reason = prompt("Revoke ".concat(selectedShares.length, " share(s)? Enter reason:"));
                    if (!reason)
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.all(selectedShares.map(function (id) { return api_1.apiClient.revokeShareLink(id, reason); }))];
                case 2:
                    _c.sent();
                    setSelectedShares([]);
                    loadShares();
                    return [3 /*break*/, 4];
                case 3:
                    err_3 = _c.sent();
                    alert(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to revoke shares');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleViewShare = function (share) {
        setSelectedShare(share);
        setShowShareDetails(true);
    };
    var openEditShare = function (share) {
        var _a, _b, _c, _d;
        setEditShare(share);
        setEditExpiresAt(share.expiresAt ? share.expiresAt.slice(0, 16) : '');
        setEditAccessLimit(share.accessLimit != null ? String(share.accessLimit) : '');
        setEditPermission(share.permission || 'READ_ONLY');
        setEditAllowCopy((_a = share.allowCopy) !== null && _a !== void 0 ? _a : false);
        setEditAllowPrint((_b = share.allowPrint) !== null && _b !== void 0 ? _b : false);
        setEditAllowDownload((_c = share.allowDownload) !== null && _c !== void 0 ? _c : false);
        setEditAllowEdit((_d = share.allowEdit) !== null && _d !== void 0 ? _d : false);
        setEditError('');
    };
    var closeEditShare = function () {
        setEditShare(null);
        setEditError('');
    };
    var handleUpdateShare = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var accessLimitNum, err_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!editShare)
                        return [2 /*return*/];
                    e.preventDefault();
                    setEditSaving(true);
                    setEditError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    accessLimitNum = editAccessLimit.trim() === '' ? undefined : parseInt(editAccessLimit, 10);
                    return [4 /*yield*/, api_1.apiClient.updateShare(editShare.id, __assign(__assign(__assign({}, (editExpiresAt ? { expiresAt: new Date(editExpiresAt).toISOString() } : {})), (accessLimitNum !== undefined && !isNaN(accessLimitNum) ? { accessLimit: accessLimitNum } : {})), { permission: editPermission, allowCopy: editAllowCopy, allowPrint: editAllowPrint, allowDownload: editAllowDownload, allowEdit: editAllowEdit }))];
                case 2:
                    _c.sent();
                    closeEditShare();
                    loadShares();
                    return [3 /*break*/, 5];
                case 3:
                    err_4 = _c.sent();
                    setEditError(((_b = (_a = err_4.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to update share');
                    return [3 /*break*/, 5];
                case 4:
                    setEditSaving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleCopyLink = function (share) {
        if (!share.token) {
            alert('This share does not have a shareable link');
            return;
        }
        var link = "".concat(window.location.origin, "/shared/").concat(share.token);
        navigator.clipboard.writeText(link);
        alert('Share link copied to clipboard!');
    };
    var toggleShareSelection = function (shareId) {
        if (selectedShares.includes(shareId)) {
            setSelectedShares(selectedShares.filter(function (id) { return id !== shareId; }));
        }
        else {
            setSelectedShares(__spreadArray(__spreadArray([], selectedShares, true), [shareId], false));
        }
    };
    var toggleSelectAll = function () {
        if (selectedShares.length === filteredShares.length) {
            setSelectedShares([]);
        }
        else {
            setSelectedShares(filteredShares.map(function (s) { return s.id; }));
        }
    };
    // Apply filters
    var filteredShares = shares.filter(function (share) {
        // Type filter
        if (filterType !== 'all' && share.shareType !== filterType)
            return false;
        // Status filter
        if (filterStatus !== 'all' && share.status !== filterStatus)
            return false;
        // Search query
        if (searchQuery.trim()) {
            var query = searchQuery.toLowerCase();
            if (!share.documentName.toLowerCase().includes(query) &&
                !(share.description || '').toLowerCase().includes(query)) {
                return false;
            }
        }
        return true;
    });
    var getStatusColor = function (status) {
        switch (status) {
            case 'ACTIVE': return '#4caf50';
            case 'EXPIRED': return '#ff9800';
            case 'REVOKED': return '#f44336';
            case 'PENDING_APPROVAL': return '#2196f3';
            default: return '#888';
        }
    };
    var getShareTypeColor = function (type) {
        return type === 'INTERNAL' ? '#2196f3' : '#ff9800';
    };
    var formatExpiryDate = function (expiresAt) {
        if (!expiresAt)
            return 'Never';
        var date = new Date(expiresAt);
        var now = new Date();
        var diffMs = date.getTime() - now.getTime();
        var diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours < 0) {
            return 'Expired';
        }
        else if (diffHours < 24) {
            return "Expires in ".concat(diffHours, "h");
        }
        else {
            var diffDays = Math.floor(diffHours / 24);
            return "Expires in ".concat(diffDays, "d");
        }
    };
    if (loading && shares.length === 0) {
        return (<DashboardLayout_1.default>
        <div className="dashboard">
          <h2>My Shares</h2>
          <p>Loading shares...</p>
        </div>
      </DashboardLayout_1.default>);
    }
    return (<DashboardLayout_1.default>
      <div className="dashboard">
        <div style={{ marginBottom: '24px' }}>
          <h1>My Shares</h1>
          <p style={{ color: '#666', marginTop: '8px' }}>Manage all your document shares in one place</p>
        </div>

        {error && (<div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>)}

        {/* Filters and Controls */}
        <div style={{
            marginBottom: '24px',
            padding: '20px',
            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
            borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', marginBottom: '16px' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85em', color: '#666' }}>Search</label>
              <input type="text" value={searchQuery} onChange={function (e) { return setSearchQuery(e.target.value); }} placeholder="Search by document name or description..." style={{ width: '100%', padding: '8px 12px' }}/>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85em', color: '#666' }}>Type</label>
              <select value={filterType} onChange={function (e) { return setFilterType(e.target.value); }} style={{ padding: '8px 12px' }}>
                <option value="all">All Types</option>
                <option value="INTERNAL">Internal</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85em', color: '#666' }}>Status</label>
              <select value={filterStatus} onChange={function (e) { return setFilterStatus(e.target.value); }} style={{ padding: '8px 12px' }}>
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>

            <button onClick={loadShares} style={{ padding: '8px 16px', background: '#6c757d' }}>
              Refresh
            </button>
          </div>

          {/* Bulk Actions */}
          {selectedShares.length > 0 && (<div style={{
                padding: '12px',
                background: '#007bff22',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
              <span style={{ fontWeight: 'bold', color: '#007bff' }}>
                {selectedShares.length} share(s) selected
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleBulkRevoke} style={{ padding: '6px 12px', background: '#f44336', fontSize: '0.9em' }}>
                  Revoke Selected
                </button>
                <button onClick={function () { return setSelectedShares([]); }} style={{ padding: '6px 12px', background: '#6c757d', fontSize: '0.9em' }}>
                  Clear Selection
                </button>
              </div>
            </div>)}
        </div>

        {/* Statistics Summary */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '24px' }}>
          <div className="dashboard-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#007bff', marginBottom: '8px' }}>
              {shares.length}
            </div>
            <div style={{ color: '#666' }}>Total Shares</div>
          </div>
          <div className="dashboard-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#4caf50', marginBottom: '8px' }}>
              {shares.filter(function (s) { return s.status === 'ACTIVE'; }).length}
            </div>
            <div style={{ color: '#666' }}>Active Shares</div>
          </div>
          <div className="dashboard-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#ff9800', marginBottom: '8px' }}>
              {shares.filter(function (s) { return s.shareType === 'INTERNAL'; }).length}
            </div>
            <div style={{ color: '#666' }}>Internal Shares</div>
          </div>
          <div className="dashboard-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#f44336', marginBottom: '8px' }}>
              {shares.filter(function (s) { return s.status === 'REVOKED'; }).length}
            </div>
            <div style={{ color: '#666' }}>Revoked</div>
          </div>
        </div>

        {/* Shares List */}
        {filteredShares.length === 0 ? (<div className="dashboard-card" style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
            <h3>No shares found</h3>
            <p>
              {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'You haven\'t created any shares yet'}
            </p>
          </div>) : (<>
            {/* Select All */}
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" checked={selectedShares.length === filteredShares.length && filteredShares.length > 0} onChange={toggleSelectAll} style={{ marginRight: '8px' }} id="select-all"/>
              <label htmlFor="select-all" style={{ cursor: 'pointer', fontSize: '0.9em' }}>
                Select all ({filteredShares.length})
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredShares.map(function (share) { return (<div key={share.id} className="dashboard-card" style={{
                    padding: '20px',
                    border: selectedShares.includes(share.id) ? '2px solid #007bff' : undefined
                }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                    <input type="checkbox" checked={selectedShares.includes(share.id)} onChange={function () { return toggleShareSelection(share.id); }} style={{ marginTop: '4px' }} onClick={function (e) { return e.stopPropagation(); }}/>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                        <div>
                          <h3 style={{ marginBottom: '8px', cursor: 'pointer' }} onClick={function () { return handleViewShare(share); }}>
                            {share.documentName}
                          </h3>
                          {share.description && (<p style={{ color: '#666', fontSize: '0.9em', marginBottom: '8px' }}>
                              {share.description}
                            </p>)}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                          <span style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.8em',
                    fontWeight: '600',
                    background: getShareTypeColor(share.shareType) + '22',
                    color: getShareTypeColor(share.shareType)
                }}>
                            {share.shareType}
                          </span>
                          <span style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.8em',
                    fontWeight: '600',
                    background: getStatusColor(share.status) + '22',
                    color: getStatusColor(share.status)
                }}>
                            {share.status}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.85em', color: '#666', marginBottom: '12px' }}>
                        <div>
                          <strong>Permission:</strong> {share.permission}
                        </div>
                        <div>
                          <strong>Accessed:</strong> {share.accessCount} times
                          {share.accessLimit && " / ".concat(share.accessLimit)}
                        </div>
                        {share.expiresAt && (<div style={{ color: share.status === 'EXPIRED' ? '#f44336' : undefined }}>
                            <strong>Expiry:</strong> {formatExpiryDate(share.expiresAt)}
                          </div>)}
                        <div>
                          <strong>Created:</strong> {new Date(share.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button onClick={function () { return handleViewShare(share); }} style={{ padding: '6px 12px', background: '#007bff', fontSize: '0.9em' }}>
                          View Details
                        </button>
                        {share.token && share.status === 'ACTIVE' && (<button onClick={function () { return handleCopyLink(share); }} style={{ padding: '6px 12px', background: '#17a2b8', fontSize: '0.9em' }}>
                            Copy Link
                          </button>)}
                        <button onClick={function () { return navigate("/documents/".concat(share.documentId)); }} style={{ padding: '6px 12px', background: '#6c757d', fontSize: '0.9em' }}>
                          View Document
                        </button>
                        {share.status === 'ACTIVE' && (<>
                            <button onClick={function () { return openEditShare(share); }} style={{ padding: '6px 12px', background: '#17a2b8', fontSize: '0.9em' }}>
                              Edit
                            </button>
                            <button onClick={function () { return handleRevokeShare(share.id); }} style={{ padding: '6px 12px', background: '#f44336', fontSize: '0.9em' }}>
                              Revoke
                            </button>
                          </>)}
                      </div>
                    </div>
                  </div>
                </div>); })}
            </div>
          </>)}

        {/* Pagination */}
        {totalPages > 1 && (<div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '24px' }}>
            <button onClick={function () { return setPage(function (p) { return Math.max(0, p - 1); }); }} disabled={page === 0} style={{ padding: '8px 16px' }}>
              Previous
            </button>
            <span style={{ padding: '8px 16px', background: '#f0f0f0', borderRadius: '4px' }}>
              Page {page + 1} of {totalPages}
            </span>
            <button onClick={function () { return setPage(function (p) { return Math.min(totalPages - 1, p + 1); }); }} disabled={page >= totalPages - 1} style={{ padding: '8px 16px' }}>
              Next
            </button>
          </div>)}
      </div>

      {/* Share Details Modal */}
      {showShareDetails && selectedShare && (<div className="modal-overlay" onClick={function () { return setShowShareDetails(false); }}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={function (e) { return e.stopPropagation(); }}>
            <div className="modal-header">
              <h2>Share Details</h2>
              <button className="modal-close" onClick={function () { return setShowShareDetails(false); }}>&times;</button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '8px' }}>{selectedShare.documentName}</h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <span style={{
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.85em',
                fontWeight: '600',
                background: getShareTypeColor(selectedShare.shareType) + '22',
                color: getShareTypeColor(selectedShare.shareType)
            }}>
                    {selectedShare.shareType}
                  </span>
                  <span style={{
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.85em',
                fontWeight: '600',
                background: getStatusColor(selectedShare.status) + '22',
                color: getStatusColor(selectedShare.status)
            }}>
                    {selectedShare.status}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {selectedShare.description && (<div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Description</div>
                    <div>{selectedShare.description}</div>
                  </div>)}

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Permission Level</div>
                  <div>{selectedShare.permission}</div>
                </div>

                {selectedShare.token && (<div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Share Link</div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input type="text" value={"".concat(window.location.origin, "/shared/").concat(selectedShare.token)} readOnly style={{ flex: 1, padding: '8px', background: '#f0f0f0' }}/>
                      <button onClick={function () { return handleCopyLink(selectedShare); }} style={{ padding: '8px 12px', fontSize: '0.9em' }}>
                        Copy
                      </button>
                    </div>
                  </div>)}

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Access Statistics</div>
                  <div>
                    {selectedShare.accessCount} views
                    {selectedShare.accessLimit && " (limit: ".concat(selectedShare.accessLimit, ")")}
                  </div>
                </div>

                {selectedShare.expiresAt && (<div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Expiration</div>
                    <div>
                      {new Date(selectedShare.expiresAt).toLocaleString()}
                      <br />
                      <span style={{ fontSize: '0.9em', color: '#666' }}>
                        ({formatExpiryDate(selectedShare.expiresAt)})
                      </span>
                    </div>
                  </div>)}

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Security Options</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>{selectedShare.requiresWatermark ? '✓' : '✗'} Watermark required</div>
                    <div>{selectedShare.allowDownload ? '✓' : '✗'} Download allowed</div>
                    <div>{selectedShare.allowCopy ? '✓' : '✗'} Copy allowed</div>
                    <div>{selectedShare.allowPrint ? '✓' : '✗'} Print allowed</div>
                  </div>
                </div>

                {selectedShare.requiresApproval && (<div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Approval Status</div>
                    <div style={{
                    fontWeight: 'bold',
                    color: selectedShare.approvalGranted ? '#4caf50' : '#ff9800'
                }}>
                      {selectedShare.approvalGranted ? 'Approved' : 'Pending Approval'}
                    </div>
                  </div>)}

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Created</div>
                  <div>
                    {new Date(selectedShare.createdAt).toLocaleString()}
                    <br />
                    <span style={{ fontSize: '0.9em', color: '#666' }}>by {selectedShare.createdByName}</span>
                  </div>
                </div>

                {selectedShare.revokedAt && (<>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Revoked</div>
                      <div>{new Date(selectedShare.revokedAt).toLocaleString()}</div>
                    </div>
                    {selectedShare.revokedReason && (<div>
                        <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Revocation Reason</div>
                        <div>{selectedShare.revokedReason}</div>
                      </div>)}
                  </>)}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={function () { return setShowShareDetails(false); }} style={{ padding: '10px 20px', background: '#6c757d' }}>
                Close
              </button>
              {selectedShare.status === 'ACTIVE' && (<>
                  <button onClick={function () {
                    setShowShareDetails(false);
                    openEditShare(selectedShare);
                }} style={{ padding: '10px 20px', background: '#17a2b8' }}>
                    Edit (extend expiry / permissions)
                  </button>
                  <button onClick={function () {
                    setShowShareDetails(false);
                    handleRevokeShare(selectedShare.id);
                }} style={{ padding: '10px 20px', background: '#f44336' }}>
                    Revoke
                  </button>
                </>)}
            </div>
          </div>
        </div>)}

      {/* Edit Share Modal */}
      {editShare && (<div className="modal-overlay" onClick={closeEditShare}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={function (e) { return e.stopPropagation(); }}>
            <div className="modal-header">
              <h2>Edit share: {editShare.documentName}</h2>
              <button className="modal-close" onClick={closeEditShare}>&times;</button>
            </div>
            <form onSubmit={handleUpdateShare}>
              <div className="modal-body">
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}>Expires at (leave empty = no change)</label>
                  <input type="datetime-local" value={editExpiresAt} onChange={function (e) { return setEditExpiresAt(e.target.value); }} style={{ width: '100%', padding: '8px' }}/>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}>Access limit (leave empty = no change)</label>
                  <input type="number" min={1} value={editAccessLimit} onChange={function (e) { return setEditAccessLimit(e.target.value); }} placeholder="Unlimited" style={{ width: '100%', padding: '8px' }}/>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}>Permission</label>
                  <select value={editPermission} onChange={function (e) { return setEditPermission(e.target.value); }} style={{ width: '100%', padding: '8px' }}>
                    <option value="READ_ONLY">Read only</option>
                    <option value="DOWNLOAD">Download</option>
                    <option value="EDIT">Edit</option>
                    <option value="FULL">Full</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', marginBottom: '16px' }}>
                  <label><input type="checkbox" checked={editAllowCopy} onChange={function (e) { return setEditAllowCopy(e.target.checked); }}/> Allow copy</label>
                  <label><input type="checkbox" checked={editAllowPrint} onChange={function (e) { return setEditAllowPrint(e.target.checked); }}/> Allow print</label>
                  <label><input type="checkbox" checked={editAllowDownload} onChange={function (e) { return setEditAllowDownload(e.target.checked); }}/> Allow download</label>
                  <label><input type="checkbox" checked={editAllowEdit} onChange={function (e) { return setEditAllowEdit(e.target.checked); }}/> Allow edit</label>
                </div>
                {editError && <div className="error-message" style={{ marginBottom: '12px' }}>{editError}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={closeEditShare} style={{ padding: '10px 20px', background: '#6c757d' }}>Cancel</button>
                <button type="submit" disabled={editSaving} style={{ padding: '10px 20px', background: '#007bff' }}>{editSaving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>)}
    </DashboardLayout_1.default>);
}
