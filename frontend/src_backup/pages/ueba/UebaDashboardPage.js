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
exports.default = UebaDashboardPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var authStore_1 = require("../../store/authStore");
function UebaDashboardPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _a = (0, react_1.useState)([]), focusUsers = _a[0], setFocusUsers = _a[1];
    var _b = (0, react_1.useState)(''), userIdInput = _b[0], setUserIdInput = _b[1];
    var _c = (0, react_1.useState)(false), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(''), error = _d[0], setError = _d[1];
    var loadRiskScore = function () { return __awaiter(_this, void 0, void 0, function () {
        var uid, res, score, err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    uid = userIdInput.trim() ? Number(userIdInput) : undefined;
                    if (uid !== undefined && Number.isNaN(uid)) {
                        setError('Please enter a valid user ID');
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getUebaRiskScore(__assign({}, (uid !== undefined ? { userId: uid } : {})))];
                case 2:
                    res = _c.sent();
                    if (res.success && res.data) {
                        score = res.data.score;
                        if (score !== undefined) {
                            setError('');
                        }
                    }
                    else {
                        setError('Failed to load risk score');
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load risk score');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    /**
     * Load users with UEBA scores < 100 (i.e., risky users).
     * The backend query already excludes ADMIN and system accounts.
     */
    var loadFocusUsers = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, users, err_2;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 2, 3, 4]);
                    setLoading(true);
                    setError('');
                    return [4 /*yield*/, api_1.apiClient.getUebaUserScores({
                            includeAll: false,
                            sortBy: 'score',
                            sortOrder: 'asc',
                            page: 0,
                            size: 100
                        })];
                case 1:
                    res = _d.sent();
                    users = ((_a = res.data) === null || _a === void 0 ? void 0 : _a.content) || [];
                    setFocusUsers(users);
                    return [3 /*break*/, 4];
                case 2:
                    err_2 = _d.sent();
                    setError(((_c = (_b = err_2.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to load risky users');
                    setFocusUsers([]);
                    return [3 /*break*/, 4];
                case 3:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        loadRiskScore();
        loadFocusUsers();
    }, []);
    var cardStyle = {
        background: theme === 'dark' ? '#2a2a2a' : '#fff',
        border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '16px'
    };
    return (<DashboardLayout_1.default>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <h1 style={{ margin: 0 }}>UEBA Risk Overview</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="text" placeholder="User ID (optional)" value={userIdInput} onChange={function (e) { return setUserIdInput(e.target.value); }} style={{
            padding: '8px 12px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            borderRadius: '4px',
            background: theme === 'dark' ? '#1a1a1a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000',
            width: '140px'
        }}/>
          <button onClick={loadRiskScore} disabled={loading} style={{ padding: '8px 16px' }}>
            {loading ? 'Loading…' : 'Query risk'}
          </button>
          <button onClick={function () { return navigate('/ueba/incidents'); }} style={{ padding: '8px 16px' }}>
            Anomaly incidents
          </button>
          <button onClick={function () { return navigate('/ueba/users'); }} style={{ padding: '8px 16px' }}>
            All UEBA users
          </button>
          <button onClick={function () { return navigate('/ueba/policies'); }} style={{ padding: '8px 16px' }}>
            Rules & policy
          </button>
        </div>
      </div>

      {error && (<div style={__assign(__assign({}, cardStyle), { borderColor: '#f44336', color: '#f44336' })}>{error}</div>)}

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Risky users (score below 100)</h3>
        <p style={{ color: '#888', fontSize: '0.85em', marginBottom: '12px' }}>
          Users with UEBA score below 100 — lower scores indicate anomalous behavior detected.
          Score ≤70 triggers account disable. ADMIN accounts are excluded.
        </p>
        {focusUsers.length === 0 ? (<p style={{ margin: 0, color: '#888' }}>No users below 100.</p>) : (<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {focusUsers.map(function (u) { return (<div key={u.userId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '6px', background: theme === 'dark' ? '#1f1f1f' : '#f7f7f7' }}>
                <div style={{ fontSize: '0.9em' }}>
                  <strong>{u.accountId}</strong> · {u.fullName || '—'} · {u.department || 'N/A'}
                </div>
                <div style={{ fontWeight: 700, color: u.uebaScore <= 50 ? '#e53935' : u.uebaScore <= 90 ? '#fbc02d' : '#43a047' }}>
                  {u.uebaScore}
                </div>
              </div>); })}
          </div>)}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>About</h3>
        <p style={{ margin: 0, color: '#888' }}>
          UEBA (User and Entity Behavior Analytics) monitors user behavior to detect anomalies.
          When audit events (e.g., access denials) trigger HIGH/CRITICAL risk, the LLM analyzes
          the context and applies confidence-weighted scoring. Score ≤70 disables the account.
        </p>
      </div>
    </DashboardLayout_1.default>);
}
