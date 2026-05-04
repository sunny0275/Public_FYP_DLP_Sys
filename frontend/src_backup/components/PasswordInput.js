"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PasswordInput;
var react_1 = require("react");
function PasswordInput(_a) {
    var id = _a.id, name = _a.name, value = _a.value, onChange = _a.onChange, _b = _a.required, required = _b === void 0 ? false : _b, _c = _a.autoFocus, autoFocus = _c === void 0 ? false : _c, placeholder = _a.placeholder, label = _a.label, _d = _a.disabled, disabled = _d === void 0 ? false : _d, _e = _a.className, className = _e === void 0 ? '' : _e;
    var _f = (0, react_1.useState)(false), showPassword = _f[0], setShowPassword = _f[1];
    var inputRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);
    return (<div className={"form-group ".concat(className)}>
      {label && <label htmlFor={id}>{label}</label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input ref={inputRef} id={id} name={name} type={showPassword ? 'text' : 'password'} value={value} onChange={onChange} required={required} placeholder={placeholder} disabled={disabled} style={{ paddingRight: '40px', width: '100%' }}/>
        <button type="button" onClick={function () { return setShowPassword(!showPassword); }} disabled={disabled} style={{
            position: 'absolute',
            right: '10px',
            background: 'transparent',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: disabled ? '#ccc' : '#666',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled ? 0.5 : 1,
            transition: 'color 0.2s'
        }} title={showPassword ? 'Hide password' : 'Show password'} onMouseEnter={function (e) { if (!disabled)
        e.currentTarget.style.color = '#333'; }} onMouseLeave={function (e) { e.currentTarget.style.color = disabled ? '#ccc' : '#666'; }}>
          {showPassword ? (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>) : (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>)}
        </button>
      </div>
    </div>);
}
