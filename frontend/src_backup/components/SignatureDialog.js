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
exports.default = SignatureDialog;
var react_1 = require("react");
var api_1 = require("../api");
require("../modal.css");
function SignatureDialog(_a) {
    var _this = this;
    var documentId = _a.documentId, documentName = _a.documentName, onSign = _a.onSign, onClose = _a.onClose;
    var _b = (0, react_1.useState)(false), signing = _b[0], setSigning = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    var handleSign = function () { return __awaiter(_this, void 0, void 0, function () {
        var hashRes, documentHash, signatureResponse, error_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setSigning(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, api_1.apiClient.getDocumentHash(documentId)];
                case 2:
                    hashRes = _c.sent();
                    documentHash = hashRes.data.hash;
                    return [4 /*yield*/, api_1.apiClient.signDocument({
                            documentId: documentId,
                            documentHash: documentHash
                        })];
                case 3:
                    signatureResponse = _c.sent();
                    alert('Document signed successfully!');
                    onSign(signatureResponse.data);
                    onClose();
                    return [3 /*break*/, 6];
                case 4:
                    error_1 = _c.sent();
                    console.error('Signature error:', error_1);
                    setError(((_b = (_a = error_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to sign document. Please try again.');
                    return [3 /*break*/, 6];
                case 5:
                    setSigning(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    return (<div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={function (e) { return e.stopPropagation(); }} style={{ maxWidth: '500px' }}>
        <h2>Sign Document</h2>

        {/* Document Info */}
        <div style={{
            background: '#f5f5f5',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '24px'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Document:</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 'bold' }}>
            {documentName}
          </p>
        </div>

        {/* Warning */}
        <div style={{
            background: '#fff3cd',
            border: '1px solid #ffeb3b',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>
            <strong>⚠️ Legal Notice:</strong> By signing this document, you are creating a legally binding
            digital signature. This action cannot be undone and will be permanently recorded in the audit trail.
          </p>
        </div>

        {/* Error Message */}
        {error && (<div style={{
                background: '#ffebee',
                border: '1px solid #f44336',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
            }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#c62828' }}>
              {error}
            </p>
          </div>)}

        {/* Info */}
        <div style={{
            background: '#f5f5f5',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#555'
        }}>
          This signature will be created automatically using your account’s signing key (stored encrypted on the server).
        </div>

        {/* Technical Info */}
        <div style={{
            background: '#e3f2fd',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px'
        }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#1976d2' }}>
            <strong>🔒 Signature Technology:</strong>
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '12px', color: '#1976d2' }}>
            <li>ECDSA with secp256k1 curve (Ethereum-compatible)</li>
            <li>RFC 3161 cryptographic timestamp</li>
            <li>SHA-256 document hashing</li>
            <li>Per-user signing key stored encrypted on the server</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={signing} style={{
            padding: '10px 20px',
            background: '#9e9e9e',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: signing ? 'not-allowed' : 'pointer',
            fontSize: '14px'
        }}>
            Cancel
          </button>
          <button onClick={handleSign} disabled={signing} style={{
            padding: '10px 20px',
            background: signing ? '#ccc' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: signing ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
        }}>
            {signing ? 'Signing...' : '✍ Sign Document'}
          </button>
        </div>
      </div>
    </div>);
}
