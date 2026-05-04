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
exports.default = UebaUsersPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var authStore_1 = require("../../store/authStore");
var api_1 = require("../../api");
function UebaUsersPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _a = (0, react_1.useState)([]), items = _a[0], setItems = _a[1];
    var _b = (0, react_1.useState)([]), departments = _b[0], setDepartments = _b[1];
    var _c = (0, react_1.useState)(false), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(''), error = _d[0], setError = _d[1];
    var _e = (0, react_1.useState)(null), resettingUserId = _e[0], setResettingUserId = _e[1];
    var _f = (0, react_1.useState)(''), query = _f[0], setQuery = _f[1];
    var _g = (0, react_1.useState)(''), department = _g[0], setDepartment = _g[1];
    var _h = (0, react_1.useState)(false), includeAll = _h[0], setIncludeAll = _h[1];
    var _j = (0, react_1.useState)('createdAt'), sortBy = _j[0], setSortBy = _j[1];
    var _k = (0, react_1.useState)('desc'), sortOrder = _k[0], setSortOrder = _k[1];
    var loadDepartments = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, api_1.apiClient.getDepartments()];
                case 1:
                    res = _b.sent();
                    setDepartments(res.data || []);
                    return [3 /*break*/, 3];
                case 2:
                    _a = _b.sent();
                    setDepartments([]);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var load = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var res, err_1;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getUebaUserScores({
                            query: query || undefined,
                            department: department || undefined,
                            includeAll: includeAll,
                            sortBy: sortBy,
                            sortOrder: sortOrder,
                            page: 0,
                            size: 100
                        })];
                case 2:
                    res = _d.sent();
                    setItems(((_a = res.data) === null || _a === void 0 ? void 0 : _a.content) || []);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _d.sent();
                    setError(((_c = (_b = err_1.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to load UEBA user scores');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [query, department, includeAll, sortBy, sortOrder]);
    (0, react_1.useEffect)(function () {
        loadDepartments();
    }, []);
    (0, react_1.useEffect)(function () {
        load();
    }, [load]);
    var handleResetUserScore = function (user) { return __awaiter(_this, void 0, void 0, function () {
        var shouldEnable, err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    shouldEnable = !user.accountEnabled
                        ? window.confirm("User ".concat(user.accountId, " is disabled. Re-enable account while resetting UEBA score?"))
                        : false;
                    if (!window.confirm("Reset UEBA score to 100 for ".concat(user.accountId, "?")))
                        return [2 /*return*/];
                    setResettingUserId(user.userId);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, api_1.apiClient.resetUserUebaScore(user.userId, shouldEnable)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, load()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 6];
                case 4:
                    err_2 = _c.sent();
                    setError(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to reset UEBA score for selected user');
                    return [3 /*break*/, 6];
                case 5:
                    setResettingUserId(null);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var isAdminUser = function (roles) {
        if (!roles || roles.length === 0)
            return false;
        return roles.some(function (role) {
            var r = role.toUpperCase();
            return r === 'ADMIN' || r === 'ROLE_ADMIN';
        });
    };
    return (<DashboardLayout_1.default>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>UEBA User Scores</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={function () { return load(); }} disabled={loading} style={{ padding: '8px 16px' }}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button onClick={function () { return navigate('/ueba'); }} style={{ padding: '8px 16px' }}>Back to UEBA</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input value={query} onChange={function (e) { return setQuery(e.target.value); }} placeholder="Search by account ID / name" style={{ padding: '8px 10px', minWidth: 220 }}/>
        <select value={department} onChange={function (e) { return setDepartment(e.target.value); }} style={{ padding: '8px 10px' }}>
          <option value="">All departments</option>
          {departments.map(function (d) { return <option key={d} value={d}>{d}</option>; })}
        </select>
        <select value={sortBy} onChange={function (e) { return setSortBy(e.target.value); }} style={{ padding: '8px 10px' }}>
          <option value="createdAt">Sort by created time</option>
          <option value="score">Sort by UEBA score</option>
        </select>
        <select value={sortOrder} onChange={function (e) { return setSortOrder(e.target.value); }} style={{ padding: '8px 10px' }}>
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={includeAll} onChange={function (e) { return setIncludeAll(e.target.checked); }}/>
          Include score=100
        </label>
      </div>

      {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="dashboard-card">
        {loading && items.length === 0 ? (<div>Loading...</div>) : (<div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd') }}>
                  <th style={{ textAlign: 'left', padding: 10 }}>Account ID</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Name</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Department</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Role</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>UEBA Score</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Created</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Status</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map(function (u) {
                var admin = isAdminUser(u.roles);
                return (<tr key={u.userId} style={{ borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#eee') }}>
                    <td style={{ padding: 10 }}>{u.accountId}</td>
                    <td style={{ padding: 10 }}>{u.fullName}</td>
                    <td style={{ padding: 10 }}>{u.department || 'N/A'}</td>
                    <td style={{ padding: 10 }}>
                      {u.roles && u.roles.length > 0 ? (u.roles.map(function (role, idx) { return (<span key={idx} style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            marginRight: 4,
                            borderRadius: 4,
                            fontSize: 11,
                            background: role.toUpperCase().includes('ADMIN') ? '#e3f2fd' : '#f5f5f5',
                            color: role.toUpperCase().includes('ADMIN') ? '#1565c0' : '#666'
                        }}>{role}</span>); })) : '—'}
                    </td>
                    <td style={{ padding: 10, fontWeight: 700, color: u.uebaScore <= 50 ? '#ff6b6b' : u.uebaScore <= 90 ? '#ffa500' : '#4caf50' }}>
                      {u.uebaScore}
                      {admin && <span style={{ marginLeft: 6, fontSize: 11, color: '#1565c0' }}>(protected)</span>}
                    </td>
                    <td style={{ padding: 10 }}>{u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}</td>
                    <td style={{ padding: 10 }}>{u.accountEnabled ? 'Enabled' : 'Disabled'}</td>
                    <td style={{ padding: 10 }}>
                      <button onClick={function () { return handleResetUserScore(u); }} disabled={resettingUserId === u.userId || admin} title={admin ? 'Admin accounts cannot be reset' : 'Reset score to 100'} style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: admin ? '#ccc' : '#6f42c1',
                        color: '#fff',
                        cursor: resettingUserId === u.userId || admin ? 'not-allowed' : 'pointer'
                    }}>
                        {resettingUserId === u.userId ? 'Resetting...' : admin ? 'Protected' : 'Reset'}
                      </button>
                    </td>
                  </tr>);
            })}
              </tbody>
            </table>
            {items.length === 0 && !loading && <div style={{ padding: 20, textAlign: 'center' }}>No users found</div>}
          </div>)}
      </div>
    </DashboardLayout_1.default>);
}
