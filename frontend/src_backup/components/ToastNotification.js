"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ToastNotification;
var react_1 = require("react");
function ToastNotification(_a) {
    var message = _a.message, type = _a.type, isVisible = _a.isVisible, onClose = _a.onClose, _b = _a.duration, duration = _b === void 0 ? 5000 : _b;
    (0, react_1.useEffect)(function () {
        if (isVisible) {
            var timer_1 = setTimeout(function () {
                onClose();
            }, duration);
            return function () { return clearTimeout(timer_1); };
        }
    }, [isVisible, duration, onClose]);
    if (!isVisible)
        return null;
    var colors = {
        success: { bg: '#4caf50', icon: '✓' },
        error: { bg: '#f44336', icon: '✗' },
        warning: { bg: '#ff9800', icon: '⚠' },
        info: { bg: '#2196f3', icon: 'ℹ' }
    };
    var color = colors[type];
    return (<div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: color.bg,
            color: 'white',
            padding: '16px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: '300px',
            maxWidth: '500px',
            animation: 'slideInRight 0.3s ease-out'
        }}>
      <span style={{ fontSize: '20px' }}>{color.icon}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
        ×
      </button>
      <style>{"\n        @keyframes slideInRight {\n          from {\n            transform: translateX(100%);\n            opacity: 0;\n          }\n          to {\n            transform: translateX(0);\n            opacity: 1;\n          }\n        }\n      "}</style>
    </div>);
}
