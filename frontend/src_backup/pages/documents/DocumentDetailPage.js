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
exports.default = DocumentDetailPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var ShareDialog_1 = require("../../components/ShareDialog");
var DRMViewer_1 = require("../../components/DRMViewer");
var types_1 = require("../../types");
function DocumentDetailPage() {
    var _this = this;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    var id = (0, react_router_dom_1.useParams)().id;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _p = (0, authStore_1.useAuthStore)(), user = _p.user, theme = _p.theme;
    var _q = (0, react_1.useState)(null), document = _q[0], setDocument = _q[1];
    var _r = (0, react_1.useState)(true), loading = _r[0], setLoading = _r[1];
    var _s = (0, react_1.useState)(''), error = _s[0], setError = _s[1];
    var _t = (0, react_1.useState)(false), showShareDialog = _t[0], setShowShareDialog = _t[1];
    var _u = (0, react_1.useState)('internal'), shareDialogInitialTab = _u[0], setShareDialogInitialTab = _u[1];
    var _v = (0, react_1.useState)([]), versions = _v[0], setVersions = _v[1];
    var _w = (0, react_1.useState)([]), activities = _w[0], setActivities = _w[1];
    var _x = (0, react_1.useState)('all'), activitySeverityFilter = _x[0], setActivitySeverityFilter = _x[1];
    var _y = (0, react_1.useState)(''), activitySearchTerm = _y[0], setActivitySearchTerm = _y[1];
    var _z = (0, react_1.useState)('timestamp'), activitySortField = _z[0], setActivitySortField = _z[1];
    var _0 = (0, react_1.useState)('desc'), activitySortDirection = _0[0], setActivitySortDirection = _0[1];
    var _1 = (0, react_1.useState)('info'), activeTab = _1[0], setActiveTab = _1[1];
    var _2 = (0, react_1.useState)(false), editingMetadata = _2[0], setEditingMetadata = _2[1];
    var _3 = (0, react_1.useState)({
        name: '',
        description: '',
        department: '',
        classificationLevel: '',
        tags: []
    }), editForm = _3[0], setEditForm = _3[1];
    var _4 = (0, react_1.useState)([]), departments = _4[0], setDepartments = _4[1];
    var _5 = (0, react_1.useState)([]), tags = _5[0], setTags = _5[1];
    var _6 = (0, react_1.useState)(null), comparisonResult = _6[0], setComparisonResult = _6[1];
    var _7 = (0, react_1.useState)({ v1: null, v2: null }), comparingVersions = _7[0], setComparingVersions = _7[1];
    (0, react_1.useEffect)(function () {
        if (id) {
            loadDocument();
        }
    }, [id]);
    // Record VIEW audit when user explicitly clicks Preview tab
    (0, react_1.useEffect)(function () {
        if (activeTab === 'preview' && id && document) {
            // Only record once per session (when first switching to preview)
            api_1.apiClient.recordDocumentView(Number(id)).catch(function (err) {
                console.warn('Failed to record document view:', err);
            });
        }
    }, [activeTab, id]);
    (0, react_1.useEffect)(function () {
        if (editingMetadata) {
            loadEditOptions();
        }
    }, [editingMetadata]);
    var loadEditOptions = function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, deptsRes, tagsRes, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, Promise.all([
                            api_1.apiClient.getDepartments(),
                            api_1.apiClient.getAllTags()
                        ])];
                case 1:
                    _a = _b.sent(), deptsRes = _a[0], tagsRes = _a[1];
                    setDepartments(deptsRes.data || []);
                    setTags(tagsRes.data || []);
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _b.sent();
                    console.error('Failed to load edit options:', err_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var handleSaveMetadata = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!id)
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.updateDocument(Number(id), {
                            name: editForm.name,
                            description: editForm.description,
                            department: editForm.department,
                            classificationLevel: editForm.classificationLevel || undefined,
                            tags: editForm.tags
                        })];
                case 2:
                    _c.sent();
                    setEditingMetadata(false);
                    loadDocument(); // Reload to see updated data
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _c.sent();
                    alert(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to update metadata');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var loadDocument = function () { return __awaiter(_this, void 0, void 0, function () {
        var docRes, _a, versionsRes, activityRes, err_3, errorMsg;
        var _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, api_1.apiClient.getDocument(Number(id))];
                case 2:
                    docRes = _g.sent();
                    setDocument(docRes.data);
                    // Initialize edit form
                    setEditForm({
                        name: docRes.data.name || '',
                        description: docRes.data.description || '',
                        department: docRes.data.department || '',
                        classificationLevel: docRes.data.classificationLevel || '',
                        tags: ((_b = docRes.data.tags) === null || _b === void 0 ? void 0 : _b.map(function (t) { var _a; return ((_a = t.id) === null || _a === void 0 ? void 0 : _a.toString()) || t.name; })) || []
                    });
                    return [4 /*yield*/, Promise.all([
                            api_1.apiClient.getDocumentVersions(Number(id)),
                            api_1.apiClient.getDocumentActivity(Number(id))
                        ])];
                case 3:
                    _a = _g.sent(), versionsRes = _a[0], activityRes = _a[1];
                    setVersions(versionsRes.data || []);
                    setActivities(activityRes.data || []);
                    return [3 /*break*/, 6];
                case 4:
                    err_3 = _g.sent();
                    if (((_c = err_3.response) === null || _c === void 0 ? void 0 : _c.status) === 403) {
                        errorMsg = 'You do not have permission to view this document';
                        setError(errorMsg);
                        // Note: Alert is already shown by apiClient interceptor (client.ts)
                        // No need to show duplicate alert here
                        setTimeout(function () { return navigate('/'); }, 100);
                    }
                    else if (((_d = err_3.response) === null || _d === void 0 ? void 0 : _d.status) === 404) {
                        setError('Document not found');
                    }
                    else {
                        setError(((_f = (_e = err_3.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.message) || 'Failed to load document');
                    }
                    return [3 /*break*/, 6];
                case 5:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var handleRestoreVersion = function (versionId) { return __awaiter(_this, void 0, void 0, function () {
        var err_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm('Are you sure you want to restore to this version? The current version will be saved as a new version.')) {
                        return [2 /*return*/];
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.restoreDocumentVersion(Number(id), versionId)];
                case 2:
                    _c.sent();
                    alert('Document restored successfully!');
                    loadDocument(); // Reload to see updated version
                    return [3 /*break*/, 4];
                case 3:
                    err_4 = _c.sent();
                    alert(((_b = (_a = err_4.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to restore version');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleCompareVersions = function (v1, v2) { return __awaiter(_this, void 0, void 0, function () {
        var response, err_5;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, api_1.apiClient.compareDocumentVersions(Number(id), v1.id, v2.id)];
                case 1:
                    response = _c.sent();
                    setComparisonResult(response.data);
                    setComparingVersions({ v1: v1, v2: v2 });
                    return [3 /*break*/, 3];
                case 2:
                    err_5 = _c.sent();
                    alert(((_b = (_a = err_5.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to compare versions');
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
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
            case 'CLASSIFIED':
            case 'ACTIVE': return '#4caf50';
            case 'PROCESSING': return '#2196f3';
            case 'REVIEW_REQUIRED': return '#ff9800';
            case 'FAILED':
            case 'QUARANTINED': return '#f44336';
            default: return '#888';
        }
    };
    var severityOrder = {
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1
    };
    var mapResultToSeverity = function (result) {
        if (!result)
            return 'LOW';
        if (result === 'FAILURE')
            return 'HIGH';
        if (result === 'WARNING')
            return 'MEDIUM';
        return 'LOW';
    };
    var normalizedActivitySearch = activitySearchTerm.trim().toLowerCase();
    var filteredActivities = activities.filter(function (activity) {
        var severity = mapResultToSeverity(activity.result);
        if (activitySeverityFilter !== 'all' && severity !== activitySeverityFilter) {
            return false;
        }
        if (!normalizedActivitySearch) {
            return true;
        }
        var haystack = [
            activity.userName,
            activity.accountId,
            activity.action,
            activity.result,
            activity.details
        ]
            .filter(Boolean)
            .map(function (value) { return value.toString().toLowerCase(); })
            .join(' ');
        return haystack.includes(normalizedActivitySearch);
    });
    var sortedActivities = __spreadArray([], filteredActivities, true).sort(function (a, b) {
        var direction = activitySortDirection === 'asc' ? 1 : -1;
        switch (activitySortField) {
            case 'timestamp': {
                var aTime = new Date(a.timestamp || '').getTime();
                var bTime = new Date(b.timestamp || '').getTime();
                return (aTime - bTime) * direction;
            }
            case 'userName': {
                var aName = (a.userName || a.accountId || '').toString();
                var bName = (b.userName || b.accountId || '').toString();
                return aName.localeCompare(bName) * direction;
            }
            case 'action': {
                return (a.action || '').localeCompare(b.action || '') * direction;
            }
            case 'result': {
                return (severityOrder[mapResultToSeverity(a.result)] - severityOrder[mapResultToSeverity(b.result)]) * direction;
            }
            default:
                return 0;
        }
    });
    var handleExportActivities = function () {
        var payload = sortedActivities.map(function (activity) { return ({
            time: activity.timestamp,
            user: activity.userName || activity.accountId,
            action: activity.action,
            result: activity.result,
            ip: activity.ipAddress,
            details: activity.details
        }); });
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var url = window.URL.createObjectURL(blob);
        var a = window.document.createElement('a');
        a.href = url;
        a.download = "document-".concat(id, "-activity-").concat(new Date().toISOString(), ".json");
        a.click();
        window.URL.revokeObjectURL(url);
    };
    var severityColorMap = {
        HIGH: '#ff6b6b',
        MEDIUM: '#ffa500',
        LOW: '#4caf50'
    };
    var formatTimestampHK = function (timestamp) {
        if (!timestamp)
            return '—';
        return new Date(timestamp).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
    };
    var toggleActivitySort = function (field) {
        if (activitySortField === field) {
            setActivitySortDirection(function (prev) { return (prev === 'asc' ? 'desc' : 'asc'); });
        }
        else {
            setActivitySortField(field);
            setActivitySortDirection(field === 'timestamp' ? 'desc' : 'asc');
        }
    };
    var renderSortIndicator = function (field) {
        if (activitySortField !== field)
            return '↕';
        return activitySortDirection === 'asc' ? '↑' : '↓';
    };
    if (loading) {
        return (<DashboardLayout_1.default>
        <div className="dashboard">
          <h2>Loading document...</h2>
        </div>
      </DashboardLayout_1.default>);
    }
    if (error || !document) {
        var isForbidden = error && (error.includes('permission') || error.includes('Permission'));
        return (<DashboardLayout_1.default>
        <div className="dashboard">
          {isForbidden ? (<div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '48px 24px',
                    gap: '24px'
                }}>
              <div style={{
                    fontSize: '4rem',
                    lineHeight: 1,
                    filter: 'drop-shadow(0 2px 8px rgba(220,53,69,0.3))'
                }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#dc3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{
                    padding: '16px 24px',
                    borderRadius: '8px',
                    border: '1px solid rgba(220,53,69,0.3)',
                    background: 'rgba(220,53,69,0.05)',
                    maxWidth: '480px',
                    textAlign: 'center'
                }}>
                <div style={{
                    fontSize: '1.1em',
                    fontWeight: 600,
                    color: '#dc3545',
                    marginBottom: '8px'
                }}>
                  Access Denied
                </div>
                <div style={{ fontSize: '0.95em', color: '#666', lineHeight: 1.5 }}>
                  {error || 'You do not have permission to view this document.'}
                </div>
                <div style={{
                    marginTop: '12px',
                    fontSize: '0.8em',
                    color: '#888',
                    padding: '8px 12px',
                    background: 'rgba(255,193,7,0.1)',
                    borderRadius: '4px',
                    border: '1px solid rgba(255,193,7,0.3)'
                }}>
                  This attempt has been logged and reported to the security system for review.
                </div>
              </div>
              <button onClick={function () { return navigate('/documents'); }} style={{
                    padding: '10px 28px',
                    background: '#6c757d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.95em',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Return to Document Library
              </button>
            </div>) : (<>
              <div className="error-message" style={{ marginBottom: '20px' }}>{error || 'Document not found'}</div>
              <button onClick={function () { return navigate('/documents'); }} style={{ padding: '10px 20px' }}>
                ← Back to Documents
              </button>
            </>)}
        </div>
      </DashboardLayout_1.default>);
    }
    var isOwner = document.ownerId === (user === null || user === void 0 ? void 0 : user.userId);
    return (<DashboardLayout_1.default>
      <div className="dashboard">
        <div style={{ marginBottom: '24px' }}>
          <button onClick={function () { return navigate('/documents'); }} style={{ padding: '8px 16px', background: '#6c757d', marginBottom: '16px' }}>
            ← Back to Documents
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h1 style={{ marginBottom: '8px' }}>{document.name}</h1>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '12px' }}>
                <span style={{
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '0.9em',
            fontWeight: '600',
            background: getClassificationColor(document.classificationLevel) + '33',
            color: getClassificationColor(document.classificationLevel)
        }}>
                  {(_a = document.classificationLevel) === null || _a === void 0 ? void 0 : _a.replace('_', ' ')}
                </span>
                <span style={{
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '0.9em',
            fontWeight: '600',
            background: getStatusColor(document.status) + '33',
            color: getStatusColor(document.status)
        }}>
                  {document.status}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {isOwner && (<>
                  <button onClick={function () { setShareDialogInitialTab('internal'); setShowShareDialog(true); }} style={{ padding: '10px 20px', background: '#17a2b8' }}>
                    🔗 Share
                  </button>
                  <button onClick={function () { setShareDialogInitialTab('existing'); setShowShareDialog(true); }} style={{ padding: '10px 20px', background: '#6c757d' }} title="View and manage shared persons">
                    👥 Manage shares
                  </button>
                </>)}
            </div>
          </div>
        </div>

        {/* Tabs: Info / Preview / Versions / Activity */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['info', 'preview', 'versions', 'activity'].map(function (tab) { return (<button key={tab} onClick={function () { return setActiveTab(tab); }} style={{
                padding: '8px 16px',
                borderRadius: '16px',
                border: '1px solid #ddd',
                background: activeTab === tab ? '#007bff' : '#f5f5f5',
                color: activeTab === tab ? '#fff' : '#333',
                cursor: 'pointer',
                fontSize: '0.9em'
            }}>
                {tab === 'info' && 'Info'}
                {tab === 'preview' && 'Preview'}
                {tab === 'versions' && 'Versions'}
                {tab === 'activity' && 'Activity'}
              </button>); })}
          </div>

          {activeTab === 'info' && (<>
              <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {/* Metadata */}
                <div className="dashboard-card">
                  <h3 style={{ marginBottom: '16px' }}>Document Information</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Owner</div>
                      <div style={{ fontWeight: '500' }}>{document.ownerName}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Department</div>
                      <div style={{ fontWeight: '500' }}>{document.department}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>File Type</div>
                      <div style={{ fontWeight: '500' }}>{document.fileType}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>File Size</div>
                      <div style={{ fontWeight: '500' }}>{(document.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    {document.pageCount && (<div>
                        <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Pages</div>
                        <div style={{ fontWeight: '500' }}>{document.pageCount}</div>
                      </div>)}
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Created</div>
                      <div style={{ fontWeight: '500' }}>{new Date(document.createdAt).toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Last Updated</div>
                      <div style={{ fontWeight: '500' }}>{new Date(document.updatedAt).toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="dashboard-card">
                  <h3 style={{ marginBottom: '16px' }}>Statistics</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Views</div>
                      <div style={{ fontWeight: '500', fontSize: '1.5em', color: '#007bff' }}>{document.viewCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Downloads</div>
                      <div style={{ fontWeight: '500', fontSize: '1.5em', color: '#28a745' }}>{document.downloadCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Shares</div>
                      <div style={{ fontWeight: '500', fontSize: '1.5em', color: '#ff9800' }}>{document.shareCount || 0}</div>
                    </div>
                  </div>
                </div>
              </div>

              {document.description && (<div className="dashboard-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0 }}>Description</h3>
                    {document.ownerId === (user === null || user === void 0 ? void 0 : user.userId) && (<button onClick={function () { return setEditingMetadata(true); }} style={{
                        padding: '6px 12px',
                        fontSize: '0.85em',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                        ✏️ Edit Metadata
                      </button>)}
                  </div>
                  <p style={{ color: theme === 'dark' ? '#ccc' : '#555', lineHeight: '1.6' }}>
                    {document.description}
                  </p>
                </div>)}

              {!document.description && document.ownerId === (user === null || user === void 0 ? void 0 : user.userId) && (<div className="dashboard-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Description</h3>
                    <button onClick={function () { return setEditingMetadata(true); }} style={{
                    padding: '6px 12px',
                    fontSize: '0.85em',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}>
                      ✏️ Edit Metadata
                    </button>
                  </div>
                </div>)}

              {document.tags && document.tags.length > 0 && (<div className="dashboard-card">
                  <h3 style={{ marginBottom: '12px' }}>Tags</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {document.tags.map(function (tag) { return (<span key={tag.id} style={{
                        padding: '6px 12px',
                        borderRadius: '12px',
                        fontSize: '0.9em',
                        background: tag.color || '#007bff',
                        color: '#fff'
                    }}>
                        {tag.name}
                      </span>); })}
                  </div>
                </div>)}

              {/* Signature Chain */}
              <div className="dashboard-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0 }}>Digital Signatures</h3>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button onClick={function () { return navigate("/documents/".concat(document.id, "/signatures")); }} style={{
                padding: '6px 12px',
                fontSize: '0.85em',
                background: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
            }}>
                    View Signature Chain
                  </button>
                  </div>
                </div>
                <p style={{ fontSize: '0.9em', color: '#888' }}>
                  Signatures are created automatically after upload. You can view the signature chain here.
                </p>
              </div>

              {document.classificationReason && (<div className="dashboard-card">
                  <h3 style={{ marginBottom: '12px' }}>Classification Details</h3>
                  {document.autoClassified && (<div style={{ marginBottom: '12px', padding: '8px 12px', background: '#007bff33', borderRadius: '6px', color: '#007bff', fontSize: '0.9em' }}>
                      🤖 This document was automatically classified using AI
                    </div>)}
                  {document.classificationConfidence !== null && (<div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Confidence</div>
                      <div style={{ fontWeight: '500' }}>{(document.classificationConfidence * 100).toFixed(1)}%</div>
                    </div>)}
                  <div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Reason</div>
                    <p style={{ color: theme === 'dark' ? '#ccc' : '#555', lineHeight: '1.6' }}>
                      {document.classificationReason}
                    </p>
                  </div>
                </div>)}
            </>)}

          {activeTab === 'preview' && (<div className="dashboard-card">
              <h3 style={{ marginBottom: '16px' }}>Document Preview</h3>
              <DRMViewer_1.default documentUrl={"".concat(types_1.API_BASE_URL, "/docs/").concat(document.id, "/content")} documentName={document.name} allowCopy={false} allowPrint={false} allowDownload={false} requiresWatermark={true} watermarkText={"User: ".concat((user === null || user === void 0 ? void 0 : user.fullName) || (user === null || user === void 0 ? void 0 : user.accountId) || '', " | Dept: ").concat((user === null || user === void 0 ? void 0 : user.department) || '')}/>
            </div>)}

          {activeTab === 'versions' && (<div className="dashboard-card">
              <h3 style={{ marginBottom: '12px' }}>Version History</h3>
              {versions.length > 0 ? (<>
                  {/* Version Comparison UI */}
                  {versions.length >= 2 && (<div style={{ marginBottom: '20px', padding: '16px', background: theme === 'dark' ? '#333' : '#f5f5f5', borderRadius: '8px' }}>
                      <h4 style={{ marginBottom: '12px' }}>Compare Versions</h4>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select value={((_b = comparingVersions.v1) === null || _b === void 0 ? void 0 : _b.id) || ''} onChange={function (e) {
                        var v = versions.find(function (v) { return v.id.toString() === e.target.value; });
                        setComparingVersions(__assign(__assign({}, comparingVersions), { v1: v || null }));
                    }} style={{ padding: '8px', borderRadius: '4px', border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd') }}>
                          <option value="">Select Version 1</option>
                          {versions.map(function (v) { return (<option key={v.id} value={v.id}>Version {v.versionNumber}</option>); })}
                        </select>
                        <span>vs</span>
                        <select value={((_c = comparingVersions.v2) === null || _c === void 0 ? void 0 : _c.id) || ''} onChange={function (e) {
                        var v = versions.find(function (v) { return v.id.toString() === e.target.value; });
                        setComparingVersions(__assign(__assign({}, comparingVersions), { v2: v || null }));
                    }} style={{ padding: '8px', borderRadius: '4px', border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd') }}>
                          <option value="">Select Version 2</option>
                          {versions.map(function (v) { return (<option key={v.id} value={v.id}>Version {v.versionNumber}</option>); })}
                        </select>
                        <button onClick={function () {
                        if (comparingVersions.v1 && comparingVersions.v2) {
                            handleCompareVersions(comparingVersions.v1, comparingVersions.v2);
                        }
                        else {
                            alert('Please select two versions to compare');
                        }
                    }} disabled={!comparingVersions.v1 || !comparingVersions.v2} style={{
                        padding: '8px 16px',
                        background: comparingVersions.v1 && comparingVersions.v2 ? '#007bff' : '#ccc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: comparingVersions.v1 && comparingVersions.v2 ? 'pointer' : 'not-allowed'
                    }}>
                          Compare
                        </button>
                      </div>
                    </div>)}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Version</th>
                        <th style={{ padding: '8px' }}>Created At</th>
                        <th style={{ padding: '8px' }}>Created By</th>
                        <th style={{ padding: '8px' }}>Size</th>
                        <th style={{ padding: '8px' }}>Notes</th>
                        <th style={{ padding: '8px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map(function (v) { return (<tr key={v.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '8px' }}>{v.versionNumber}</td>
                          <td style={{ padding: '8px' }}>{new Date(v.createdAt).toLocaleString()}</td>
                          <td style={{ padding: '8px' }}>{v.createdByName || v.createdBy || v.creator}</td>
                          <td style={{ padding: '8px' }}>{v.size || v.fileSize ? ((v.size || v.fileSize) / 1024 / 1024).toFixed(2) + ' MB' : '-'}</td>
                          <td style={{ padding: '8px' }}>{v.description || '-'}</td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {v.versionNumber !== document.version && (<button onClick={function () { return handleRestoreVersion(v.id); }} style={{
                            padding: '4px 8px',
                            fontSize: '0.85em',
                            background: '#ff9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }} title="Restore to this version">
                                  🔄 Restore
                                </button>)}
                            </div>
                          </td>
                        </tr>); })}
                    </tbody>
                  </table>
                </>) : (<div className="empty-state">No version history available.</div>)}
            </div>)}

          {activeTab === 'activity' && (<div className="dashboard-card">
              <h3 style={{ marginBottom: '12px' }}>Activity Log</h3>
              <div style={{
                marginBottom: '12px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '0.85em' }}>Severity</label>
                  <select value={activitySeverityFilter} onChange={function (e) { return setActivitySeverityFilter(e.target.value); }} style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ccc')
            }}>
                    <option value="all">All</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <input type="text" value={activitySearchTerm} onChange={function (e) { return setActivitySearchTerm(e.target.value); }} placeholder="Search user/action/result/details" style={{
                flex: '1 1 240px',
                padding: '6px 10px',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ccc')
            }}/>

                <button onClick={handleExportActivities} style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                background: '#fff',
                cursor: 'pointer'
            }}>
                  Export Logs
                </button>

                <div style={{ fontSize: '0.8em', color: '#666' }}>
                  {sortedActivities.length} entries
                </div>
              </div>
              {sortedActivities.length > 0 ? (<table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
                      <th style={{ padding: '8px', cursor: 'pointer' }} onClick={function () { return toggleActivitySort('timestamp'); }}>
                        Time {renderSortIndicator('timestamp')}
                      </th>
                      <th style={{ padding: '8px', cursor: 'pointer' }} onClick={function () { return toggleActivitySort('userName'); }}>
                        User {renderSortIndicator('userName')}
                      </th>
                      <th style={{ padding: '8px', cursor: 'pointer' }} onClick={function () { return toggleActivitySort('action'); }}>
                        Action {renderSortIndicator('action')}
                      </th>
                      <th style={{ padding: '8px', cursor: 'pointer' }} onClick={function () { return toggleActivitySort('result'); }}>
                        Result {renderSortIndicator('result')}
                      </th>
                      <th style={{ padding: '8px' }}>Severity</th>
                      <th style={{ padding: '8px' }}>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedActivities.map(function (a) {
                    var severity = mapResultToSeverity(a.result);
                    return (<tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px' }}>{formatTimestampHK(a.timestamp)}</td>
                        <td style={{ padding: '8px' }}>{a.userName || a.userId}</td>
                        <td style={{ padding: '8px' }}>{a.action}</td>
                        <td style={{ padding: '8px' }}>{a.result}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '0.75em',
                            fontWeight: 600,
                            background: severityColorMap[severity] || '#888',
                            color: '#fff'
                        }}>
                            {severity}
                          </span>
                        </td>
                        <td style={{ padding: '8px' }}>{a.ipAddress}</td>
                      </tr>);
                })}
                  </tbody>
                </table>) : (<div className="empty-state">No activity records.</div>)}
            </div>)}
        </div>
      </div>

      {/* Share Dialog */}
      {showShareDialog && isOwner && (<ShareDialog_1.default initialTab={shareDialogInitialTab} documentId={document.id} documentName={document.name} onClose={function () { return setShowShareDialog(false); }} onSuccess={function () {
                setShowShareDialog(false);
                loadDocument(); // Reload to see updated share count
            }}/>)}

      {/* Version Comparison Modal */}
      {comparisonResult && comparingVersions.v1 && comparingVersions.v2 && (<div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }} onClick={function () {
                setComparisonResult(null);
                setComparingVersions({ v1: null, v2: null });
            }}>
          <div className="dashboard-card" style={{
                maxWidth: '900px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                padding: '24px'
            }} onClick={function (e) { return e.stopPropagation(); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Version Comparison</h2>
              <button onClick={function () {
                setComparisonResult(null);
                setComparingVersions({ v1: null, v2: null });
            }} style={{
                padding: '8px 16px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
            }}>
                ✕ Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <h3>Version {((_d = comparisonResult.version1) === null || _d === void 0 ? void 0 : _d.versionNumber) || ((_e = comparingVersions.v1) === null || _e === void 0 ? void 0 : _e.versionNumber)}</h3>
                <p style={{ fontSize: '0.9em', color: '#888' }}>
                  Created: {new Date(((_f = comparisonResult.version1) === null || _f === void 0 ? void 0 : _f.createdAt) || ((_g = comparingVersions.v1) === null || _g === void 0 ? void 0 : _g.createdAt)).toLocaleString()}
                </p>
                <p style={{ fontSize: '0.9em', color: '#888' }}>
                  Size: {((_h = comparisonResult.version1) === null || _h === void 0 ? void 0 : _h.fileSize) ? (comparisonResult.version1.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '-'}
                </p>
              </div>
              <div>
                <h3>Version {((_j = comparisonResult.version2) === null || _j === void 0 ? void 0 : _j.versionNumber) || ((_k = comparingVersions.v2) === null || _k === void 0 ? void 0 : _k.versionNumber)}</h3>
                <p style={{ fontSize: '0.9em', color: '#888' }}>
                  Created: {new Date(((_l = comparisonResult.version2) === null || _l === void 0 ? void 0 : _l.createdAt) || ((_m = comparingVersions.v2) === null || _m === void 0 ? void 0 : _m.createdAt)).toLocaleString()}
                </p>
                <p style={{ fontSize: '0.9em', color: '#888' }}>
                  Size: {((_o = comparisonResult.version2) === null || _o === void 0 ? void 0 : _o.fileSize) ? (comparisonResult.version2.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '-'}
                </p>
              </div>
            </div>

            {comparisonResult.textSimilarity !== undefined && (<div style={{ marginBottom: '20px', padding: '12px', background: theme === 'dark' ? '#333' : '#f5f5f5', borderRadius: '8px' }}>
                <strong>Text Similarity: </strong>
                {(comparisonResult.textSimilarity * 100).toFixed(2)}%
              </div>)}

            {comparisonResult.text1Preview && comparisonResult.text2Preview && (<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <h4>Version 1 Preview</h4>
                  <pre style={{
                    padding: '12px',
                    background: theme === 'dark' ? '#1a1a1a' : '#f9f9f9',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '300px',
                    fontSize: '0.85em'
                }}>
                    {comparisonResult.text1Preview}
                  </pre>
                </div>
                <div>
                  <h4>Version 2 Preview</h4>
                  <pre style={{
                    padding: '12px',
                    background: theme === 'dark' ? '#1a1a1a' : '#f9f9f9',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '300px',
                    fontSize: '0.85em'
                }}>
                    {comparisonResult.text2Preview}
                  </pre>
                </div>
              </div>)}
          </div>
        </div>)}

      {/* Edit Metadata Modal */}
      {editingMetadata && (<div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }} onClick={function () { return setEditingMetadata(false); }}>
          <div className="dashboard-card" style={{
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                padding: '24px'
            }} onClick={function (e) { return e.stopPropagation(); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Edit Document Metadata</h2>
              <button onClick={function () { return setEditingMetadata(false); }} style={{
                padding: '8px 16px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
            }}>
                ✕ Close
              </button>
            </div>

            <form onSubmit={function (e) { e.preventDefault(); handleSaveMetadata(); }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Document Name *</label>
                <input type="text" value={editForm.name} onChange={function (e) { return setEditForm(__assign(__assign({}, editForm), { name: e.target.value })); }} required style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
            }}/>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Department *</label>
                <select value={editForm.department} onChange={function (e) { return setEditForm(__assign(__assign({}, editForm), { department: e.target.value })); }} required style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
            }}>
                  <option value="">Select Department</option>
                  {departments.map(function (dept) { return (<option key={dept} value={dept}>{dept}</option>); })}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Classification Level</label>
                <select value={editForm.classificationLevel} onChange={function (e) { return setEditForm(__assign(__assign({}, editForm), { classificationLevel: e.target.value })); }} style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
            }}>
                  <option value="">Auto-classify</option>
                  <option value="PUBLIC">Public</option>
                  <option value="INTERNAL">Internal</option>
                  <option value="CONFIDENTIAL">Confidential</option>
                  <option value="STRICTLY_CONFIDENTIAL">Strictly Confidential</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Tags</label>
                <div style={{ fontSize: '12px', marginBottom: '8px', color: theme === 'dark' ? '#bbb' : '#666' }}>
                  Selected: {editForm.tags.length}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {tags.map(function (tag) { return (<label key={tag.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 12px',
                    borderRadius: '16px',
                    fontSize: '0.85em',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontWeight: editForm.tags.includes(tag.id.toString()) ? 700 : 500,
                    background: editForm.tags.includes(tag.id.toString())
                        ? (tag.color || '#007bff')
                        : (theme === 'dark' ? '#333' : '#f0f0f0'),
                    color: editForm.tags.includes(tag.id.toString()) ? '#fff' : (theme === 'dark' ? '#fff' : '#000'),
                    border: "1px solid ".concat(editForm.tags.includes(tag.id.toString()) ? '#0056b3' : (theme === 'dark' ? '#444' : '#ddd')),
                    boxShadow: editForm.tags.includes(tag.id.toString()) ? '0 0 0 2px rgba(0,123,255,0.25)' : 'none'
                }}>
                      <input type="checkbox" checked={editForm.tags.includes(tag.id.toString())} onChange={function (e) {
                    if (e.target.checked) {
                        setEditForm(__assign(__assign({}, editForm), { tags: __spreadArray(__spreadArray([], editForm.tags, true), [tag.id.toString()], false) }));
                    }
                    else {
                        setEditForm(__assign(__assign({}, editForm), { tags: editForm.tags.filter(function (t) { return t !== tag.id.toString(); }) }));
                    }
                }} style={{ marginRight: '6px', cursor: 'pointer' }}/>
                      {editForm.tags.includes(tag.id.toString()) ? '✓ ' : ''}{tag.name}
                    </label>); })}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Description</label>
                <textarea value={editForm.description} onChange={function (e) { return setEditForm(__assign(__assign({}, editForm), { description: e.target.value })); }} rows={4} style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
            }}/>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={function () { return setEditingMetadata(false); }} style={{
                padding: '10px 20px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
            }}>
                  Cancel
                </button>
                <button type="submit" style={{
                padding: '10px 20px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
            }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>)}
    </DashboardLayout_1.default>);
}
