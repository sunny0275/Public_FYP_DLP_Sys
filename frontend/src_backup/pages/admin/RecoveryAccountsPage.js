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
exports.default = RecoveryAccountsPage;
var react_1 = require("react");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
function RecoveryAccountsPage() {
    var _this = this;
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _a = (0, react_1.useState)([]), recoverableUsers = _a[0], setRecoverableUsers = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(''), searchTerm = _d[0], setSearchTerm = _d[1];
    var _e = (0, react_1.useState)('deletedAt'), sortBy = _e[0], setSortBy = _e[1];
    var _f = (0, react_1.useState)('desc'), sortOrder = _f[0], setSortOrder = _f[1];
    (0, react_1.useEffect)(function () {
        load();
        var interval = setInterval(load, 30000);
        return function () { return clearInterval(interval); };
    }, []);
    var load = function () { return __awaiter(_this, void 0, void 0, function () {
        var usersRes, allUsers, now_1, THIRTY_DAYS_MS_1, recoverables, err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getAllUsers()];
                case 2:
                    usersRes = _c.sent();
                    allUsers = usersRes.data || [];
                    now_1 = Date.now();
                    THIRTY_DAYS_MS_1 = 30 * 24 * 60 * 60 * 1000;
                    recoverables = allUsers.filter(function (u) {
                        if (!u.deletedAt)
                            return false;
                        return now_1 - new Date(u.deletedAt).getTime() <= THIRTY_DAYS_MS_1;
                    });
                    setRecoverableUsers(recoverables);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load recoverable accounts');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleRestoreUser = function (userId) { return __awaiter(_this, void 0, void 0, function () {
        var err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm('Restore this deleted account (within the last 30 days)?\n\nThe account will be restored in a DISABLED state and must be re-enabled by an admin.')) {
                        return [2 /*return*/];
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.restoreUser(userId)];
                case 2:
                    _c.sent();
                    alert('Account restored successfully');
                    load();
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _c.sent();
                    alert(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to restore account');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handlePurgeUser = function (user) { return __awaiter(_this, void 0, void 0, function () {
        var err_3;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!confirm("\u26A0\uFE0F PERMANENT DELETE (cannot be undone)\n\nAccount: ".concat(user.accountId, "\nName: ").concat(user.fullName, "\n\nThis will permanently delete the user account record. Documents and related records will be reassigned to the archived identity.\n\nProceed?"))) {
                        return [2 /*return*/];
                    }
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.purgeUser(user.id)];
                case 2:
                    _e.sent();
                    alert('Account permanently deleted');
                    load();
                    return [3 /*break*/, 4];
                case 3:
                    err_3 = _e.sent();
                    alert(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || ((_d = (_c = err_3.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.details) || 'Failed to permanently delete account');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var filteredAndSorted = (0, react_1.useMemo)(function () {
        var search = searchTerm.toLowerCase();
        return recoverableUsers
            .filter(function (user) {
            if (!searchTerm)
                return true;
            return (user.id.toString().includes(search) ||
                user.accountId.toLowerCase().includes(search) ||
                user.fullName.toLowerCase().includes(search) ||
                user.email.toLowerCase().includes(search));
        })
            .sort(function (a, b) {
            var aValue = '';
            var bValue = '';
            switch (sortBy) {
                case 'id':
                    aValue = a.id;
                    bValue = b.id;
                    break;
                case 'accountId':
                    aValue = a.accountId.toLowerCase();
                    bValue = b.accountId.toLowerCase();
                    break;
                case 'fullName':
                    aValue = a.fullName.toLowerCase();
                    bValue = b.fullName.toLowerCase();
                    break;
                case 'email':
                    aValue = a.email.toLowerCase();
                    bValue = b.email.toLowerCase();
                    break;
                case 'deletedAt':
                    aValue = new Date(a.deletedAt).getTime();
                    bValue = new Date(b.deletedAt).getTime();
                    break;
            }
            if (aValue < bValue)
                return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue)
                return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [recoverableUsers, searchTerm, sortBy, sortOrder]);
    var requestSort = function (field) {
        if (sortBy === field) {
            setSortOrder(function (prev) { return (prev === 'asc' ? 'desc' : 'asc'); });
        }
        else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };
    var getSortIndicator = function (field) {
        if (sortBy !== field)
            return '';
        return sortOrder === 'asc' ? ' ↑' : ' ↓';
    };
    return (<div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Recovery Accounts</h1>
          <p style={{ color: '#888', marginTop: '6px' }}>
            Manage accounts deleted within the last 30 days. You can search, sort, and restore them.
          </p>
        </div>
      </div>

      <div className="dashboard-card">
        {error && (<div className="error-message" style={{ marginBottom: '16px' }}>
            {error}
          </div>)}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <input type="text" placeholder="Search by ID, Account ID, Name, Email..." value={searchTerm} onChange={function (e) { return setSearchTerm(e.target.value); }} style={{
            flex: 1,
            minWidth: '220px',
            padding: '10px 12px',
            borderRadius: '6px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000'
        }}/>
          <div style={{ alignSelf: 'center', color: '#888', fontSize: '0.9em' }}>
            Showing {filteredAndSorted.length} of {recoverableUsers.length} accounts
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '900px' }}>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={function () { return requestSort('id'); }}>
                  ID{getSortIndicator('id')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={function () { return requestSort('accountId'); }}>
                  Account ID{getSortIndicator('accountId')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={function () { return requestSort('fullName'); }}>
                  Full Name{getSortIndicator('fullName')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={function () { return requestSort('email'); }}>
                  Email{getSortIndicator('email')}
                </th>
                <th>Department</th>
                <th>Position</th>
                <th>Roles</th>
                <th style={{ cursor: 'pointer' }} onClick={function () { return requestSort('deletedAt'); }}>
                  Deleted At{getSortIndicator('deletedAt')}
                </th>
                <th>Remaining Days</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (<tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center' }}>
                    Loading...
                  </td>
                </tr>) : filteredAndSorted.length === 0 ? (<tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                    {recoverableUsers.length === 0
                ? 'No deleted accounts available for recovery right now.'
                : 'No accounts match the search criteria.'}
                  </td>
                </tr>) : (filteredAndSorted.map(function (user) {
            var deletedDate = new Date(user.deletedAt);
            var daysSinceDeleted = Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24));
            var remainingDays = 30 - daysSinceDeleted;
            return (<tr key={user.id}>
                      <td>{user.id}</td>
                      <td>
                        <strong>{user.accountId}</strong>
                      </td>
                      <td>{user.fullName}</td>
                      <td>{user.email}</td>
                      <td>{user.department || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {user.roles.length > 0
                    ? user.roles.map(function (role) { return (<span key={role} style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: theme === 'dark' ? '#2a2a2a' : '#f0f0f0',
                            fontSize: '0.75em'
                        }}>
                                  {role}
                                </span>); })
                    : '-'}
                        </div>
                      </td>
                      <td>
                        <div>{deletedDate.toLocaleString()}</div>
                      </td>
                      <td style={{ color: remainingDays <= 7 ? '#ff6b6b' : '#888' }}>
                        {remainingDays > 0 ? "".concat(remainingDays, " days") : 'Expired'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={function () { return handleRestoreUser(user.id); }} disabled={remainingDays <= 0} style={{
                    padding: '6px 12px',
                    fontSize: '0.85em',
                    background: remainingDays <= 0 ? '#6c757d' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: remainingDays <= 0 ? 'not-allowed' : 'pointer',
                    opacity: remainingDays <= 0 ? 0.6 : 1
                }} title={remainingDays <= 0 ? 'Recovery period expired' : 'Restore this account'}>
                            Restore
                          </button>
                          <button onClick={function () { return handlePurgeUser(user); }} style={{
                    padding: '6px 12px',
                    fontSize: '0.85em',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }} title="Permanently delete this account">
                            Delete Permanently
                          </button>
                        </div>
                      </td>
                    </tr>);
        }))}
            </tbody>
          </table>
        </div>
      </div>
    </div>);
}
