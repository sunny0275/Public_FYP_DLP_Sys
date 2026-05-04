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
exports.default = BlockchainHealthPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
function BlockchainHealthPage() {
    var _this = this;
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _j = (0, react_1.useState)(null), blockchainHealth = _j[0], setBlockchainHealth = _j[1];
    var _k = (0, react_1.useState)(false), blockchainHealthLoading = _k[0], setBlockchainHealthLoading = _k[1];
    var _l = (0, react_1.useState)(''), blockchainHealthError = _l[0], setBlockchainHealthError = _l[1];
    var _m = (0, react_1.useState)(''), txHashQuery = _m[0], setTxHashQuery = _m[1];
    var _o = (0, react_1.useState)(false), txLookupLoading = _o[0], setTxLookupLoading = _o[1];
    var _p = (0, react_1.useState)(''), txLookupError = _p[0], setTxLookupError = _p[1];
    var _q = (0, react_1.useState)(null), txLookupResult = _q[0], setTxLookupResult = _q[1];
    var loadBlockchainHealth = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setBlockchainHealthLoading(true);
                    setBlockchainHealthError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getBlockchainHealth()];
                case 2:
                    response = _c.sent();
                    setBlockchainHealth(response.data || null);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    setBlockchainHealth(null);
                    setBlockchainHealthError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load blockchain health');
                    return [3 /*break*/, 5];
                case 4:
                    setBlockchainHealthLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleLookupTx = function () { return __awaiter(_this, void 0, void 0, function () {
        var txHash, response, err_2;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    txHash = txHashQuery.trim();
                    if (!txHash) {
                        setTxLookupError('Please enter a transaction hash');
                        return [2 /*return*/];
                    }
                    setTxLookupLoading(true);
                    setTxLookupError('');
                    setTxLookupResult(null);
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getBlockchainTransaction(txHash)];
                case 2:
                    response = _e.sent();
                    setTxLookupResult(response.data || null);
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _e.sent();
                    setTxLookupResult(((_b = (_a = err_2 === null || err_2 === void 0 ? void 0 : err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.data) || null);
                    setTxLookupError(((_d = (_c = err_2.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || 'Failed to lookup transaction');
                    return [3 /*break*/, 5];
                case 4:
                    setTxLookupLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (<DashboardLayout_1.default>
      <div className="dashboard">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h1 style={{ marginBottom: '6px' }}>Blockchain Health</h1>
            <p style={{ margin: 0, color: '#888' }}>
              Runtime status and transaction diagnostics.
            </p>
          </div>
          <button onClick={function () { return navigate('/admin'); }}>Back to Admin Panel</button>
        </div>

        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 600 }}>Chain Runtime</div>
            <button onClick={loadBlockchainHealth} disabled={blockchainHealthLoading} style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: 'none',
            background: blockchainHealthLoading ? '#999' : '#1976d2',
            color: '#fff',
            cursor: blockchainHealthLoading ? 'not-allowed' : 'pointer'
        }}>
              {blockchainHealthLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {blockchainHealthError ? (<div style={{ marginTop: '10px', color: '#d32f2f', fontSize: '13px' }}>{blockchainHealthError}</div>) : blockchainHealth ? (<div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '13px' }}>
              <div><strong>Status:</strong> {blockchainHealth.status || 'UNKNOWN'}</div>
              <div><strong>Enabled:</strong> {String(blockchainHealth.enabled)}</div>
              <div><strong>Ready:</strong> {String(blockchainHealth.ready)}</div>
              <div><strong>PrivateKey Valid:</strong> {String(blockchainHealth.privateKeyValid)}</div>
              <div><strong>RPC Reachable:</strong> {String(blockchainHealth.rpcReachable)}</div>
              <div><strong>Configured Chain:</strong> {String((_a = blockchainHealth.configuredChainId) !== null && _a !== void 0 ? _a : 'N/A')}</div>
              <div><strong>Actual Chain:</strong> {String((_b = blockchainHealth.actualChainId) !== null && _b !== void 0 ? _b : 'N/A')}</div>
              <div><strong>Address:</strong> {blockchainHealth.address || 'N/A'}</div>
              <div><strong>Balance (ETH):</strong> {String((_c = blockchainHealth.balanceEth) !== null && _c !== void 0 ? _c : 'N/A')}</div>
              <div><strong>RPC:</strong> {blockchainHealth.rpcUrl || 'N/A'}</div>
            </div>) : (<div style={{ marginTop: '10px', fontSize: '13px', color: theme === 'dark' ? '#ccc' : '#666' }}>
              No data. Click Refresh to query blockchain health.
            </div>)}
        </div>

        <div className="dashboard-card">
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>Lookup Transaction by Hash</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input type="text" value={txHashQuery} onChange={function (e) { return setTxHashQuery(e.target.value); }} placeholder="0x..." style={{
            flex: '1 1 420px',
            minWidth: '260px',
            padding: '8px',
            borderRadius: '6px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ccc'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#111'
        }}/>
            <button onClick={handleLookupTx} disabled={txLookupLoading} style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            background: txLookupLoading ? '#999' : '#5e35b1',
            color: '#fff',
            cursor: txLookupLoading ? 'not-allowed' : 'pointer'
        }}>
              {txLookupLoading ? 'Checking...' : 'Check Tx'}
            </button>
          </div>
          {txLookupError && (<div style={{ marginTop: '8px', color: '#d32f2f', fontSize: '13px' }}>{txLookupError}</div>)}
          {txLookupResult && (<div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '13px' }}>
              <div><strong>Status:</strong> {txLookupResult.status || 'N/A'}</div>
              <div><strong>Found:</strong> {String((_d = txLookupResult.found) !== null && _d !== void 0 ? _d : false)}</div>
              <div><strong>Mined:</strong> {String((_e = txLookupResult.mined) !== null && _e !== void 0 ? _e : false)}</div>
              <div><strong>Block:</strong> {String((_f = txLookupResult.blockNumber) !== null && _f !== void 0 ? _f : 'N/A')}</div>
              <div><strong>From:</strong> {txLookupResult.from || 'N/A'}</div>
              <div><strong>To:</strong> {txLookupResult.to || 'N/A'}</div>
              <div><strong>Receipt Status:</strong> {txLookupResult.receiptStatus || 'N/A'}</div>
              <div><strong>Chain:</strong> {String((_h = (_g = txLookupResult.actualChainId) !== null && _g !== void 0 ? _g : txLookupResult.configuredChainId) !== null && _h !== void 0 ? _h : 'N/A')}</div>
              <div style={{ gridColumn: '1 / -1' }}>
                <strong>Input:</strong> <span style={{ fontFamily: 'monospace' }}>{txLookupResult.input || 'N/A'}</span>
              </div>
              {txLookupResult.message && (<div style={{ gridColumn: '1 / -1', color: theme === 'dark' ? '#ccc' : '#555' }}>
                  <strong>Message:</strong> {txLookupResult.message}
                </div>)}
            </div>)}
        </div>
      </div>
    </DashboardLayout_1.default>);
}
