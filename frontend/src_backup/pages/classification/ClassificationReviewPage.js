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
exports.default = ClassificationReviewPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var authStore_1 = require("../../store/authStore");
var DRMViewer_1 = require("../../components/DRMViewer");
function ClassificationReviewPage() {
    var _this = this;
    var _a, _b, _c, _d, _e;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _f = (0, react_1.useState)('pending'), activeTab = _f[0], setActiveTab = _f[1];
    var _g = (0, react_1.useState)([]), documents = _g[0], setDocuments = _g[1];
    var _h = (0, react_1.useState)(true), loading = _h[0], setLoading = _h[1];
    var _j = (0, react_1.useState)(''), error = _j[0], setError = _j[1];
    var _k = (0, react_1.useState)(null), selectedDoc = _k[0], setSelectedDoc = _k[1];
    var _l = (0, react_1.useState)(false), showApproveModal = _l[0], setShowApproveModal = _l[1];
    var _m = (0, react_1.useState)(false), approving = _m[0], setApproving = _m[1];
    var _o = (0, react_1.useState)(0), pendingCount = _o[0], setPendingCount = _o[1];
    var _p = (0, react_1.useState)(0), approvedCount = _p[0], setApprovedCount = _p[1];
    // Pagination
    var _q = (0, react_1.useState)(0), page = _q[0], setPage = _q[1];
    var pageSize = (0, react_1.useState)(20)[0];
    var _r = (0, react_1.useState)(0), totalPages = _r[0], setTotalPages = _r[1];
    // Approval form
    var _s = (0, react_1.useState)(true), approveCurrentLevel = _s[0], setApproveCurrentLevel = _s[1];
    var _t = (0, react_1.useState)('CONFIDENTIAL'), overrideLevel = _t[0], setOverrideLevel = _t[1];
    var _u = (0, react_1.useState)(''), comment = _u[0], setComment = _u[1];
    // Approval result (signature info)
    var _v = (0, react_1.useState)(null), approvalResult = _v[0], setApprovalResult = _v[1];
    // Approved document details modal
    var _w = (0, react_1.useState)(null), viewApprovedDoc = _w[0], setViewApprovedDoc = _w[1];
    var _x = (0, react_1.useState)([]), approvedDocSignatures = _x[0], setApprovedDocSignatures = _x[1];
    var _y = (0, react_1.useState)(false), loadingSignatures = _y[0], setLoadingSignatures = _y[1];
    // Preview state
    var _z = (0, react_1.useState)(null), previewDoc = _z[0], setPreviewDoc = _z[1];
    // Share Approvals state
    var _0 = (0, react_1.useState)([]), pendingShares = _0[0], setPendingShares = _0[1];
    var _1 = (0, react_1.useState)(0), pendingSharesTotal = _1[0], setPendingSharesTotal = _1[1];
    var _2 = (0, react_1.useState)(false), loadingShares = _2[0], setLoadingShares = _2[1];
    var _3 = (0, react_1.useState)(null), approvingShareId = _3[0], setApprovingShareId = _3[1];
    var _4 = (0, react_1.useState)(null), rejectingShareId = _4[0], setRejectingShareId = _4[1];
    var _5 = (0, react_1.useState)(false), showRejectShareModal = _5[0], setShowRejectShareModal = _5[1];
    var _6 = (0, react_1.useState)(null), rejectTargetShare = _6[0], setRejectTargetShare = _6[1];
    var _7 = (0, react_1.useState)(''), rejectReason = _7[0], setRejectReason = _7[1];
    var _8 = (0, react_1.useState)('CONFIDENTIAL'), rejectCorrectedLevel = _8[0], setRejectCorrectedLevel = _8[1];
    (0, react_1.useEffect)(function () {
        loadCounts();
    }, []);
    (0, react_1.useEffect)(function () {
        loadDocuments();
    }, [activeTab, page, pageSize]);
    var loadCounts = function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, pendingRes, approvedRes, pendingSharesRes, err_1, err_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 6, , 7]);
                    return [4 /*yield*/, Promise.all([
                            api_1.apiClient.getPendingReviewCount(),
                            api_1.apiClient.getApprovedDocumentsCount()
                        ])];
                case 1:
                    _a = _b.sent(), pendingRes = _a[0], approvedRes = _a[1];
                    if (pendingRes.success)
                        setPendingCount(pendingRes.data || 0);
                    if (approvedRes.success)
                        setApprovedCount(approvedRes.data || 0);
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, api_1.apiClient.getPendingShareApprovals(0, 1)];
                case 3:
                    pendingSharesRes = _b.sent();
                    if (pendingSharesRes.success && pendingSharesRes.data) {
                        setPendingSharesTotal(pendingSharesRes.data.totalElements || 0);
                    }
                    return [3 /*break*/, 5];
                case 4:
                    err_1 = _b.sent();
                    console.error('Failed to load pending shares count:', err_1);
                    setPendingSharesTotal(0);
                    return [3 /*break*/, 5];
                case 5: return [3 /*break*/, 7];
                case 6:
                    err_2 = _b.sent();
                    console.error('Failed to load counts:', err_2);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var loadDocuments = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    // Shares tab is handled separately via loadPendingShares
                    if (activeTab === 'shares') {
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 6, 7, 8]);
                    res = void 0;
                    if (!(activeTab === 'pending')) return [3 /*break*/, 3];
                    return [4 /*yield*/, api_1.apiClient.getPendingReviewDocuments(page, pageSize, 'createdAt', 'DESC')];
                case 2:
                    res = _c.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, api_1.apiClient.getApprovedDocuments(page, pageSize, 'updatedAt', 'DESC')];
                case 4:
                    res = _c.sent();
                    _c.label = 5;
                case 5:
                    if (res.success && res.data) {
                        setDocuments(res.data.content || []);
                        setTotalPages(res.data.totalPages || 0);
                    }
                    return [3 /*break*/, 8];
                case 6:
                    err_3 = _c.sent();
                    setError(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || "Failed to load ".concat(activeTab, " documents"));
                    return [3 /*break*/, 8];
                case 7:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    var handleApprove = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, result, err_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!selectedDoc)
                        return [2 /*return*/];
                    setApproving(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.approveClassification(selectedDoc.id, {
                            approveCurrentLevel: approveCurrentLevel,
                            approvedClassificationLevel: overrideLevel,
                            comment: comment || undefined
                        })
                        // Capture signature info from response
                    ];
                case 2:
                    response = _c.sent();
                    result = response.data || {};
                    setApprovalResult({
                        signatureId: result.signatureId,
                        signatureTimestamp: result.signatureTimestamp,
                        blockchainTxHash: result.blockchainTxHash,
                        signatureStatus: result.signatureStatus
                    });
                    setShowApproveModal(false);
                    setSelectedDoc(null);
                    setComment('');
                    loadCounts();
                    loadDocuments();
                    return [3 /*break*/, 5];
                case 3:
                    err_4 = _c.sent();
                    alert(((_b = (_a = err_4.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to approve classification');
                    return [3 /*break*/, 5];
                case 4:
                    setApproving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleViewApproved = function (doc) { return __awaiter(_this, void 0, void 0, function () {
        var res, err_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setViewApprovedDoc(doc);
                    setApprovedDocSignatures([]);
                    setLoadingSignatures(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getSignatureChain(doc.id)];
                case 2:
                    res = _a.sent();
                    if (res.success && res.data) {
                        setApprovedDocSignatures(res.data);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_5 = _a.sent();
                    console.error('Failed to load signatures:', err_5);
                    return [3 /*break*/, 5];
                case 4:
                    setLoadingSignatures(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleTabChange = function (tab) {
        setActiveTab(tab);
        setPage(0);
        setDocuments([]);
        if (tab === 'shares') {
            loadPendingShares();
        }
    };
    var loadPendingShares = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, err_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoadingShares(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getPendingShareApprovals(0, 20)];
                case 2:
                    res = _a.sent();
                    if (res.success && res.data) {
                        setPendingShares(res.data.content || []);
                        setPendingSharesTotal(res.data.totalElements || 0);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_6 = _a.sent();
                    console.error('Failed to load pending shares:', err_6);
                    return [3 /*break*/, 5];
                case 4:
                    setLoadingShares(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleApproveShare = function (shareId) { return __awaiter(_this, void 0, void 0, function () {
        var err_7;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm('Approve this share request?'))
                        return [2 /*return*/];
                    setApprovingShareId(shareId);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.approveShareLink(shareId)];
                case 2:
                    _c.sent();
                    alert('Share approved successfully');
                    loadPendingShares();
                    loadCounts();
                    return [3 /*break*/, 5];
                case 3:
                    err_7 = _c.sent();
                    alert(((_b = (_a = err_7.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to approve share');
                    return [3 /*break*/, 5];
                case 4:
                    setApprovingShareId(null);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var openRejectShareModal = function (share) {
        setRejectTargetShare(share);
        setRejectReason('');
        setRejectCorrectedLevel((share === null || share === void 0 ? void 0 : share.documentClassificationLevel) || 'CONFIDENTIAL');
        setShowRejectShareModal(true);
    };
    var handleRejectShare = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_8;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!(rejectTargetShare === null || rejectTargetShare === void 0 ? void 0 : rejectTargetShare.id))
                        return [2 /*return*/];
                    setRejectingShareId(rejectTargetShare.id);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.rejectShareLink(rejectTargetShare.id, {
                            reason: rejectReason || undefined,
                            correctedClassificationLevel: rejectCorrectedLevel
                        })];
                case 2:
                    _c.sent();
                    alert('Share rejected');
                    setShowRejectShareModal(false);
                    setRejectTargetShare(null);
                    loadPendingShares();
                    loadCounts();
                    return [3 /*break*/, 5];
                case 3:
                    err_8 = _c.sent();
                    alert(((_b = (_a = err_8.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to reject share');
                    return [3 /*break*/, 5];
                case 4:
                    setRejectingShareId(null);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var getClassificationColor = function (level) {
        switch (level) {
            case 'PUBLIC': return '#4caf50';
            case 'INTERNAL': return '#2196f3';
            case 'CONFIDENTIAL': return '#ff9800';
            case 'STRICTLY_CONFIDENTIAL': return '#f44336';
            default: return '#888';
        }
    };
    var getStatusColor = function (status) {
        switch (status) {
            case 'REVIEW_REQUIRED': return '#ff9800';
            case 'CLASSIFIED': return '#4caf50';
            default: return '#888';
        }
    };
    var getStatusText = function (status) {
        switch (status) {
            case 'REVIEW_REQUIRED': return 'Pending Review';
            case 'CLASSIFIED': return 'Approved';
            default: return (status === null || status === void 0 ? void 0 : status.replace('_', ' ')) || '';
        }
    };
    return (<DashboardLayout_1.default>
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>Classification Review</h1>
            <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '14px' }}>
              Review and approve document classification levels
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '24px',
            borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#e0e0e0')
        }}>
          <button onClick={function () { return handleTabChange('pending'); }} style={{
            padding: '12px 24px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'pending' ? '2px solid #2196f3' : '2px solid transparent',
            color: activeTab === 'pending' ? '#2196f3' : '#666',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        }}>
            Pending Review
            {pendingCount > 0 && (<span style={{
                background: '#ff9800',
                color: 'white',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 'bold'
            }}>
                {pendingCount}
              </span>)}
          </button>
          <button onClick={function () { return handleTabChange('shares'); }} style={{
            padding: '12px 24px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'shares' ? '2px solid #9c27b0' : '2px solid transparent',
            color: activeTab === 'shares' ? '#9c27b0' : '#666',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        }}>
            Pending Share Approvals
            {pendingSharesTotal > 0 && (<span style={{
                background: '#9c27b0',
                color: 'white',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 'bold'
            }}>
                {pendingSharesTotal}
              </span>)}
          </button>
          <button onClick={function () { return handleTabChange('approved'); }} style={{
            padding: '12px 24px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'approved' ? '2px solid #4caf50' : '2px solid transparent',
            color: activeTab === 'approved' ? '#4caf50' : '#666',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        }}>
            Approved
            {approvedCount > 0 && (<span style={{
                background: '#4caf50',
                color: 'white',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 'bold'
            }}>
                {approvedCount}
              </span>)}
          </button>
        </div>

        {error && (<div style={{
                padding: '12px 16px',
                background: '#ffebee',
                color: '#c62828',
                borderRadius: '4px',
                marginBottom: '16px'
            }}>
            {error}
          </div>)}

        {loading ? (<div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
          </div>) : activeTab === 'shares' ? (
        // shares tab has its own empty state in the shares section below
        null) : documents.length === 0 ? (<div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '18px', color: '#666', marginBottom: '8px' }}>
              {activeTab === 'pending' ? 'No documents pending review' : 'No approved documents'}
            </div>
            <div style={{ fontSize: '14px', color: '#999' }}>
              {activeTab === 'pending' ? 'All documents have been reviewed and approved' : 'Approved documents will appear here'}
            </div>
          </div>) : (<>
            <div style={{
                background: theme === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: '8px',
                border: "1px solid ".concat(theme === 'dark' ? '#333' : '#e0e0e0'),
                overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#e0e0e0') }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Document</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Owner</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Department</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Level</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Confidence</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>{activeTab === 'pending' ? 'Created' : 'Approved'}</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(function (doc) {
                var _a;
                return (<tr key={doc.id} style={{
                        borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#eee'),
                        cursor: 'pointer'
                    }} onMouseEnter={function (e) {
                        e.currentTarget.style.background = theme === 'dark' ? '#2a2a2a' : '#f9f9f9';
                    }} onMouseLeave={function (e) {
                        e.currentTarget.style.background = 'transparent';
                    }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: '500', color: '#007bff', cursor: 'pointer' }} onClick={function () { return navigate("/documents/".concat(doc.id)); }}>
                          {doc.name}
                        </div>
                        {doc.description && (<div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
                            {doc.description.substring(0, 60)}{doc.description.length > 60 ? '...' : ''}
                          </div>)}
                      </td>
                      <td style={{ padding: '12px' }}>{doc.ownerName}</td>
                      <td style={{ padding: '12px' }}>{doc.department}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8em',
                        fontWeight: '600',
                        background: getClassificationColor(doc.classificationLevel) + '33',
                        color: getClassificationColor(doc.classificationLevel)
                    }}>
                          {(_a = doc.classificationLevel) === null || _a === void 0 ? void 0 : _a.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {doc.classificationConfidence !== null && doc.classificationConfidence !== undefined ? (<span style={{ fontSize: '0.85em' }}>
                            {(doc.classificationConfidence * 100).toFixed(1)}%
                          </span>) : (<span style={{ color: '#999' }}>N/A</span>)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8em',
                        fontWeight: '600',
                        background: getStatusColor(doc.status) + '33',
                        color: getStatusColor(doc.status)
                    }}>
                          {getStatusText(doc.status)}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.9em' }}>
                        {new Date(activeTab === 'pending' ? doc.createdAt : doc.updatedAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {activeTab === 'pending' ? (<>
                              <button onClick={function () {
                            setSelectedDoc(doc);
                            setShowApproveModal(true);
                            setApproveCurrentLevel(true);
                            setComment('');
                        }} style={{
                            padding: '6px 12px',
                            background: '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85em',
                            fontWeight: '500'
                        }}>
                                Review
                              </button>
                              <button onClick={function () {
                            setPreviewDoc(doc);
                        }} style={{
                            padding: '6px 12px',
                            background: '#2196f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85em',
                            fontWeight: '500'
                        }}>
                                Preview
                              </button>
                            </>) : (<>
                              <button onClick={function () { return handleViewApproved(doc); }} style={{
                            padding: '6px 12px',
                            background: '#ff9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85em',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                                <span style={{ fontSize: '0.9em' }}>👤</span>
                                <span>Approver</span>
                              </button>
                            </>)}
                        </div>
                      </td>
                    </tr>);
            })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (<div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '24px' }}>
                <button onClick={function () { return setPage(function (p) { return Math.max(0, p - 1); }); }} disabled={page === 0} style={{
                    padding: '8px 16px',
                    background: page === 0 ? '#ccc' : '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: page === 0 ? 'not-allowed' : 'pointer'
                }}>
                  Previous
                </button>
                <span style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
                  Page {page + 1} of {totalPages}
                </span>
                <button onClick={function () { return setPage(function (p) { return Math.min(totalPages - 1, p + 1); }); }} disabled={page >= totalPages - 1} style={{
                    padding: '8px 16px',
                    background: page >= totalPages - 1 ? '#ccc' : '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer'
                }}>
                  Next
                </button>
              </div>)}
          </>)}

        {/* Share Approvals Tab */}
        {activeTab === 'shares' && (<div>
            {loadingShares ? (<div style={{ textAlign: 'center', padding: '60px' }}>
                <div style={{ fontSize: '18px', color: '#666' }}>Loading share approvals...</div>
              </div>) : pendingShares.length === 0 ? (<div style={{ textAlign: 'center', padding: '60px' }}>
                <div style={{ fontSize: '18px', color: '#666', marginBottom: '8px' }}>
                  No pending share approvals
                </div>
                <div style={{ fontSize: '14px', color: '#999' }}>
                  Share requests for confidential documents will appear here
                </div>
              </div>) : (<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingShares.map(function (share) {
                    var _a;
                    return (<div key={share.id} style={{
                            padding: '20px',
                            borderRadius: '8px',
                            border: "1px solid ".concat(theme === 'dark' ? '#333' : '#e0e0e0'),
                            background: theme === 'dark' ? '#1e1e1e' : '#fff'
                        }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                          {share.documentName || "Document #".concat(share.documentId)}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                          <strong>Creator:</strong> {share.creatorName || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                          <strong>Type:</strong> {share.shareType} · <strong>Permission:</strong> {share.permission}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                          <strong>Current Level:</strong>{' '}
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.85em',
                            fontWeight: '600',
                            background: getClassificationColor(share.documentClassificationLevel) + '33',
                            color: getClassificationColor(share.documentClassificationLevel)
                        }}>
                            {((_a = share.documentClassificationLevel) === null || _a === void 0 ? void 0 : _a.replace('_', ' ')) || 'N/A'}
                          </span>
                        </div>
                        {share.recipients && share.recipients.length > 0 && (<div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                            <strong>Recipients:</strong>{' '}
                            {share.recipients.map(function (r, idx) { return (<span key={r.userId || idx}>
                                {r.fullName} ({r.accountId}){idx < share.recipients.length - 1 ? ', ' : ''}
                              </span>); })}
                          </div>)}
                        {share.expiresAt && (<div style={{ fontSize: '13px', color: '#999' }}>
                            <strong>Expires:</strong> {new Date(share.expiresAt).toLocaleString()}
                          </div>)}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={function () { return openRejectShareModal(share); }} style={{
                            padding: '10px 16px',
                            background: '#c62828',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                        }}>
                          Reject
                        </button>
                        <button onClick={function () { return handleApproveShare(share.id); }} disabled={approvingShareId === share.id} style={{
                            padding: '10px 16px',
                            background: approvingShareId === share.id ? '#ccc' : '#2e7d32',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: approvingShareId === share.id ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                        }}>
                          {approvingShareId === share.id ? 'Approving...' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  </div>);
                })}
              </div>)}
          </div>)}

        {/* Approval Modal */}
        {showApproveModal && selectedDoc && (<div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }} onClick={function () {
                if (!approving) {
                    setShowApproveModal(false);
                    setSelectedDoc(null);
                }
            }}>
            <div style={{
                background: theme === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto'
            }} onClick={function (e) { return e.stopPropagation(); }}>
              <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Approve Classification</h2>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Document:</strong> {selectedDoc.name}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Current Classification Level:</strong>{' '}
                  <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.9em',
                fontWeight: '600',
                background: getClassificationColor(selectedDoc.classificationLevel) + '33',
                color: getClassificationColor(selectedDoc.classificationLevel)
            }}>
                    {(_a = selectedDoc.classificationLevel) === null || _a === void 0 ? void 0 : _a.replace('_', ' ')}
                  </span>
                </div>
                {selectedDoc.classificationReason && (<div style={{ marginBottom: '12px', fontSize: '0.9em', color: '#666' }}>
                    <strong>Reason:</strong> {selectedDoc.classificationReason}
                  </div>)}
                {selectedDoc.classificationConfidence !== null && selectedDoc.classificationConfidence !== undefined && (<div style={{ marginBottom: '12px', fontSize: '0.9em', color: '#666' }}>
                    <strong>Confidence:</strong> {(selectedDoc.classificationConfidence * 100).toFixed(1)}%
                  </div>)}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', cursor: 'pointer' }}>
                  <input type="radio" checked={approveCurrentLevel} onChange={function () { return setApproveCurrentLevel(true); }} style={{ marginRight: '8px' }}/>
                  <span>Approve current classification level</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" checked={!approveCurrentLevel} onChange={function () { return setApproveCurrentLevel(false); }} style={{ marginRight: '8px' }}/>
                  <span>Override with new level</span>
                </label>
              </div>

              {!approveCurrentLevel && (<div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    New Classification Level:
                  </label>
                  <select value={overrideLevel} onChange={function (e) { return setOverrideLevel(e.target.value); }} style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: "1px solid ".concat(theme === 'dark' ? '#333' : '#ccc'),
                    background: theme === 'dark' ? '#2a2a2a' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000'
                }}>
                    <option value="PUBLIC">Public</option>
                    <option value="INTERNAL">Internal</option>
                    <option value="CONFIDENTIAL">Confidential</option>
                    <option value="STRICTLY_CONFIDENTIAL">Strictly Confidential</option>
                  </select>
                </div>)}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Review Comment (Optional):
                </label>
                <textarea value={comment} onChange={function (e) { return setComment(e.target.value); }} placeholder="Add your review comments..." rows={4} style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#333' : '#ccc'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
                resize: 'vertical'
            }}/>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={function () {
                setShowApproveModal(false);
                setSelectedDoc(null);
                setComment('');
            }} disabled={approving} style={{
                padding: '10px 20px',
                background: '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: approving ? 'not-allowed' : 'pointer'
            }}>
                  Cancel
                </button>
                <button onClick={handleApprove} disabled={approving} style={{
                padding: '10px 20px',
                background: approving ? '#ccc' : '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: approving ? 'not-allowed' : 'pointer',
                fontWeight: '500'
            }}>
                  {approving ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>)}

        {/* Approval Result Modal - Shows E-Signature Info */}
        {approvalResult && (<div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }} onClick={function () { return setApprovalResult(null); }}>
            <div style={{
                background: theme === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                textAlign: 'center'
            }} onClick={function (e) { return e.stopPropagation(); }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#4caf50',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
            }}>
                <span style={{ fontSize: '30px' }}>✓</span>
              </div>
              <h2 style={{ margin: '0 0 8px', color: '#4caf50' }}>Classification Approved!</h2>
              <p style={{ margin: '0 0 20px', color: '#666' }}>
                The document has been successfully classified and the approval has been recorded.
              </p>

              {/* E-Signature Evidence */}
              {approvalResult.signatureId && (<div style={{
                    background: '#e8f5e9',
                    border: '1px solid #4caf50',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'left',
                    marginBottom: '20px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                    color: '#2e7d32',
                    fontWeight: 'bold'
                }}>
                    <span>🔒</span> Digital Signature Created
                  </div>
                  <div style={{ fontSize: '13px', color: '#555' }}>
                    <div style={{ marginBottom: '6px' }}>
                      <strong>Signature ID:</strong> {approvalResult.signatureId}
                    </div>
                    <div style={{ marginBottom: '6px' }}>
                      <strong>Status:</strong>
                      <span style={{
                    marginLeft: '6px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: '#4caf50',
                    color: 'white',
                    fontSize: '12px'
                }}>
                        {approvalResult.signatureStatus}
                      </span>
                    </div>
                    {approvalResult.signatureTimestamp && (<div style={{ marginBottom: '6px' }}>
                        <strong>Signed At:</strong> {new Date(approvalResult.signatureTimestamp).toLocaleString()}
                      </div>)}
                    {approvalResult.blockchainTxHash && (<div style={{ marginTop: '10px', padding: '8px', background: '#fff', borderRadius: '4px' }}>
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Blockchain Anchor (Ethereum)</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                          {approvalResult.blockchainTxHash.substring(0, 20)}...
                        </div>
                      </div>)}
                  </div>
                </div>)}

              {!approvalResult.signatureId && (<div style={{
                    background: '#fff3e0',
                    border: '1px solid #ff9800',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '20px',
                    fontSize: '13px',
                    color: '#e65100'
                }}>
                  ⚠️ Signature creation failed. The classification was still recorded.
                </div>)}

              {approvalResult.signatureId && (<button onClick={function () {
                    var _a;
                    // Navigate to signature chain page
                    var docId = approvalResult && documents.length > 0 ? (_a = documents[0]) === null || _a === void 0 ? void 0 : _a.id : null;
                    if (docId) {
                        navigate("/documents/".concat(docId, "/signatures"));
                    }
                    setApprovalResult(null);
                }} style={{
                    padding: '10px 32px',
                    background: '#9c27b0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                }}>
                  ✍️ View Signature Chain
                </button>)}
              {!approvalResult.signatureId && (<button onClick={function () { return setApprovalResult(null); }} style={{
                    padding: '10px 32px',
                    background: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                }}>
                  Close
                </button>)}
            </div>
          </div>)}

        {/* Preview Modal */}
        {previewDoc && (<div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000
            }} onClick={function (e) {
                if (e.target === e.currentTarget) {
                    setPreviewDoc(null);
                }
            }}>
            <div style={{
                background: theme === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: '8px',
                width: '95vw',
                height: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }} onClick={function (e) { return e.stopPropagation(); }}>
              {/* Modal Header */}
              <div style={{
                padding: '16px 24px',
                borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#e0e0e0'),
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px' }}>Document Preview</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#666' }}>
                    {previewDoc.name}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '0.85em',
                fontWeight: '600',
                background: getClassificationColor(previewDoc.classificationLevel) + '33',
                color: getClassificationColor(previewDoc.classificationLevel)
            }}>
                    {(_b = previewDoc.classificationLevel) === null || _b === void 0 ? void 0 : _b.replace('_', ' ')}
                  </span>
                  <button onClick={function () { return setPreviewDoc(null); }} style={{
                padding: '8px 16px',
                background: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
            }}>
                    Close
                  </button>
                </div>
              </div>

              {/* Document Viewer */}
              <div style={{ flex: 1, overflow: 'hidden', padding: '16px' }}>
                <DRMViewer_1.default documentUrl={"/api/docs/".concat(previewDoc.id, "/content")} documentName={previewDoc.name} allowCopy={false} allowPrint={false} allowDownload={false} requiresWatermark={true} watermarkText={"Reviewer Preview | ".concat((_c = previewDoc.classificationLevel) === null || _c === void 0 ? void 0 : _c.replace('_', ' '))}/>
              </div>
            </div>
          </div>)}

        {/* Approved Document Details Modal */}
        {viewApprovedDoc && (<div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }} onClick={function (e) {
                if (e.target === e.currentTarget) {
                    setViewApprovedDoc(null);
                }
            }}>
            <div style={{
                background: theme === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '700px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto'
            }} onClick={function (e) { return e.stopPropagation(); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Approval Details</h2>
                <button onClick={function () { return setViewApprovedDoc(null); }} style={{
                padding: '8px 16px',
                background: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
            }}>
                  Close
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Document:</strong> {viewApprovedDoc.name}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Classification Level:</strong>{' '}
                  <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.9em',
                fontWeight: '600',
                background: getClassificationColor(viewApprovedDoc.classificationLevel) + '33',
                color: getClassificationColor(viewApprovedDoc.classificationLevel)
            }}>
                    {(_d = viewApprovedDoc.classificationLevel) === null || _d === void 0 ? void 0 : _d.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Owner:</strong> {viewApprovedDoc.ownerName}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Department:</strong> {viewApprovedDoc.department}
                </div>
                {viewApprovedDoc.classificationReason && (<div style={{ marginBottom: '12px', fontSize: '0.9em', color: '#666' }}>
                    <strong>Classification Reason:</strong> {viewApprovedDoc.classificationReason}
                  </div>)}
              </div>

              <div style={{ borderTop: "1px solid ".concat(theme === 'dark' ? '#333' : '#e0e0e0'), paddingTop: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>Digital Signature Records</h3>
                
                {loadingSignatures ? (<div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                    Loading signature records...
                  </div>) : approvedDocSignatures.length === 0 ? (<div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                    No signature records found for this document
                  </div>) : (<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {approvedDocSignatures.map(function (sig, index) {
                    var _a, _b, _c;
                    return (<div key={sig.id} style={{
                            padding: '16px',
                            borderRadius: '8px',
                            border: "1px solid ".concat(theme === 'dark' ? '#333' : '#e0e0e0'),
                            background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9'
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.2em' }}>✓</span>
                            <strong>{((_a = sig.user) === null || _a === void 0 ? void 0 : _a.fullName) || ((_b = sig.user) === null || _b === void 0 ? void 0 : _b.accountId) || 'Unknown Signer'}</strong>
                            <span style={{
                            marginLeft: '8px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'normal',
                            background: sig.signatureType === 'CLASSIFICATION_APPROVE' ? '#ff9800' :
                                sig.signatureType === 'APPROVE_SHARE' ? '#9c27b0' :
                                    sig.signatureType === 'MANUAL_SIGN' ? '#00bcd4' :
                                        index === 0 ? '#2196f3' : '#9c27b0',
                            color: 'white'
                        }}>
                              {sig.signatureTypeLabel || (index === 0 ? 'Uploader' : 'Approver')}
                            </span>
                            <span style={{ color: '#666', fontSize: '0.85em' }}>({((_c = sig.user) === null || _c === void 0 ? void 0 : _c.accountId) || sig.userId})</span>
                          </div>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.8em',
                            fontWeight: '600',
                            background: sig.status === 'VALID' ? '#4caf5033' : '#f4433633',
                            color: sig.status === 'VALID' ? '#4caf50' : '#f44336'
                        }}>
                            {sig.status || 'VALID'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85em', color: '#666' }}>
                          <div style={{ marginBottom: '4px' }}>
                            <strong>Signed At:</strong> {sig.signedAt ? new Date(sig.signedAt).toLocaleString() : 'N/A'}
                          </div>
                          {sig.signatureId && (<div style={{ marginBottom: '4px' }}>
                              <strong>Signature ID:</strong> {sig.signatureId}
                            </div>)}
                          {sig.blockchainTxHash && (<div style={{ marginBottom: '4px', wordBreak: 'break-all' }}>
                              <strong>Blockchain Hash:</strong> {sig.blockchainTxHash}
                            </div>)}
                          {sig.documentHash && (<div style={{ marginBottom: '4px', wordBreak: 'break-all' }}>
                              <strong>Document Hash:</strong> {sig.documentHash.substring(0, 32)}...
                            </div>)}
                        </div>
                      </div>);
                })}
                  </div>)}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={function () {
                setViewApprovedDoc(null);
                navigate("/documents/".concat(viewApprovedDoc.id, "/signatures"));
            }} style={{
                padding: '10px 20px',
                background: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
            }}>
                  View Full Signature Chain
                </button>
                <button onClick={function () { return setViewApprovedDoc(null); }} style={{
                padding: '10px 20px',
                background: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
            }}>
                  Close
                </button>
              </div>
            </div>
          </div>)}

        {/* Reject Share Modal */}
        {showRejectShareModal && rejectTargetShare && (<div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }} onClick={function () { return !rejectingShareId && setShowRejectShareModal(false); }}>
            <div style={{
                background: theme === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto'
            }} onClick={function (e) { return e.stopPropagation(); }}>
              <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Reject Share Request</h2>
              
              <div style={{ marginBottom: '16px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Document:</strong> {rejectTargetShare.documentName || "#".concat(rejectTargetShare.documentId)}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Creator:</strong> {rejectTargetShare.creatorName || 'Unknown'}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Current Level:</strong>{' '}
                  <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.85em',
                fontWeight: '600',
                background: getClassificationColor(rejectTargetShare.documentClassificationLevel) + '33',
                color: getClassificationColor(rejectTargetShare.documentClassificationLevel)
            }}>
                    {((_e = rejectTargetShare.documentClassificationLevel) === null || _e === void 0 ? void 0 : _e.replace('_', ' ')) || 'N/A'}
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Correct classification level (optional - will update document level):
                </label>
                <select value={rejectCorrectedLevel} onChange={function (e) { return setRejectCorrectedLevel(e.target.value); }} style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#333' : '#ccc'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
            }}>
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="INTERNAL">INTERNAL</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                  <option value="STRICTLY_CONFIDENTIAL">STRICTLY CONFIDENTIAL</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Reject reason (optional):
                </label>
                <textarea value={rejectReason} onChange={function (e) { return setRejectReason(e.target.value); }} placeholder="e.g., External sharing of confidential documents not permitted" rows={3} style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#333' : '#ccc'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
                resize: 'vertical'
            }}/>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={function () { return setShowRejectShareModal(false); }} disabled={!!rejectingShareId} style={{
                padding: '10px 20px',
                background: '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: rejectingShareId ? 'not-allowed' : 'pointer'
            }}>
                  Cancel
                </button>
                <button onClick={handleRejectShare} disabled={!!rejectingShareId} style={{
                padding: '10px 20px',
                background: rejectingShareId ? '#ccc' : '#c62828',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: rejectingShareId ? 'not-allowed' : 'pointer',
                fontWeight: '500'
            }}>
                  {rejectingShareId ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>)}
      </div>
    </DashboardLayout_1.default>);
}
