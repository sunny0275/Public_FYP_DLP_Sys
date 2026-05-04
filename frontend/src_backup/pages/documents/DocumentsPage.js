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
exports.default = DocumentsPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
var DashboardLayout_1 = require("../../components/DashboardLayout");
function DocumentsPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, authStore_1.useAuthStore)(), user = _a.user, theme = _a.theme;
    var _b = (0, react_1.useState)([]), documents = _b[0], setDocuments = _b[1];
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(''), error = _d[0], setError = _d[1];
    // Filters
    var _e = (0, react_1.useState)(''), query = _e[0], setQuery = _e[1];
    var _f = (0, react_1.useState)(''), department = _f[0], setDepartment = _f[1];
    var _g = (0, react_1.useState)(''), classificationLevel = _g[0], setClassificationLevel = _g[1];
    var _h = (0, react_1.useState)(''), status = _h[0], setStatus = _h[1];
    var _j = (0, react_1.useState)('all'), dateRange = _j[0], setDateRange = _j[1];
    var _k = (0, react_1.useState)(''), customStartDate = _k[0], setCustomStartDate = _k[1];
    var _l = (0, react_1.useState)(''), customEndDate = _l[0], setCustomEndDate = _l[1];
    // Sorting
    var _m = (0, react_1.useState)('updatedAt'), sortBy = _m[0], setSortBy = _m[1];
    var _o = (0, react_1.useState)('desc'), sortOrder = _o[0], setSortOrder = _o[1];
    // Pagination
    var _p = (0, react_1.useState)(0), page = _p[0], setPage = _p[1];
    var _q = (0, react_1.useState)(20), pageSize = _q[0], setPageSize = _q[1];
    var _r = (0, react_1.useState)(0), totalPages = _r[0], setTotalPages = _r[1];
    var _s = (0, react_1.useState)(0), totalElements = _s[0], setTotalElements = _s[1];
    // Batch selection
    var _t = (0, react_1.useState)(new Set()), selectedDocs = _t[0], setSelectedDocs = _t[1];
    var _u = (0, react_1.useState)(false), showBatchShareDialog = _u[0], setShowBatchShareDialog = _u[1];
    var _v = (0, react_1.useState)(false), exporting = _v[0], setExporting = _v[1];
    // Available options
    var _w = (0, react_1.useState)([]), departments = _w[0], setDepartments = _w[1];
    // Debounce search query
    var _x = (0, react_1.useState)(''), debouncedQuery = _x[0], setDebouncedQuery = _x[1];
    // Load filters from sessionStorage on mount
    (0, react_1.useEffect)(function () {
        var savedFilters = sessionStorage.getItem('documents-filters');
        if (savedFilters) {
            try {
                var filters = JSON.parse(savedFilters);
                setQuery(filters.query || '');
                setDepartment(filters.department || '');
                setClassificationLevel(filters.classificationLevel || '');
                setStatus(filters.status || '');
                setDateRange(filters.dateRange || 'all');
                setSortBy(filters.sortBy || 'updatedAt');
                setSortOrder(filters.sortOrder || 'desc');
                setPage(filters.page || 0);
                setPageSize(filters.pageSize || 20);
            }
            catch (e) {
                console.error('Failed to load saved filters:', e);
            }
        }
    }, []);
    // Save filters to sessionStorage
    (0, react_1.useEffect)(function () {
        var filters = {
            query: query,
            department: department,
            classificationLevel: classificationLevel,
            status: status,
            dateRange: dateRange,
            sortBy: sortBy,
            sortOrder: sortOrder,
            page: page,
            pageSize: pageSize
        };
        sessionStorage.setItem('documents-filters', JSON.stringify(filters));
    }, [query, department, classificationLevel, status, dateRange, sortBy, sortOrder, page, pageSize]);
    // Debounce search query (500ms)
    (0, react_1.useEffect)(function () {
        var timer = setTimeout(function () {
            setDebouncedQuery(query);
        }, 500);
        return function () { return clearTimeout(timer); };
    }, [query]);
    (0, react_1.useEffect)(function () {
        loadFilters();
    }, []);
    (0, react_1.useEffect)(function () {
        loadDocuments();
    }, [page, debouncedQuery, department, classificationLevel, status, dateRange, customStartDate, customEndDate, sortBy, sortOrder, pageSize]);
    var loadFilters = function () { return __awaiter(_this, void 0, void 0, function () {
        var depts, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, api_1.apiClient.getDepartments()];
                case 1:
                    depts = _a.sent();
                    setDepartments(depts.data || []);
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    console.error('Failed to load filters:', err_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var getDateRangeFilter = function () {
        if (dateRange === 'all')
            return undefined;
        var now = new Date();
        var startDate;
        switch (dateRange) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'custom':
                if (customStartDate && customEndDate) {
                    return { startDate: customStartDate, endDate: customEndDate };
                }
                return undefined;
            default:
                return undefined;
        }
        return { startDate: startDate.toISOString(), endDate: now.toISOString() };
    };
    var loadDocuments = function () { return __awaiter(_this, void 0, void 0, function () {
        var dateFilter, response, content, sorted, err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    dateFilter = getDateRangeFilter();
                    return [4 /*yield*/, api_1.apiClient.searchDocuments({
                            query: debouncedQuery || undefined,
                            department: department || undefined,
                            classificationLevel: classificationLevel || undefined,
                            status: status || undefined,
                            startDate: dateFilter === null || dateFilter === void 0 ? void 0 : dateFilter.startDate,
                            endDate: dateFilter === null || dateFilter === void 0 ? void 0 : dateFilter.endDate,
                            page: page,
                            pageSize: pageSize,
                            sortBy: sortBy,
                            sortOrder: sortOrder
                        })];
                case 2:
                    response = _c.sent();
                    content = response.data.content || [];
                    sorted = __spreadArray([], content, true).sort(function (a, b) {
                        var orderMultiplier = sortOrder === 'asc' ? 1 : -1;
                        switch (sortBy) {
                            case 'name': {
                                var an = (a.name || '').toString().toLowerCase();
                                var bn = (b.name || '').toString().toLowerCase();
                                if (an < bn)
                                    return -1 * orderMultiplier;
                                if (an > bn)
                                    return 1 * orderMultiplier;
                                return 0;
                            }
                            case 'ownerName': {
                                var ao = (a.ownerName || a.owner || '').toString().toLowerCase();
                                var bo = (b.ownerName || b.owner || '').toString().toLowerCase();
                                if (ao < bo)
                                    return -1 * orderMultiplier;
                                if (ao > bo)
                                    return 1 * orderMultiplier;
                                return 0;
                            }
                            case 'department': {
                                var ad = (a.department || '').toString().toLowerCase();
                                var bd = (b.department || '').toString().toLowerCase();
                                if (ad < bd)
                                    return -1 * orderMultiplier;
                                if (ad > bd)
                                    return 1 * orderMultiplier;
                                return 0;
                            }
                            case 'updatedAt':
                            default: {
                                var at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                                var bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                                if (at < bt)
                                    return -1 * orderMultiplier;
                                if (at > bt)
                                    return 1 * orderMultiplier;
                                return 0;
                            }
                        }
                    });
                    setDocuments(sorted);
                    setTotalPages(response.data.totalPages || 0);
                    setTotalElements(response.data.totalElements || 0);
                    // Clear selection when documents change
                    setSelectedDocs(new Set());
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _c.sent();
                    setError(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load documents');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleSearch = function (e) {
        e.preventDefault();
        setPage(0);
        // Debounce will trigger loadDocuments automatically
    };
    var handleReset = function () {
        setQuery('');
        setDebouncedQuery('');
        setDepartment('');
        setClassificationLevel('');
        setStatus('');
        setDateRange('all');
        setCustomStartDate('');
        setCustomEndDate('');
        setSortBy('updatedAt');
        setSortOrder('desc');
        setPage(0);
        setSelectedDocs(new Set());
    };
    var handleSort = function (field) {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        }
        else {
            setSortBy(field);
            setSortOrder('asc');
        }
        setPage(0);
    };
    var handleSelectAll = function () {
        if (selectedDocs.size === documents.length) {
            setSelectedDocs(new Set());
        }
        else {
            setSelectedDocs(new Set(documents.map(function (doc) { return doc.id; })));
        }
    };
    var handleSelectDoc = function (docId) {
        var newSelected = new Set(selectedDocs);
        if (newSelected.has(docId)) {
            newSelected.delete(docId);
        }
        else {
            newSelected.add(docId);
        }
        setSelectedDocs(newSelected);
    };
    var handleBatchExport = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, result, deniedList, err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (selectedDocs.size === 0)
                        return [2 /*return*/];
                    setExporting(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.batchExportDocuments(Array.from(selectedDocs))];
                case 2:
                    response = _c.sent();
                    result = response.data;
                    if (result.deniedCount > 0) {
                        deniedList = result.deniedDocuments.map(function (d) {
                            return "- ".concat(d.documentName, ": ").concat(d.reason);
                        }).join('\n');
                        alert("Export completed with some restrictions:\n\n".concat(deniedList));
                    }
                    if (result.exportedCount > 0 && result.downloadUrl) {
                        alert("Batch export preparation succeeded for ".concat(result.exportedCount, " document(s), but download is not permitted. Documents must be previewed individually to ensure per-viewer watermarks are applied for audit traceability."));
                    }
                    else {
                        alert('No documents were exported. Please check permissions.');
                    }
                    setSelectedDocs(new Set());
                    return [3 /*break*/, 5];
                case 3:
                    err_3 = _c.sent();
                    alert(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to export documents');
                    return [3 /*break*/, 5];
                case 4:
                    setExporting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleBatchShare = function (shareParams) { return __awaiter(_this, void 0, void 0, function () {
        var response, result, deniedList, err_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (selectedDocs.size === 0)
                        return [2 /*return*/];
                    setShowBatchShareDialog(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.batchShareDocuments(__assign({ documentIds: Array.from(selectedDocs) }, shareParams))];
                case 2:
                    response = _c.sent();
                    result = response.data;
                    if (result.deniedCount > 0) {
                        deniedList = result.deniedDocuments.map(function (d) {
                            return "- ".concat(d.documentName, ": ").concat(d.reason);
                        }).join('\n');
                        alert("Share completed with some restrictions:\n\n".concat(deniedList));
                    }
                    if (result.sharedCount > 0) {
                        alert("Successfully shared ".concat(result.sharedCount, " document(s)"));
                        setSelectedDocs(new Set());
                        loadDocuments();
                    }
                    else {
                        alert('No documents were shared. Please check permissions.');
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_4 = _c.sent();
                    alert(((_b = (_a = err_4.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to share documents');
                    return [3 /*break*/, 5];
                case 4:
                    setShowBatchShareDialog(false);
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
            case 'CLASSIFIED':
            case 'ACTIVE': return '#4caf50';
            case 'PROCESSING': return '#2196f3';
            case 'REVIEW_REQUIRED': return '#ff9800';
            case 'FAILED':
            case 'QUARANTINED': return '#f44336';
            default: return '#888';
        }
    };
    if (loading && documents.length === 0) {
        return (<DashboardLayout_1.default>
        <div className="dashboard">
          <h2>Loading documents...</h2>
        </div>
      </DashboardLayout_1.default>);
    }
    var selectedDocsArray = documents.filter(function (doc) { return selectedDocs.has(doc.id); });
    var canBatchShareSelected = selectedDocsArray.length > 0 && selectedDocsArray.every(function (doc) { return doc.ownerId === (user === null || user === void 0 ? void 0 : user.userId); });
    return (<DashboardLayout_1.default>
      <div className="dashboard">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1>Document Library</h1>
          <button onClick={function () { return navigate('/upload'); }} style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            📤 Upload Document
          </button>
        </div>

        {/* Search and Filters */}
        <div className="dashboard-card" style={{ marginBottom: '20px' }}>
          <form onSubmit={handleSearch}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <input type="text" placeholder="Search by name or description..." value={query} onChange={function (e) { return setQuery(e.target.value); }} style={{
            padding: '10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000'
        }}/>

              <select value={department} onChange={function (e) { return setDepartment(e.target.value); }} style={{
            padding: '10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000'
        }}>
                <option value="">All Departments</option>
                {departments.map(function (dept) { return (<option key={dept} value={dept}>{dept}</option>); })}
              </select>

              <select value={classificationLevel} onChange={function (e) { return setClassificationLevel(e.target.value); }} style={{
            padding: '10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000'
        }}>
                <option value="">All Classifications</option>
                <option value="PUBLIC">Public</option>
                <option value="INTERNAL">Internal</option>
                <option value="CONFIDENTIAL">Confidential</option>
                <option value="STRICTLY_CONFIDENTIAL">Strictly Confidential</option>
              </select>

              <select value={status} onChange={function (e) { return setStatus(e.target.value); }} style={{
            padding: '10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000'
        }}>
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="CLASSIFIED">Classified</option>
                <option value="PROCESSING">Processing</option>
                <option value="REVIEW_REQUIRED">Review Required</option>
                <option value="ARCHIVED">Archived</option>
                <option value="FAILED">Failed</option>
                <option value="QUARANTINED">Quarantined</option>
              </select>

              <select value={dateRange} onChange={function (e) {
            setDateRange(e.target.value);
            setPage(0);
        }} style={{
            padding: '10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000'
        }}>
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Date Range */}
            {dateRange === 'custom' && (<div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
                <label style={{ fontSize: '0.9em' }}>From:</label>
                <input type="date" value={customStartDate} onChange={function (e) {
                setCustomStartDate(e.target.value);
                setPage(0);
            }} style={{
                padding: '8px',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
            }}/>
                <label style={{ fontSize: '0.9em' }}>To:</label>
                <input type="date" value={customEndDate} onChange={function (e) {
                setCustomEndDate(e.target.value);
                setPage(0);
            }} style={{
                padding: '8px',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
            }}/>
              </div>)}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" style={{ padding: '10px 20px' }}>
                🔍 Search
              </button>
              <button type="button" onClick={handleReset} style={{ padding: '10px 20px', background: '#6c757d' }}>
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Results Info and Batch Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ color: '#888' }}>
          Showing {documents.length} of {totalElements} documents
            {selectedDocs.size > 0 && (<span style={{ marginLeft: '12px', color: '#007bff', fontWeight: '500' }}>
                ({selectedDocs.size} selected)
              </span>)}
          </div>
          {selectedDocs.size > 0 && (<div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleBatchExport} disabled={exporting} style={{
                padding: '8px 16px',
                background: exporting ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: exporting ? 'not-allowed' : 'pointer'
            }}>
                {exporting ? '⏳ Exporting...' : "\uD83D\uDCE6 Export Selected (".concat(selectedDocs.size, ")")}
              </button>
              <button onClick={function () {
                if (!canBatchShareSelected) {
                    alert('Only document owner can share. Please select only your own documents.');
                    return;
                }
                // For now, use a simple prompt. In the future, this can be replaced with BatchShareDialog
                var shareType = prompt('Share type (PUBLIC/PRIVATE):', 'PRIVATE');
                if (shareType) {
                    handleBatchShare({
                        shareType: shareType,
                        permissions: ['VIEW'],
                        expiresInDays: 7
                    });
                }
            }} disabled={exporting || showBatchShareDialog || !canBatchShareSelected} style={{
                padding: '8px 16px',
                background: (exporting || showBatchShareDialog || !canBatchShareSelected) ? '#6c757d' : '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (exporting || showBatchShareDialog || !canBatchShareSelected) ? 'not-allowed' : 'pointer'
            }} title={!canBatchShareSelected ? 'Only owner can share selected documents' : undefined}>
                {showBatchShareDialog ? '⏳ Sharing...' : (exporting ? '⏳ Exporting...' : "\uD83D\uDD17 Share Selected (".concat(selectedDocs.size, ")"))}
              </button>
            </div>)}
        </div>

        {/* Error Message */}
        {error && (<div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>)}

        {/* Documents Table */}
        {documents.length > 0 ? (<div className="dashboard-card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid ".concat(theme === 'dark' ? '#444' : '#ddd'), textAlign: 'left' }}>
                    <th style={{ padding: '12px', width: '40px' }}>
                      <input type="checkbox" checked={selectedDocs.size === documents.length && documents.length > 0} onChange={handleSelectAll} style={{ cursor: 'pointer' }}/>
                    </th>
                    <th style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }} onClick={function () { return handleSort('name'); }}>
                      Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }} onClick={function () { return handleSort('ownerName'); }}>
                      Owner {sortBy === 'ownerName' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }} onClick={function () { return handleSort('department'); }}>
                      Department {sortBy === 'department' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th style={{ padding: '12px' }}>Classification</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }} onClick={function () { return handleSort('updatedAt'); }}>
                      Updated {sortBy === 'updatedAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(function (doc) {
                var _a, _b;
                return (<tr key={doc.id} style={{
                        borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#eee'),
                        background: selectedDocs.has(doc.id) ? (theme === 'dark' ? '#2a3a4a' : '#e3f2fd') : 'transparent'
                    }}>
                      <td style={{ padding: '12px' }}>
                        <input type="checkbox" checked={selectedDocs.has(doc.id)} onChange={function () { return handleSelectDoc(doc.id); }} style={{ cursor: 'pointer' }}/>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: '500', cursor: 'pointer', color: '#007bff' }} onClick={function () { return navigate("/documents/".concat(doc.id)); }}>
                          {doc.name}
                        </div>
                        {doc.description && (<div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
                            {doc.description.substring(0, 80)}{doc.description.length > 80 ? '...' : ''}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8em',
                        fontWeight: '600',
                        background: getStatusColor(doc.status) + '33',
                        color: getStatusColor(doc.status)
                    }}>
                            {(_b = doc.status) === null || _b === void 0 ? void 0 : _b.replace('_', ' ')}
                          </span>
                          {doc.requiresReview && (<span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7em',
                            fontWeight: '500',
                            background: '#ff980033',
                            color: '#ff9800',
                            display: 'inline-block',
                            width: 'fit-content'
                        }}>
                              ⏳ Pending Review
                            </span>)}
                        </div>
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.9em' }}>
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={function () { return navigate("/documents/".concat(doc.id)); }} disabled={doc.canView === false} style={{
                        padding: '4px 8px',
                        fontSize: '0.85em',
                        background: doc.canView === false ? '#6c757d' : '#007bff',
                        cursor: doc.canView === false ? 'not-allowed' : 'pointer',
                        opacity: doc.canView === false ? 0.6 : 1
                    }} title={doc.canView === false ? 'You do not have permission to view this document' : 'View details'}>
                            👁 View
                          </button>
                          <button onClick={function () { return navigate("/documents/".concat(doc.id, "/signatures")); }} disabled={doc.canView === false} style={{
                        padding: '4px 8px',
                        fontSize: '0.85em',
                        background: doc.canView === false ? '#6c757d' : '#2196f3',
                        cursor: doc.canView === false ? 'not-allowed' : 'pointer',
                        opacity: doc.canView === false ? 0.6 : 1
                    }} title={doc.canView === false ? 'You do not have permission to view signatures for this document' : 'View signature chain'}>
                            ✍️
                          </button>
                        </div>
                      </td>
                    </tr>);
            })}
                </tbody>
              </table>
            </div>
          </div>) : (<div className="empty-state">No documents found. Try adjusting your filters or upload a new document.</div>)}

        {/* Pagination */}
        {totalPages > 1 && (<div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={function () { return setPage(0); }} disabled={page === 0} style={{ padding: '8px 12px', fontSize: '0.9em' }}>
              First
            </button>
            <button onClick={function () { return setPage(function (p) { return Math.max(0, p - 1); }); }} disabled={page === 0} style={{ padding: '8px 16px' }}>
              Previous
            </button>
            <span style={{ fontSize: '0.9em', color: '#888' }}>
              Page{' '}
              <input type="number" min="1" max={totalPages} value={page + 1} onChange={function (e) {
                var newPage = parseInt(e.target.value) - 1;
                if (newPage >= 0 && newPage < totalPages) {
                    setPage(newPage);
                }
            }} style={{
                width: '50px',
                padding: '4px',
                textAlign: 'center',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
            }}/>
              {' '}of {totalPages}
            </span>
            <button onClick={function () { return setPage(function (p) { return Math.min(totalPages - 1, p + 1); }); }} disabled={page >= totalPages - 1} style={{ padding: '8px 16px' }}>
              Next
            </button>
            <button onClick={function () { return setPage(totalPages - 1); }} disabled={page >= totalPages - 1} style={{ padding: '8px 12px', fontSize: '0.9em' }}>
              Last
            </button>
            <select value={pageSize} onChange={function (e) {
                setPageSize(Number(e.target.value));
                setPage(0);
            }} style={{
                padding: '8px',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
                marginLeft: '12px'
            }}>
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>)}
      </div>
    </DashboardLayout_1.default>);
}
