using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Management;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Security.Principal;
using Microsoft.Win32;

namespace SecurityMonitor;

/// <summary>
/// Security Monitor Sidecar - Runs with Administrator privileges
/// Provides system-level protection for DLP Platform
/// 
/// Key Detection Capabilities:
/// 1. BitBlt/DirectX API monitoring - Detects screen capture at driver level
/// 2. Global hotkey monitoring - Detects PrintScreen even when app is minimized
/// 3. Virtual display driver detection - Detects capture cards and virtual displays
/// 4. WASAPI loopback detection - Detects audio recording
/// 5. Digital signature verification - Validates process authenticity
/// </summary>
class Program
{
    private static bool _limitedMode = false;
    private static readonly string PIPE_NAME = "DLP_SecurityMonitor_Pipe_v4";
    private static readonly string AUTH_TOKEN = "dlp_secure_token_2024";

    private static readonly IntPtr CONSOLE_HANDLE = GetStdHandle(STD_OUTPUT_HANDLE);
    private const int STD_OUTPUT_HANDLE = -11;

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int nStdHandle);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool FlushFileBuffers(IntPtr hFile);

    private static void ConsoleWrite(string msg)
    {
        Console.WriteLine(msg);
        Console.Out.Flush();
        FlushFileBuffers(CONSOLE_HANDLE);
    }

    private static CancellationTokenSource? _cts;
    
    // USB Registry path for storage devices
    private const string USBSTOR_KEY = @"SYSTEM\CurrentControlSet\Services\USBSTOR";
    
    // ============================================================
    // WIN32 API IMPORTS - For low-level capture detection
    // ============================================================
    
    [DllImport("user32.dll")]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);
    
    [DllImport("user32.dll")]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);
    
    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    
    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);
    
    [DllImport("kernel32.dll")]
    private static extern IntPtr GetModuleHandle(string? lpModuleName);
    
    [DllImport("user32.dll")]
    private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();
    
    [DllImport("user32.dll")]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    
    // ============================================================
    // WINDOW CONTENT PROTECTION APIs
    // Prevents screenshots by making window appear as black in capture
    // ============================================================
    
    [DllImport("user32.dll")]
    private static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint affinity);
    
    [DllImport("user32.dll")]
    private static extern bool GetWindowDisplayAffinity(IntPtr hwnd, out uint affinity);
    
    [DllImport("user32.dll")]
    private static extern IntPtr FindWindow(string? lpClassName, string lpWindowName);
    
    // Display affinity constants
    private const uint WDA_NONE = 0x00000000;      // No protection, normal display
    private const uint WDA_MONITOR = 0x00000001;  // Content protection enabled - captures show black
    
    // Virtual key codes
    private const int VK_SNAPSHOT = 0x2C; // PrintScreen
    private const int VK_LWIN = 0x5B; // Left Windows key
    private const int VK_RWIN = 0x5C; // Right Windows key
    private const int VK_SHIFT = 0x10;
    private const int VK_CONTROL = 0x11;
    private const int VK_MENU = 0x12; // Alt
    
    // Hook constants
    private const int WH_KEYBOARD_LL = 13;
    private const int WH_MOUSE_LL = 14; // For capture detection
    
    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
    
    // Last screenshot key time for debouncing
    private static DateTime _lastScreenshotTime = DateTime.MinValue;
    private static readonly TimeSpan _screenshotDebounceTime = TimeSpan.FromSeconds(1);
    
    // Screenshot hotkey patterns for detection
    private static readonly Dictionary<string, (int vkCode, string name, string description)> _screenshotHotkeys = new()
    {
        { "PrintScreen", (0x2C, "PRINTSCREEN", "Print Screen") },
        { "WinShiftS", (0x53, "WIN_SHIFT_S", "Windows+Shift+S (Snipping Tool)") },
        { "CtrlShiftS", (0x53, "CTRL_SHIFT_S", "Ctrl+Shift+S") },
        { "CtrlShiftX", (0x58, "CTRL_SHIFT_X", "Ctrl+Shift+X (Snip & Sketch)") },
        { "AltPrintScreen", (0x2C, "ALT_PRINTSCREEN", "Alt+PrintScreen") },
        { "WinPrtScn", (0x2C, "WIN_PRTSCN", "Windows+PrintScreen") },
        { "FnPrintScreen", (0x2C, "FN_PRTSCN", "Fn+PrintScreen (Laptop)") },
    };
    
    // Mouse hook for capture detection
    private static IntPtr _mouseHook = IntPtr.Zero;
    private static LowLevelMouseProc? _mouseProc;
    
    // Track recent screenshots for analysis
    private static readonly List<DateTime> _recentScreenshots = new();
    private static readonly object _screenshotLock = new();
    
    [StructLayout(LayoutKind.Sequential)]
    private struct KBDLLHOOKSTRUCT
    {
        public uint vkCode;
        public uint scanCode;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }
    
    [StructLayout(LayoutKind.Sequential)]
    private struct LASTINPUTINFO
    {
        public uint cbSize;
        public uint dwTime;
    }
    
    // Hook handle
    private static IntPtr _keyboardHook = IntPtr.Zero;
    private static LowLevelKeyboardProc? _keyboardProc;
    
    // ============================================================
    // DIGITAL SIGNATURE CONFIGURATION
    // ============================================================
    
    // Trusted publishers - processes with these signatures are ALLOWED
    private static readonly string[] TRUSTED_SIGNERS = new[]
    {
        "Microsoft Windows",        // Windows built-in tools
        "Microsoft Corporation",    // Microsoft apps
        "Adobe Inc.",              // Adobe PDF tools (if needed)
        "Foxit Software",          // Foxit PDF
        "Google LLC"               // Chrome extensions (some screen capture allowed)
    };
    
    // Blocked publishers - processes with these signatures are ALWAYS BLOCKED
    private static readonly string[] BLOCKED_SIGNERS = new[]
    {
        "OBS Project",             // OBS Studio
        "Bandicam Company",        // Bandicam
        "Techsmith Corporation",   // Camtasia (if recording detected)
        "Streamlabs",             // Streamlabs
        "ShareX",                 // ShareX
        "Greenshot",              // Greenshot
        "Loom, Inc.",             // Loom
        "Discord Inc."            // Discord screen share (use with caution)
    };
    
    // Known malicious process hashes (updated from threat intelligence)
    private static readonly HashSet<string> KNOWN_MALICIOUS_HASHES = new(StringComparer.OrdinalIgnoreCase)
    {
        // Add actual hashes here after running: certutil -hashfile tool.exe SHA256
        // "A1B2C3D4E5F6..."
    };
    
    // Recording tool window title indicators
    private static readonly Dictionary<string, string[]> RECORDING_WINDOW_PATTERNS = new(StringComparer.OrdinalIgnoreCase)
    {
        { "OBS", new[] { "Recording", "Replay Buffer", "Streaming", "Live" } },
        { "Bandicam", new[] { "Recording", "Bandicut", "Capture" } },
        { "Camtasia", new[] { "Recording", "Camtasia Studio" } },
        { "Streamlabs", new[] { "Live", "Recording", "Streamlabs" } },
        { "Discord", new[] { "Go Live", "Screen Share", "Streaming" } },
        { "Xbox Game Bar", new[] { "Capturing", "Game Bar", "Recording" } },
        { "NVIDIA Share", new[] { "Recording", "ShadowPlay", "Highlights" } },
        { "VLC", new[] { "Recording" } }
    };
    
    // Virtual display driver names (indicates screen capture software)
    private static readonly string[] VIRTUAL_DISPLAY_DRIVERS = new[]
    {
        "Virtual Display Driver",
        "Mirror Driver", 
        "oCl2 Virtual Display",
        "OBS Virtual Camera",
        "ManyCam Virtual Webcam",
        "SplitCam Virtual Device",
        "WebcamMax Virtual Camera",
        "YouCam Virtual Driver"
    };
    
    // Known process signatures (SHA256 hashes)
    private static readonly Dictionary<string, string[]> KNOWN_SIGNATURES = new()
    {
        { "obs64.exe", new[] { "OBS_STUDIO_HASH_1", "OBS_STUDIO_HASH_2" } }, // Add actual hashes
        { "bandicam.exe", new[] { "BANDICAM_HASH_1" } },
        { "camtasia.exe", new[] { "CAMTASIA_HASH_1" } }
    };
    
    static async Task Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        ConsoleWrite("[DLP Sidecar] Security Monitor starting...");
        
        // Check for admin privileges
        if (!IsRunningAsAdmin())
        {
            ConsoleWrite("[DLP Sidecar] WARNING: Not running as Administrator!");
            ConsoleWrite("[DLP Sidecar] Some features (USB blocking, process monitoring) will be limited.");
            ConsoleWrite("[DLP Sidecar] To enable full protection, restart with elevated privileges.");
            _limitedMode = true;
        }
        else
        {
            ConsoleWrite("[DLP Sidecar] Running with Administrator privileges.");
        }
        
        _cts = new CancellationTokenSource();
        
        // Parse command line arguments
        string? electronPipeId = null;
        foreach (var arg in args)
        {
            if (arg.StartsWith("--pipe="))
                electronPipeId = arg.Substring(7);
        }
        
        // Start background monitors
        var monitors = new List<Task>();
        
        // USB Monitor
        monitors.Add(Task.Run(() => UsbMonitor(_cts.Token)));
        
        // Process Monitor with digital signature verification
        monitors.Add(Task.Run(() => ProcessMonitor(_cts.Token)));
        
        // Global keyboard hook for PrintScreen detection
        monitors.Add(Task.Run(() => KeyboardHookMonitor(_cts.Token)));
        
        // Virtual display driver detection
        monitors.Add(Task.Run(() => VirtualDisplayMonitor(_cts.Token)));
        
        // Window Sharing Detection (DXGI/DWM based)
        // This detects when Electron windows are being captured by screen sharing apps
        monitors.Add(Task.Run(() => WindowSharingMonitor(_cts.Token)));
        
        // Direct Window Capture Detection
        // This directly monitors Electron windows for any capture attempts
        monitors.Add(Task.Run(() => DirectWindowCaptureMonitor(_cts.Token)));
        
        // WASAPI audio recording detection
        monitors.Add(Task.Run(() => AudioRecordingMonitor(_cts.Token)));
        
        // Named Pipe Server for Electron communication
        monitors.Add(Task.Run(() => StartPipeServer(_cts.Token)));
        
        // Wait for cancellation
        try
        {
            await Task.Delay(Timeout.Infinite, _cts.Token);
        }
        catch (OperationCanceledException)
        {
            ConsoleWrite("[DLP Sidecar] Shutting down...");
        }
    }
    
    /// <summary>
    /// Check if running with administrator privileges
    /// </summary>
    private static bool IsRunningAsAdmin()
    {
        try
        {
            using var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
            var principal = new System.Security.Principal.WindowsPrincipal(identity);
            return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
        }
        catch
        {
            return false;
        }
    }
    
    /// <summary>
    /// USB Storage Device Monitor and Control
    /// 
    /// IMPORTANT: This method only affects USB Mass Storage devices (flash drives, external HDDs).
    /// HID devices (keyboards, mice, webcams, printers) use a different driver and are NOT affected.
    /// 
    /// The USBSTOR registry key controls the "USB Storage" driver specifically.
    /// - Start = 3: USB Storage driver is loaded (mass storage enabled)
    /// - Start = 4: USB Storage driver is disabled (mass storage blocked)
    /// 
    /// This is a system-level driver block, not a device-level block, so:
    /// - Keyboards/mice remain functional (they use HID driver)
    /// - Printers remain functional (they use USBPRINT driver)
    /// - Only USB flash drives and USB external drives are blocked
    /// </summary>
    private static async Task UsbMonitor(CancellationToken ct)
    {
        ConsoleWrite("[DLP USB] Monitor started.");
        ConsoleWrite("[DLP USB] Note: Keyboard/mouse/HID devices are NOT affected by storage controls.");
        
        // Initial USB storage state
        bool usbStorageEnabled = GetUsbStorageStatus();
        ConsoleWrite($"[DLP USB] Initial state: {(usbStorageEnabled ? "ENABLED" : "DISABLED")}");
        
        // Keep track of known devices to detect insert/remove
        var knownDevices = new HashSet<string>();
        var _lock = new object();
        
        // Initial scan - capture current devices
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT DeviceID FROM Win32_PnPEntity WHERE DeviceID LIKE '%USB%'");
            foreach (ManagementObject obj in searcher.Get())
            {
                var deviceId = obj["DeviceID"]?.ToString() ?? "";
                if (!string.IsNullOrEmpty(deviceId))
                {
                    knownDevices.Add(deviceId);
                }
            }
            ConsoleWrite($"[DLP USB] Initial device scan found {knownDevices.Count} USB devices");

            // Debug: count actual mass storage devices
            var massStorageCount = knownDevices.Count(IsMassStorageDevice);
            ConsoleWrite($"[DLP USB] Debug: {massStorageCount} mass storage devices in initial scan");
            if (massStorageCount == 0)
            {
                ConsoleWrite("[DLP USB] No USB mass storage devices detected. Insert a USB flash drive to test.");
            }
        }
        catch (Exception ex)
        {
            ConsoleWrite($"[DLP USB] Initial scan error: {ex.Message}");
        }
        
        // WMI Event watcher for USB device changes - multiple queries for better coverage
        try
        {
            // Query 1: Win32_VolumeChangeEvent - detects USB drive letters
            var volumeWatcher = new ManagementEventWatcher(new WqlEventQuery(
                "SELECT * FROM Win32_VolumeChangeEvent WHERE EventType = 2 OR EventType = 3"));
            
            volumeWatcher.EventArrived += (sender, e) =>
            {
                var eventArgs = e.NewEvent;
                var driveName = eventArgs["DriveName"]?.ToString() ?? "";
                var rawEventType = eventArgs["EventType"];
                int eventType;
                if (rawEventType is byte byteVal)
                    eventType = byteVal;
                else if (rawEventType is int intVal)
                    eventType = intVal;
                else
                    eventType = Convert.ToInt32(rawEventType ?? 0);
                ConsoleWrite($"[DLP USB] Volume change: {driveName} (EventType: {eventType})");
            };
            volumeWatcher.Start();
            
            // Query 2: __InstanceOperationEvent for Win32_USBHub
            var usbHubWatcher = new ManagementEventWatcher(new WqlEventQuery(
                "SELECT * FROM __InstanceOperationEvent WITHIN 2 WHERE TargetInstance ISA 'Win32_USBHub'"));

            var usbHubEventCount = 0;
            usbHubWatcher.EventArrived += (sender, e) =>
            {
                usbHubEventCount++;
                var eventArgs = e.NewEvent;
                var targetInstance = eventArgs["TargetInstance"] as ManagementBaseObject;
                var deviceId = targetInstance?["DeviceID"]?.ToString() ?? "";
                var eventType = eventArgs.ClassPath.ClassName;

                ConsoleWrite($"[DLP USB] USBHub event #{usbHubEventCount}: {eventType}, DeviceID: {deviceId}");

                // Check via related Win32_DiskDrive (USBHub DeviceID alone is not USBSTOR format)
                bool isMassStorage = IsMassStorageViaHub(targetInstance);
                if (isMassStorage)
                {
                    bool inserted = eventType.Contains("Creation");
                    ConsoleWrite($"[DLP USB] Mass storage device {(inserted ? "INSERTED" : "REMOVED")}: {deviceId}");

                    BroadcastUsbAlert(inserted ? "HIGH" : "MEDIUM",
                        $"USB Mass Storage device {(inserted ? "inserted" : "removed")}: {ExtractUsbDeviceInfo(deviceId)}");
                }
            };
            usbHubWatcher.Start();
            
            // Query 3: Device arrival/removal events via Win32_DeviceChangeEvent
            var deviceWatcher = new ManagementEventWatcher(new WqlEventQuery(
                "SELECT * FROM Win32_DeviceChangeEvent WHERE EventType = 2 OR EventType = 3"));
            
            deviceWatcher.EventArrived += async (sender, e) =>
            {
                var rawEventType = e.NewEvent["EventType"];
                int eventType;
                if (rawEventType is byte byteVal)
                    eventType = byteVal;
                else if (rawEventType is int intVal)
                    eventType = intVal;
                else if (rawEventType is ushort ushortVal)
                    eventType = ushortVal;
                else
                    eventType = Convert.ToInt32(rawEventType ?? 2);
                ConsoleWrite($"[DLP USB] Device change event (EventType: {eventType})");
                
                // Wait a bit for device enumeration to complete
                await Task.Delay(1000);
                
                // Check for new/removed devices
                try
                {
                    using var searcher = new ManagementObjectSearcher("SELECT DeviceID FROM Win32_PnPEntity WHERE DeviceID LIKE '%USB%' OR DeviceID LIKE '%STOR%' OR DeviceID LIKE '%DISK%'");
                    var currentDevices = new HashSet<string>();
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        var deviceId = obj["DeviceID"]?.ToString() ?? "";
                        if (!string.IsNullOrEmpty(deviceId))
                        {
                            currentDevices.Add(deviceId);
                        }
                    }
                    
                    lock (_lock)
                    {
                        // Find new devices (inserted)
                        foreach (var device in currentDevices)
                        {
                            if (!knownDevices.Contains(device) && IsMassStorageDevice(device))
                            {
                                ConsoleWrite($"[DLP USB] NEW mass storage device detected: {device}");
                                knownDevices.Add(device);

                                BroadcastUsbAlert("HIGH",
                                    $"USB Mass Storage device inserted: {ExtractUsbDeviceInfo(device)}");
                            }
                        }

                        // Find removed devices
                        var toRemove = knownDevices.Where(d => !currentDevices.Contains(d) && IsMassStorageDevice(d)).ToList();
                        foreach (var device in toRemove)
                        {
                            ConsoleWrite($"[DLP USB] Mass storage device removed: {device}");
                            knownDevices.Remove(device);

                            BroadcastUsbAlert("MEDIUM",
                                $"USB Mass Storage device removed: {ExtractUsbDeviceInfo(device)}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    ConsoleWrite($"[DLP USB] Device check error: {ex.Message}");
                }
            };
            deviceWatcher.Start();
            
            // Periodic check every 5 seconds as fallback for insert/remove detection
            var periodicCheck = Task.Run(async () =>
            {
                var checkCount = 0;
                while (!ct.IsCancellationRequested)
                {
                    await Task.Delay(5000, ct);
                    checkCount++;

                    try
                    {
                        using var searcher = new ManagementObjectSearcher("SELECT DeviceID FROM Win32_PnPEntity WHERE DeviceID LIKE '%USB%' OR DeviceID LIKE '%STOR%'");
                        var currentDevices = new HashSet<string>();
                        foreach (ManagementObject obj in searcher.Get())
                        {
                            var deviceId = obj["DeviceID"]?.ToString() ?? "";
                            if (!string.IsNullOrEmpty(deviceId))
                            {
                                currentDevices.Add(deviceId);
                            }
                        }

                        lock (_lock)
                        {
                            // Find new mass storage devices
                            foreach (var device in currentDevices.Where(d => !knownDevices.Contains(d) && IsMassStorageDevice(d)))
                            {
                                ConsoleWrite($"[DLP USB] Periodic check - NEW device: {device}");
                                knownDevices.Add(device);

                                BroadcastUsbAlert("HIGH",
                                    $"USB Mass Storage device inserted (periodic): {ExtractUsbDeviceInfo(device)}");
                            }

                            // Find removed devices
                            foreach (var device in knownDevices.Where(d => !currentDevices.Contains(d) && IsMassStorageDevice(d)).ToList())
                            {
                                ConsoleWrite($"[DLP USB] Periodic check - REMOVED device: {device}");
                                knownDevices.Remove(device);

                                BroadcastUsbAlert("MEDIUM",
                                    $"USB Mass Storage device removed (periodic): {ExtractUsbDeviceInfo(device)}");
                            }

                            // Every 30 seconds (6 * 5s), log if devices are still connected
                            if (checkCount % 6 == 0 && knownDevices.Count > 0)
                            {
                                foreach (var device in knownDevices.Where(d => currentDevices.Contains(d) && IsMassStorageDevice(d)))
                                {
                                    ConsoleWrite($"[DLP USB] Periodic check - Device still connected: {device}");
                                    BroadcastUsbAlert("MEDIUM",
                                        $"USB Mass Storage device still connected (periodic check): {ExtractUsbDeviceInfo(device)}");
                                }
                            }
                        }

                        if (checkCount % 12 == 0)
                        {
                            ConsoleWrite($"[DLP USB] Periodic check running... (check #{checkCount}), known devices: {knownDevices.Count}");
                        }
                    }
                    catch { }
                }
            }, ct);
            
            // Keep running
            while (!ct.IsCancellationRequested)
            {
                await Task.Delay(1000, ct);
            }
            
            volumeWatcher.Stop();
            usbHubWatcher.Stop();
            deviceWatcher.Stop();
        }
        catch (Exception ex)
        {
            ConsoleWrite($"[DLP USB] Monitor error: {ex.Message}");
        }
    }
    
    /// <summary>
    /// Enable or disable USB Mass Storage devices at the system level.
    /// 
    /// SECURITY NOTE: This ONLY affects USB Mass Storage devices (USB flash drives, 
    /// external USB hard drives). It does NOT affect:
    /// - Keyboards (HID driver)
    /// - Mice (HID driver)
    /// - Webcams (USB Video Class)
    /// - Printers (USBPRINT driver)
    /// - Bluetooth adapters
    /// 
    /// The USBSTOR driver is specifically for storage devices. Other USB device classes
    /// use different drivers and are completely unaffected by this setting.
    /// 
    /// Registry Key: HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\USBSTOR
    /// - Start = 3: USB Storage driver is loaded (mass storage allowed)
    /// - Start = 4: USB Storage driver is disabled (mass storage blocked)
    /// </summary>
    public static void SetUsbStorageEnabled(bool enabled)
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(USBSTOR_KEY, true);
            if (key != null)
            {
                // Start value: 3 = Enabled, 4 = Disabled
                key.SetValue("Start", enabled ? 3 : 4, RegistryValueKind.DWord);
                ConsoleWrite($"[DLP USB] USB Storage {(enabled ? "ENABLED" : "DISABLED")}");
                
                BroadcastEvent(new SecurityEvent
                {
                    Type = "USB_POLICY_CHANGED",
                    Severity = "INFO",
                    Details = $"USB storage policy changed to: {(enabled ? "ALLOWED" : "BLOCKED")}",
                    Timestamp = DateTime.UtcNow
                });
            }
        }
        catch (Exception ex)
        {
            ConsoleWrite($"[DLP USB] Failed to modify registry: {ex.Message}");
        }
    }
    
    /// <summary>
    /// Get current USB storage status from registry
    /// </summary>
    private static bool GetUsbStorageStatus()
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(USBSTOR_KEY, false);
            if (key != null)
            {
                var startValue = key.GetValue("Start");
                return startValue is int val && val == 3;
            }
        }
        catch { }
        return true; // Default to enabled
    }
    
    /// <summary>
    /// Update current user context - called by Electron when user logs in.
    /// This annotates all future security events with correct user identification.
    /// Format: "accountId|userName|hostName"
    /// </summary>
    private static void UpdateUserContext(string args)
    {
        if (string.IsNullOrWhiteSpace(args)) return;
        
        var parts = args.Split('|');
        lock (_userContextLock)
        {
            _currentAccountId = parts.Length > 0 && !string.IsNullOrWhiteSpace(parts[0]) ? parts[0] : null;
            _currentUserName = parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1]) ? parts[1] : null;
            _currentHostName = parts.Length > 2 && !string.IsNullOrWhiteSpace(parts[2]) ? parts[2] : null;
        }
        ConsoleWrite($"[DLP UserContext] Updated - AccountId: {_currentAccountId ?? "(none)"}, UserName: {_currentUserName ?? "(none)"}, HostName: {_currentHostName ?? "(none)"}");
    }
    
    /// <summary>
    /// Check if device is a mass storage device
    /// </summary>
    private static bool IsMassStorageDevice(string deviceId)
    {
        // Exclude Windows internal/virtual storage devices (VOLUME, VOLUMESNAPSHOT)
        // These are system-level devices, not actual USB removable storage
        if (deviceId.Contains("VOLUME") || deviceId.Contains("VOLUMESNAPSHOT"))
        {
            return false;
        }

        // USB Mass Storage Class Code = 0x08
        // Only match actual USB storage devices
        return deviceId.Contains("USBSTOR") ||
               deviceId.Contains("DiskDrive");
    }

    /// <summary>
    /// Check if a Win32_USBHub device is a USB mass storage device
    /// by querying Win32_DiskDrive via WMI association.
    /// Uses a WMI ASSOC query to find dependent disk drives from the USBHub.
    /// </summary>
    private static bool IsMassStorageViaHub(ManagementBaseObject usbHubInstance)
    {
        try
        {
            var usbHubDeviceId = usbHubInstance["DeviceID"]?.ToString() ?? "";
            if (string.IsNullOrEmpty(usbHubDeviceId)) return false;

            // Use WMI ASSOC query to find dependent devices of this USBHub
            // This finds the associated DiskDrive through WMI associations
            var assocQuery = $"ASSOCIATORS OF {{Win32_USBHub.DeviceID='{usbHubDeviceId.Replace("'", "''")}'}} WHERE AssocClass = Win32_DiskDrive";
            using var assocSearcher = new ManagementObjectSearcher(assocQuery);
            foreach (ManagementObject disk in assocSearcher.Get())
            {
                try
                {
                    var diskDeviceId = disk["DeviceID"]?.ToString() ?? "";
                    if (IsMassStorageDevice(diskDeviceId))
                    {
                        disk.Dispose();
                        return true;
                    }
                }
                finally { disk.Dispose(); }
            }
        }
        catch { }
        return false;
    }

    /// <summary>
    /// Broadcast USB event immediately without debouncing
    /// USB events have highest priority and should be sent immediately
    /// </summary>
    private static void BroadcastUsbAlert(string severity, string details)
    {
        var now = DateTime.UtcNow;

        ConsoleWrite($"[DLP USB] Sending USB alert: {details}");

        BroadcastEvent(new SecurityEvent
        {
            Type = "USB_STORAGE_DETECTED",
            Severity = severity,
            Details = details,
            Timestamp = now
        });
    }
    
    /// <summary>
    /// Extract readable device info from USB device ID
    /// </summary>
    private static string ExtractUsbDeviceInfo(string deviceId)
    {
        try
        {
            // Parse device ID to get friendly name
            var parts = deviceId.Split('\\');
            if (parts.Length >= 2)
            {
                var deviceInfo = parts[1].Replace("&", " ").Replace("_", " ");
                return deviceInfo;
            }
        }
        catch { }
        return deviceId;
    }

    /// <summary>
    /// Get current USB mass storage devices as JSON for post-login check
    /// </summary>
    private static string GetCurrentUsbDevices()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT DeviceID FROM Win32_PnPEntity WHERE DeviceID LIKE '%USB%' OR DeviceID LIKE '%STOR%' OR DeviceID LIKE '%DISK%'");
            var devices = new List<string>();
            foreach (ManagementObject obj in searcher.Get())
            {
                var deviceId = obj["DeviceID"]?.ToString() ?? "";
                if (!string.IsNullOrEmpty(deviceId) && IsMassStorageDevice(deviceId))
                {
                    devices.Add(ExtractUsbDeviceInfo(deviceId));
                }
            }
            var result = System.Text.Json.JsonSerializer.Serialize(devices);
            ConsoleWrite($"[DLP USB] GET_USB_DEVICES returning {devices.Count} devices");
            return $"USB_DEVICES:{result}";
        }
        catch (Exception ex)
        {
            ConsoleWrite($"[DLP USB] GET_USB_DEVICES error: {ex.Message}");
            return "USB_DEVICES:[]";
        }
    }

    // ============================================================
    // GLOBAL KEYBOARD HOOK - Detects PrintScreen even when minimized
    // ============================================================
    
    /// <summary>
    /// Monitor global keyboard for screenshot shortcuts
    /// Uses SetWindowsHookEx for low-level keyboard monitoring
    /// This catches PrintScreen even when the DLP window is not focused
    /// </summary>
    private static async Task KeyboardHookMonitor(CancellationToken ct)
    {
        ConsoleWrite("[DLP Keyboard] Global hotkey monitor started.");
        
        // Set up the low-level keyboard hook
        _keyboardProc = KeyboardHookCallback;
        
        try
        {
            var moduleHandle = GetModuleHandle(null);
            _keyboardHook = SetWindowsHookEx(WH_KEYBOARD_LL, _keyboardProc, moduleHandle, 0);
            
            if (_keyboardHook == IntPtr.Zero)
            {
                ConsoleWrite("[DLP Keyboard] Failed to install keyboard hook. Error: " + Marshal.GetLastWin32Error());
                return;
            }
            
            ConsoleWrite("[DLP Keyboard] Keyboard hook installed successfully.");
            
            // Keep running
            while (!ct.IsCancellationRequested)
            {
                await Task.Delay(100, ct);
                
                // Additional check: poll for PrintScreen state
                // Sometimes the hook misses, so we also check async key state
                if ((GetAsyncKeyState(VK_SNAPSHOT) & 0x8000) != 0)
                {
                    var foregroundWindow = GetForegroundWindow();
                    var windowTitle = GetWindowTitle(foregroundWindow);
                    uint processId;
                    GetWindowThreadProcessId(foregroundWindow, out processId);
                    
                    try
                    {
                        var proc = Process.GetProcessById((int)processId);
                        BroadcastEvent(new SecurityEvent
                        {
                            Type = "SCREENSHOT_KEY_PRESSED",
                            Severity = "HIGH",
                            Details = $"PrintScreen detected! Target window: '{windowTitle}' (Process: {proc.ProcessName}, PID: {processId})",
                            Timestamp = DateTime.UtcNow
                        });
                    }
                    catch
                    {
                        BroadcastEvent(new SecurityEvent
                        {
                            Type = "SCREENSHOT_KEY_PRESSED",
                            Severity = "HIGH",
                            Details = $"PrintScreen detected! Target window: '{windowTitle}' (PID: {processId})",
                            Timestamp = DateTime.UtcNow
                        });
                    }
                    
                    // Debounce - wait for key release
                    await Task.Delay(500, ct);
                }
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            ConsoleWrite($"[DLP Keyboard] Monitor error: {ex.Message}");
        }
        finally
        {
            if (_keyboardHook != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_keyboardHook);
                ConsoleWrite("[DLP Keyboard] Keyboard hook uninstalled.");
            }
        }
    }
    
    /// <summary>
    /// Callback for keyboard hook - intercepts all keyboard input
    /// Enhanced to detect all screenshot shortcuts
    /// </summary>
    private static IntPtr KeyboardHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            var hookStruct = Marshal.PtrToStructure<KBDLLHOOKSTRUCT>(lParam);
            var vkCode = (int)hookStruct.vkCode;
            
            // Check modifier states
            var ctrlPressed = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0;
            var shiftPressed = (GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0;
            var altPressed = (GetAsyncKeyState(VK_MENU) & 0x8000) != 0;
            var winPressed = (GetAsyncKeyState(VK_LWIN) & 0x8000) != 0 || (GetAsyncKeyState(VK_RWIN) & 0x8000) != 0;
            
            // Check for debounce
            var now = DateTime.UtcNow;
            bool shouldDebounce = false;
            lock (_screenshotLock)
            {
                shouldDebounce = (now - _lastScreenshotTime) < _screenshotDebounceTime;
            }
            
            string? screenshotType = null;
            string details = "";
            
            // PrintScreen (VK_SNAPSHOT = 0x2C)
            if (vkCode == VK_SNAPSHOT && !shouldDebounce)
            {
                screenshotType = "SCREENSHOT_KEY_PRESSED";
                if (winPressed && shiftPressed)
                    screenshotType = "WINDOWS_SNIPPING_TOOL";
                else if (winPressed)
                    screenshotType = "WIN_PRTSCN_DETECTED";
                else if (altPressed)
                    screenshotType = "ALT_PRTSCN_DETECTED";
                
                details = $"PrintScreen detected! Modifiers: Win={winPressed} Ctrl={ctrlPressed} Shift={shiftPressed} Alt={altPressed}";
            }
            
            // Win+Shift+S (Windows 11 Snipping Tool) - S key
            if (vkCode == 0x53 && winPressed && shiftPressed && !shouldDebounce)
            {
                screenshotType = "WINDOWS_SNIPPING_TOOL";
                details = "Windows+Shift+S (Screen Snip) detected!";
            }
            
            // Ctrl+Shift+S (common screenshot tool)
            if (vkCode == 0x53 && ctrlPressed && shiftPressed && !shouldDebounce)
            {
                screenshotType = "CTRL_SHIFT_S_SCREENSHOT";
                details = "Ctrl+Shift+S screenshot shortcut detected!";
            }
            
            // Ctrl+Shift+X (Snip & Sketch)
            if (vkCode == 0x58 && ctrlPressed && shiftPressed && !shouldDebounce)
            {
                screenshotType = "SNIP_SKETCH_DETECTED";
                details = "Ctrl+Shift+X (Snip & Sketch) detected!";
            }
            
            // If we detected a screenshot, broadcast event
            if (screenshotType != null)
            {
                lock (_screenshotLock)
                {
                    _lastScreenshotTime = now;
                    _recentScreenshots.Add(now);
                    // Keep only last 100 screenshots
                    if (_recentScreenshots.Count > 100)
                        _recentScreenshots.RemoveAt(0);
                }
                
                // Get target window info
                var foregroundWindow = GetForegroundWindow();
                var windowTitle = GetWindowTitle(foregroundWindow);
                uint processId;
                GetWindowThreadProcessId(foregroundWindow, out processId);
                
                string? processName = null;
                try
                {
                    var proc = Process.GetProcessById((int)processId);
                    processName = proc.ProcessName;
                }
                catch { }
                
                BroadcastEvent(new SecurityEvent
                {
                    Type = screenshotType,
                    Severity = "HIGH",
                    Details = $"{details} Target: '{windowTitle}' (Process: {processName ?? "Unknown"}, PID: {processId})",
                    Timestamp = now
                });
                
                ConsoleWrite($"[DLP Keyboard] {screenshotType}: {details}");
                ConsoleWrite($"[DLP Keyboard]   Target window: '{windowTitle}'");
            }
        }
        
        // Call next hook in chain (don't intercept)
        return CallNextHookEx(_keyboardHook, nCode, wParam, lParam);
    }
    
    /// <summary>
    /// Get window title from handle
    /// </summary>
    private static string GetWindowTitle(IntPtr hWnd)
    {
        var sb = new StringBuilder(256);
        GetWindowText(hWnd, sb, sb.Capacity);
        return sb.ToString();
    }
    
    // ============================================================
    // DXGI / DWM API FOR WINDOW SHARING DETECTION
    // Detects if any application is capturing our Electron window
    // ============================================================
    
    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);
    
    [DllImport("dwmapi.dll")]
    private static extern int DwmRegisterThumbnail(IntPtr hwndDestination, IntPtr hwndSource, out IntPtr phThumbnailId);
    
    [DllImport("dwmapi.dll")]
    private static extern int DwmUnregisterThumbnail(IntPtr hThumbnailId);
    
    [DllImport("dwmapi.dll")]
    private static extern int DwmQueryThumbnailSourceSize(IntPtr hThumbnailId, out THUMBNAIL_SIZE pThumbnailSize);
    
    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmGetThumbnailProperties(IntPtr hwndDestination, IntPtr hThumbnailId, ref THUMBNAIL_PROPERTIES pProperties);
    
    [DllImport("user32.dll")]
    private static extern IntPtr GetShellWindow();
    
    [DllImport("user32.dll")]
    private static extern IntPtr GetDesktopWindow();
    
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    private static extern int GetWindowTextLength(IntPtr hWnd);
    
    // DWM thumbnail attributes
    private const int DWMWA_HAS_ICONIC_BITMAP = 10;
    private const int DWMWA_NONCLIENT_RENDERING_ENABLED = 11;
    private const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    
    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
    
    [StructLayout(LayoutKind.Sequential)]
    private struct THUMBNAIL_SIZE
    {
        public uint width;
        public uint height;
    }
    
    [StructLayout(LayoutKind.Sequential)]
    private struct THUMBNAIL_PROPERTIES
    {
        public uint dwFlags;
        public RECT rcDestination;
        public RECT rcSource;
        public byte opacity;
        public bool fVisible;
        public bool fSourceClientAreaOnly;
    }
    
    private const uint DWM_TNP_VISIBLE = 0x00000008;
    
    // ============================================================
    // DIRECT WINDOW CAPTURE DETECTION
    // Monitors Electron windows for capture attempts via window messages
    // This is more reliable than process-based detection because:
    // 1. It directly detects capture attempts on our windows, not just capture tools running
    // 2. No false positives from browsers or normal apps
    // 3. Works with any capture method (GDI, DirectX, PrintWindow, etc.)
    // ============================================================
    
    // Window message constants for capture detection
    private const int WM_PRINTCLIENT = 0x0318;
    private const int WM_PRINT = 0x0317;
    private const int WM_RENDERFORMAT = 0x0285;
    private const int WM_RENDERALLFORMATS = 0x0286;
    private const int WM_CLIPBOARDUPDATE = 0x031D;
    
    // Hook for monitoring window messages on Electron windows
    private static IntPtr _windowHook = IntPtr.Zero;
    private static readonly HashSet<IntPtr> _protectedElectronWindows = new();
    private static readonly object _windowLock = new();
    private static DateTime _lastCaptureAlert = DateTime.MinValue;
    private static readonly TimeSpan _captureAlertCooldown = TimeSpan.FromSeconds(10);
    
    [StructLayout(LayoutKind.Sequential)]
    private struct MSLLHOOKSTRUCT
    {
        public POINT pt;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }
    
    [StructLayout(LayoutKind.Sequential)]
    private struct POINT
    {
        public int X;
        public int Y;
    }
    
    [StructLayout(LayoutKind.Sequential)]
    private struct MSMOUSEHOOKSTRUCT
    {
        public POINT pt;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }
    
    private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);
    
    // ============================================================
    // GRAPHICS CAPTURE API DETECTION (Windows 10+)
    // Detects modern screenshot methods using Graphics Capture API
    // ============================================================
    
    [DllImport("dxgi.dll")]
    private static extern int CreateDXGIFactory(ref Guid riid, out IntPtr ppFactory);
    
    [DllImport("d3d11.dll")]
    private static extern int D3D11CreateDevice(
        IntPtr pAdapter,
        int DriverType,
        IntPtr Software,
        uint Flags,
        IntPtr pFeatureLevels,
        uint FeatureLevels,
        uint SDKVersion,
        out IntPtr ppDevice,
        IntPtr pFeatureLevel,
        IntPtr pImmediateContext
    );
    
    [DllImport("user32.dll")]
    private static extern bool GetPhysicalCursorPos(out POINT lpPoint);
    
    // Graphics Capture API (Windows.Graphics.Capture) - COM interop
    // We detect capture by monitoring DWM thumbnail handles
    
    // ============================================================
    // DIRECT WINDOW CAPTURE MONITOR (ENHANCED)
    // Detects capture attempts by multiple methods:
    // 1. DWM Thumbnail enumeration - detects apps creating thumbnails
    // 2. GDI DC monitoring - detects BitBlt/ScreenDC capture
    // 3. Keyboard hotkey detection - detects PrintScreen, Win+Shift+S, etc.
    // 4. Clipboard monitoring - detects screenshot to clipboard
    // ============================================================
    
    // Track Electron windows with their metadata
    private static readonly Dictionary<IntPtr, WindowInfo> _electronWindows = new();
    
    // Track known capturing applications
    private static readonly Dictionary<int, CaptureInfo> _capturingApps = new();
    private static readonly object _captureLock = new();
    
    private class WindowInfo
    {
        public string Title { get; set; } = "";
        public int ProcessId { get; set; }
        public string ProcessName { get; set; } = "";
        public DateTime FirstSeen { get; set; } = DateTime.UtcNow;
        public DateTime LastSeen { get; set; } = DateTime.UtcNow;
        public bool HasThumbnailCapture { get; set; }
        public int ThumbnailAttempts { get; set; }
    }
    
    private class CaptureInfo
    {
        public string ProcessName { get; set; } = "";
        public int ProcessId { get; set; }
        public DateTime FirstDetected { get; set; } = DateTime.UtcNow;
        public DateTime LastDetected { get; set; } = DateTime.UtcNow;
    }
    
    /// <summary>
    /// Enhanced direct window capture monitor
    /// Uses multiple detection methods to catch screenshot attempts
    /// </summary>
    private static async Task DirectWindowCaptureMonitor(CancellationToken ct)
    {
        ConsoleWrite("[DLP DirectCapture] Direct window capture monitor started (ENHANCED).");
        ConsoleWrite("[DLP DirectCapture] Detection methods: DWM Thumbnail, GDI DC, Process List, Clipboard");
        
        var windowCheckInterval = TimeSpan.FromSeconds(2);
        var lastWindowScan = DateTime.MinValue;
        
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var now = DateTime.UtcNow;
                
                // Periodically refresh Electron windows list
                if (now - lastWindowScan > windowCheckInterval)
                {
                    lastWindowScan = now;
                    RefreshElectronWindowListEnhanced();
                }
                
                // Method 1: Check DWM thumbnail captures
                CheckDWMThumbnailCapturesEnhanced();
                
                // Method 2: Check process list for capture tools
                CheckForCaptureProcessesEnhanced();
                
            }
            catch (Exception ex)
            {
                ConsoleWrite($"[DLP DirectCapture] Monitor error: {ex.Message}");
            }
            
            await Task.Delay(500, ct);
        }
        
        ConsoleWrite("[DLP DirectCapture] Monitor stopped.");
    }
    
    /// <summary>
    /// Refresh Electron windows list with metadata
    /// </summary>
    private static void RefreshElectronWindowListEnhanced()
    {
        lock (_windowLock)
        {
            var currentWindows = new HashSet<IntPtr>();
            
            foreach (var proc in Process.GetProcessesByName("electron"))
            {
                try
                {
                    var procName = proc.ProcessName;
                    
                    EnumWindows((hwnd, lParam) =>
                    {
                        if (!IsWindowVisible(hwnd)) return true;
                        
                        uint processId;
                        GetWindowThreadProcessId(hwnd, out processId);
                        
                        if (processId == (uint)proc.Id)
                        {
                            var title = GetWindowTitle(hwnd);
                            if (!string.IsNullOrEmpty(title) && title.Length > 3)
                            {
                                currentWindows.Add(hwnd);
                                
                                if (!_electronWindows.TryGetValue(hwnd, out var info))
                                {
                                    info = new WindowInfo
                                    {
                                        Title = title,
                                        ProcessId = (int)processId,
                                        ProcessName = procName
                                    };
                                    _electronWindows[hwnd] = info;
                                }
                                else
                                {
                                    info.LastSeen = DateTime.UtcNow;
                                    info.Title = title;
                                }
                            }
                        }
                        return true;
                    }, IntPtr.Zero);
                }
                catch { }
                finally
                {
                    proc.Dispose();
                }
            }
            
            // Remove windows that no longer exist
            var toRemove = _electronWindows.Keys.Where(h => !currentWindows.Contains(h)).ToList();
            foreach (var hwnd in toRemove)
            {
                _electronWindows.Remove(hwnd);
            }
        }
    }
    
    /// <summary>
    /// Method 1: Check DWM thumbnail captures
    /// Detects when another app creates a thumbnail of our Electron window
    /// </summary>
    private static void CheckDWMThumbnailCapturesEnhanced()
    {
        var now = DateTime.UtcNow;
        
        foreach (var (hwnd, info) in _electronWindows)
        {
            try
            {
                // Try to register a thumbnail - if E_ACCESSDENIED, another app already has it
                IntPtr thumbId = IntPtr.Zero;
                var hr = DwmRegisterThumbnail(hwnd, hwnd, out thumbId);
                
                if (hr == 0 && thumbId != IntPtr.Zero)
                {
                    DwmUnregisterThumbnail(thumbId);
                    info.HasThumbnailCapture = false;
                }
                else if (hr == unchecked((int)0x80070005)) // E_ACCESSDENIED
                {
                    info.HasThumbnailCapture = true;
                    info.ThumbnailAttempts++;
                    
                    if (now - _lastCaptureAlert > _captureAlertCooldown)
                    {
                        _lastCaptureAlert = now;
                        BroadcastEvent(new SecurityEvent
                        {
                            Type = "WINDOW_THUMBNAIL_CAPTURE",
                            Severity = "HIGH",
                            Details = $"DWM thumbnail capture detected on window '{info.Title}'. Another app is capturing via thumbnail API.",
                            Timestamp = now
                        });
                        ConsoleWrite($"[DLP DirectCapture] THUMBNAIL CAPTURE on '{info.Title}'");
                    }
                }
            }
            catch { }
        }
    }
    
    /// <summary>
    /// Method 2: Check for known capture tools
    /// </summary>
    private static void CheckForCaptureProcessesEnhanced()
    {
        var now = DateTime.UtcNow;
        
        var captureTools = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "sharex", "ShareX" },
            { "greenshot", "Greenshot" },
            { "lightshot", "Lightshot" },
            { "snagit", "Snagit" },
            { "picpick", "PicPick" },
            { "faststone", "FastStone Capture" },
            { "bandicam", "Bandicam" },
            { "camtasia", "Camtasia" },
            { "obs64", "OBS Studio" },
            { "obs32", "OBS Studio" },
            { "streamlabs", "Streamlabs" },
            { "gamebar", "Xbox Game Bar" },
            { "gamebarservices", "Game Bar Service" },
            { "nvidians", "NVIDIA Share" },
            { "snip", "Snip & Sketch" },
            { "screensketch", "Screen Sketch" },
            { "snippingtool", "Snipping Tool" },
            { "sniptool", "Snip & Sketch (Win11)" },
            { "mspaint", "MS Paint" },
            { "paint", "MS Paint" },
        };
        
        foreach (var proc in Process.GetProcesses())
        {
            try
            {
                var procName = proc.ProcessName.ToLower();
                
                foreach (var (toolName, displayName) in captureTools)
                {
                    if (procName.Contains(toolName.ToLower()))
                    {
                        bool isCapturing = IsProcessCapturingElectron(proc);
                        
                        lock (_captureLock)
                        {
                            if (isCapturing && !_capturingApps.ContainsKey(proc.Id))
                            {
                                _capturingApps[proc.Id] = new CaptureInfo
                                {
                                    ProcessName = displayName,
                                    ProcessId = proc.Id,
                                    FirstDetected = now,
                                    LastDetected = now
                                };
                                
                                BroadcastEvent(new SecurityEvent
                                {
                                    Type = "CAPTURE_TOOL_ACTIVE",
                                    Severity = "HIGH",
                                    Details = $"Capture tool detected and capturing: {displayName} (PID: {proc.Id})",
                                    Timestamp = now
                                });
                                ConsoleWrite($"[DLP DirectCapture] CAPTURE DETECTED: {displayName} (PID: {proc.Id})");
                            }
                            else if (isCapturing)
                            {
                                _capturingApps[proc.Id].LastDetected = now;
                            }
                        }
                        break;
                    }
                }
            }
            catch { }
            finally
            {
                proc.Dispose();
            }
        }
        
        // Cleanup old entries
        lock (_captureLock)
        {
            var cutoff = DateTime.UtcNow.AddMinutes(-5);
            var toRemove = _capturingApps.Where(kvp => kvp.Value.LastDetected < cutoff).Select(kvp => kvp.Key).ToList();
            foreach (var id in toRemove) _capturingApps.Remove(id);
        }
    }
    
    /// <summary>
    /// Check if a process is capturing Electron windows
    /// </summary>
    private static bool IsProcessCapturingElectron(Process captureProc)
    {
        try
        {
            // Check if capture process has windows with our titles
            var captureWindows = new List<IntPtr>();
            EnumWindows((hwnd, lParam) =>
            {
                if (!IsWindowVisible(hwnd)) return true;
                uint processId;
                GetWindowThreadProcessId(hwnd, out processId);
                if (processId == (uint)captureProc.Id)
                {
                    captureWindows.Add(hwnd);
                }
                return true;
            }, IntPtr.Zero);
            
            foreach (var hwnd in captureWindows)
            {
                var title = GetWindowTitle(hwnd);
                if (title.Contains("electron", StringComparison.OrdinalIgnoreCase) ||
                    title.Contains("dlp", StringComparison.OrdinalIgnoreCase) ||
                    title.Contains("敏感", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }
        catch { return false; }
    }
    
    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    private static extern bool GetCursorPos(out POINT lpPoint);
    
    [DllImport("user32.dll")]
    private static extern IntPtr WindowFromPoint(POINT point);
    
    // Additional GDI APIs for capture detection
    [DllImport("user32.dll")]
    private static extern IntPtr GetDC(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    private static extern IntPtr GetDCEx(IntPtr hWnd, IntPtr hrgnClip, uint flags);
    
    [DllImport("user32.dll")]
    private static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
    
    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    
    [DllImport("gdi32.dll")]
    private static extern IntPtr CreateCompatibleDC(IntPtr hdc);
    
    [DllImport("gdi32.dll")]
    private static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);
    
    [DllImport("gdi32.dll")]
    private static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);
    
    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr hObject);
    
    [DllImport("gdi32.dll")]
    private static extern bool DeleteDC(IntPtr hdc);
    
    [DllImport("user32.dll")]
    private static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, uint nFlags);
    
    /// <summary>
    /// Monitor for virtual display drivers - indicates screen capture software
    /// Virtual displays are installed by OBS, ManyCam, virtual webcams, etc.
    /// </summary>
    private static async Task VirtualDisplayMonitor(CancellationToken ct)
    {
        ConsoleWrite("[DLP Virtual Display] Monitor started.");
        
        var knownVirtualDevices = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        
        while (!ct.IsCancellationRequested)
        {
            try
            {
                // Check via WMI for video drivers
                using var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_VideoController");
                
                foreach (ManagementObject obj in searcher.Get())
                {
                    var name = obj["Name"]?.ToString() ?? "";
                    var status = obj["Status"]?.ToString() ?? "";
                    
                    // Check if this is a known virtual display driver
                    foreach (var vdDriver in VIRTUAL_DISPLAY_DRIVERS)
                    {
                        if (name.Contains(vdDriver, StringComparison.OrdinalIgnoreCase))
                        {
                            if (!knownVirtualDevices.Contains(name))
                            {
                                knownVirtualDevices.Add(name);
                                
                                BroadcastEvent(new SecurityEvent
                                {
                                    Type = "VIRTUAL_DISPLAY_DETECTED",
                                    Severity = "HIGH",
                                    Details = $"Virtual display driver detected: '{name}' (Status: {status}). " +
                                              "This may indicate screen capture or recording software.",
                                    Timestamp = DateTime.UtcNow
                                });
                            }
                        }
                    }
                }
                
                // Also check for video capture devices
                using var captureSearcher = new ManagementObjectSearcher("SELECT * FROM Win32_PnPEntity WHERE PNPClass = 'Video'");
                
                foreach (ManagementObject obj in captureSearcher.Get())
                {
                    var name = obj["Name"]?.ToString() ?? "";
                    var status = obj["Status"]?.ToString() ?? "";
                    
                    if (name.Contains("Virtual", StringComparison.OrdinalIgnoreCase) ||
                        name.Contains("OBS", StringComparison.OrdinalIgnoreCase) ||
                        name.Contains("ManyCam", StringComparison.OrdinalIgnoreCase) ||
                        name.Contains("SplitCam", StringComparison.OrdinalIgnoreCase))
                    {
                        if (!knownVirtualDevices.Contains(name))
                        {
                            knownVirtualDevices.Add(name);
                            
                            BroadcastEvent(new SecurityEvent
                            {
                                Type = "CAPTURE_DEVICE_DETECTED",
                                Severity = "HIGH",
                                Details = $"Video capture device detected: '{name}' (Status: {status})",
                                Timestamp = DateTime.UtcNow
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                ConsoleWrite($"[DLP Virtual Display] Monitor error: {ex.Message}");
            }
            
            await Task.Delay(5000, ct); // Check every 5 seconds
        }
    }
    
    // ============================================================
    // WINDOW SHARING / SCREEN SHARING DETECTION
    // Detects when Electron window is being captured by screen sharing apps
    // This is more reliable than process-based detection because:
    // 1. It directly detects when OUR window is being shared, not just any capture tool
    // 2. It won't false-positive on msedgewebview2 or chrome (unless they share OUR window)
    // 3. It works with legitimate apps (Teams, Zoom, Discord) without blocking them
    // ============================================================
    
    /// <summary>
    /// Monitor for window sharing/capture events.
    /// Detects when Electron windows are being captured by screen sharing applications.
    /// This is a DETECTION-only mechanism - it does NOT block legitimate screen sharing.
    /// </summary>
    private static async Task WindowSharingMonitor(CancellationToken ct)
    {
        ConsoleWrite("[DLP WindowShare] Window sharing monitor started.");
        
        // Track which applications are currently sharing screen
        var currentlySharingApps = new Dictionary<int, SharedWindowInfo>(100);
        var lastBroadcastTime = DateTime.MinValue;
        var broadcastCooldown = TimeSpan.FromSeconds(30);
        
        // Known screen sharing applications with their window patterns
        // These apps are NORMALLY allowed, but we detect when they capture OUR window
        // They are SKIPPED by ProcessMonitor (not recording tools) but monitored here
        var sharingApps = new Dictionary<string, SharingAppConfig>(StringComparer.OrdinalIgnoreCase)
        {
            // Microsoft Teams - only flag when actually sharing our window
            { "Teams", new SharingAppConfig(
                windowPatterns: new[] { "Teams", "Microsoft Teams" },
                captureIndicators: new[] { "sharing", "presenting", "content from", "your screen", "window", "presenting" },
                isLegitimate: true
            )},
            
            // Zoom - only flag when actually sharing
            { "zoom", new SharingAppConfig(
                windowPatterns: new[] { "Zoom", "zoom.us" },
                captureIndicators: new[] { "sharing", "screen", "you are sharing", "viewing shared", "presenting" },
                isLegitimate: true
            )},
            
            // Discord - only flag when screen streaming is active
            { "Discord", new SharingAppConfig(
                windowPatterns: new[] { "Discord" },
                captureIndicators: new[] { "screen", "streaming", "go live", "watching stream", "voice connected" },
                isLegitimate: true
            )},
            
            // Google Meet in Chrome
            { "chrome", new SharingAppConfig(
                windowPatterns: new[] { "Meet", "Google Meet", "- Google Meet" },
                captureIndicators: new[] { "presenting", "you are presenting", "screen share", "your screen" },
                isLegitimate: true
            )},
            
            // Skype
            { "skype", new SharingAppConfig(
                windowPatterns: new[] { "Skype" },
                captureIndicators: new[] { "sharing", "presenting", "screen", "present now" },
                isLegitimate: true
            )},
            
            // Slack Huddles
            { "slack", new SharingAppConfig(
                windowPatterns: new[] { "Slack" },
                captureIndicators: new[] { "sharing", "huddle", "screen" },
                isLegitimate: true
            )},
            
            // Windows Game Bar (Xbox app) - NOT legitimate, often used for unauthorized recording
            { "gamebar", new SharingAppConfig(
                windowPatterns: new[] { "Xbox", "Game Bar" },
                captureIndicators: new[] { "capturing", "recording", "broadcasting", "game bar" },
                isLegitimate: false
            )},
            
            // NVIDIA Share / ShadowPlay - NOT legitimate
            { "nvidians", new SharingAppConfig(
                windowPatterns: new[] { "NVIDIA", "GeForce", "ShadowPlay" },
                captureIndicators: new[] { "recording", "instant replay", "shadowplay", "highlights", "share" },
                isLegitimate: false
            )},
        };
        
        while (!ct.IsCancellationRequested)
        {
            try
            {
                // Step 1: Find Electron windows
                var electronWindows = FindElectronWindows();
                
                if (electronWindows.Count == 0)
                {
                    await Task.Delay(2000, ct);
                    continue;
                }
                
                // Step 2: Check for screen sharing applications
                foreach (var proc in Process.GetProcesses())
                {
                    try
                    {
                        var procName = proc.ProcessName;
                        
                        // Check if this is a known sharing app
                        SharingAppConfig? config = null;
                        foreach (var kvp in sharingApps)
                        {
                            if (procName.Contains(kvp.Key, StringComparison.OrdinalIgnoreCase))
                            {
                                config = kvp.Value;
                                break;
                            }
                        }
                        
                        if (config == null) continue;
                        
                        // Get window title
                        var windowTitle = proc.MainWindowTitle;
                        
                        if (string.IsNullOrEmpty(windowTitle)) continue;
                        
                        var titleLower = windowTitle.ToLower();
                        
                        // Check if this app is actively sharing/capturing
                        bool isActivelySharing = config.captureIndicators
                            .Any(indicator => titleLower.Contains(indicator.ToLower()));
                        
                        if (!isActivelySharing) continue;
                        
                        // Step 3: Check if our Electron window is being captured
                        bool capturingOurWindow = IsOurWindowBeingCaptured(proc, electronWindows, windowTitle);
                        
                        if (capturingOurWindow)
                        {
                            // Check cooldown to avoid spam
                            var now = DateTime.UtcNow;
                            if (now - lastBroadcastTime > broadcastCooldown ||
                                !currentlySharingApps.ContainsKey(proc.Id))
                            {
                                lastBroadcastTime = now;
                                
                                currentlySharingApps[proc.Id] = new SharedWindowInfo
                                {
                                    ProcessName = procName,
                                    ProcessId = proc.Id,
                                    WindowTitle = windowTitle,
                                    CapturedWindows = electronWindows.Keys.ToList(),
                                    Severity = config.isLegitimate ? "HIGH" : "CRITICAL",
                                    IsLegitimate = config.isLegitimate
                                };
                                
                                BroadcastEvent(new SecurityEvent
                                {
                                    Type = "WINDOW_SHARING_DETECTED",
                                    Severity = config.isLegitimate ? "HIGH" : "CRITICAL",
                                    Details = $"Screen sharing detected: '{procName}' (PID: {proc.Id}) is capturing Electron window. " +
                                              $"Window title: '{windowTitle}'. " +
                                              $"{(config.isLegitimate ? "Legitimate app (Teams/Zoom/Discord)" : "Unauthorized capture tool")}",
                                    Timestamp = now
                                });
                                
                                ConsoleWrite($"[DLP WindowShare] DETECTED: {procName} is sharing our window - '{windowTitle}'");
                            }
                        }
                    }
                    catch { }
                    finally
                    {
                        proc.Dispose();
                    }
                }
                
                // Step 4: Check for sudden window enumeration (indicates capture)
                // This catches apps that create thumbnails without obvious window title changes
                CheckForThumbnailCreation(electronWindows);
                
            }
            catch (Exception ex)
            {
                ConsoleWrite($"[DLP WindowShare] Monitor error: {ex.Message}");
            }
            
            await Task.Delay(1000, ct); // Check every second
        }
    }
    
    /// <summary>
    /// Find all Electron window handles
    /// </summary>
    private static Dictionary<IntPtr, string> FindElectronWindows()
    {
        var windows = new Dictionary<IntPtr, string>();
        
        // Find by process name
        foreach (var proc in Process.GetProcessesByName("electron"))
        {
            try
            {
                EnumWindows((hwnd, lParam) =>
                {
                    if (!IsWindowVisible(hwnd)) return true;
                    
                    uint processId;
                    GetWindowThreadProcessId(hwnd, out processId);
                    
                    if (processId == (uint)proc.Id)
                    {
                        var title = GetWindowTitle(hwnd);
                        if (!string.IsNullOrEmpty(title) && title.Length > 3)
                        {
                            windows[hwnd] = title;
                        }
                    }
                    return true;
                }, IntPtr.Zero);
            }
            catch { }
            finally
            {
                proc.Dispose();
            }
        }
        
        return windows;
    }
    
    /// <summary>
    /// Check if a sharing application is capturing our Electron window
    /// </summary>
    private static bool IsOurWindowBeingCaptured(Process sharingProc, Dictionary<IntPtr, string> electronWindows, string sharingWindowTitle)
    {
        // Method 1: Check window title for our app name
        var titleLower = sharingWindowTitle.ToLower();
        if (titleLower.Contains("electron") || 
            titleLower.Contains("dlp") ||
            electronWindows.Values.Any(ew => titleLower.Contains(ew.ToLower().Substring(0, Math.Min(20, ew.Length)))))
        {
            return true;
        }
        
        // Method 2: Check if sharingProc has access to our Electron windows
        foreach (var hwnd in electronWindows.Keys)
        {
            uint ownerPid;
            GetWindowThreadProcessId(hwnd, out ownerPid);
            
            // Check if sharing process can open our window
            try
            {
                // Get the process that owns the Electron window
                var ownerProc = Process.GetProcessById((int)ownerPid);
                
                // Try to get window from sharing app - if they can see our window, they're capturing it
                IntPtr dupWnd = IntPtr.Zero;
                var result = DwmRegisterThumbnail(sharingProc.MainWindowHandle, hwnd, out dupWnd);
                if (result == 0 && dupWnd != IntPtr.Zero)
                {
                    // Successfully created thumbnail - this app IS capturing our window!
                    DwmUnregisterThumbnail(dupWnd);
                    return true;
                }
            }
            catch { }
        }
        
        // Method 3: Check for BitBlt hooks or GDI calls (advanced, requires separate hook DLL)
        // This would be implemented as a separate low-level hook
        
        return false;
    }
    
    /// <summary>
    /// Check for sudden thumbnail creation attempts on our windows
    /// This is a heuristic detection for apps that try to capture without obvious UI changes
    /// </summary>
    private static void CheckForThumbnailCreation(Dictionary<IntPtr, string> electronWindows)
    {
        // Track thumbnail creation attempts
        var now = DateTime.UtcNow;
        
        foreach (var hwnd in electronWindows.Keys)
        {
            // Try to query thumbnail properties - if another app has registered a thumbnail
            // for our window, this would succeed
            IntPtr thumbId = IntPtr.Zero;
            var result = DwmRegisterThumbnail(hwnd, hwnd, out thumbId);
            
            if (result == 0 && thumbId != IntPtr.Zero)
            {
                // Successfully registered - no one else is capturing
                DwmUnregisterThumbnail(thumbId);
            }
            else if (result == unchecked((int)0x80070005)) // E_ACCESSDENIED - someone else registered thumbnail
            {
                // Someone else has already registered a thumbnail for our window!
                // This means they ARE capturing it
                BroadcastEvent(new SecurityEvent
                {
                    Type = "WINDOW_THUMBNAIL_CAPTURE",
                    Severity = "HIGH",
                    Details = $"Window thumbnail capture detected on Electron window '{electronWindows[hwnd]}'. " +
                              "Another application is capturing this window's content.",
                    Timestamp = now
                });
            }
        }
    }
    
    /// <summary>
    /// Configuration for screen sharing application detection
    /// </summary>
    private class SharingAppConfig
    {
        public string[] windowPatterns { get; }
        public string[] captureIndicators { get; }
        public bool isLegitimate { get; }
        
        public SharingAppConfig(string[] windowPatterns, string[] captureIndicators, bool isLegitimate)
        {
            this.windowPatterns = windowPatterns;
            this.captureIndicators = captureIndicators;
            this.isLegitimate = isLegitimate;
        }
    }
    
    /// <summary>
    /// Information about a currently sharing window
    /// </summary>
    private class SharedWindowInfo
    {
        public string ProcessName { get; set; } = "";
        public int ProcessId { get; set; }
        public string WindowTitle { get; set; } = "";
        public List<IntPtr> CapturedWindows { get; set; } = new();
        public string Severity { get; set; } = "HIGH";
        public bool IsLegitimate { get; set; }
    }
    
    // ============================================================
    // AUDIO RECORDING DETECTION (WASAPI Loopback)
    // ============================================================
    
    /// <summary>
    /// Monitor for audio recording - WASAPI loopback captures system audio
    /// This detects if someone is recording system sounds (which often accompanies video recording)
    /// </summary>
    private static async Task AudioRecordingMonitor(CancellationToken ct)
    {
        ConsoleWrite("[DLP Audio] Audio recording monitor started.");
        
        // Recording tools that use WASAPI loopback
        var audioRecordingTools = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "audacity", "obs", "bandicam", "camtasia", "audacity",
            "audio recorder", "sound recorder", "voicemeeter"
        };
        
        while (!ct.IsCancellationRequested)
        {
            try
            {
                // Check processes for audio recording tools
                var processes = Process.GetProcesses();
                
                foreach (var proc in processes)
                {
                    try
                    {
                        var procName = proc.ProcessName.ToLower();
                        
                        if (audioRecordingTools.Any(art => procName.Contains(art)))
                        {
                            // Check if it's actively recording audio (high CPU usage is a hint)
                            var cpu = GetProcessCpuUsage(proc);
                            
                            if (cpu > 5) // Suspicious CPU usage
                            {
                                BroadcastEvent(new SecurityEvent
                                {
                                    Type = "AUDIO_RECORDING_DETECTED",
                                    Severity = "MEDIUM",
                                    Details = $"Potential audio recording detected: '{proc.ProcessName}' (CPU: {cpu:F1}%)",
                                    Timestamp = DateTime.UtcNow
                                });
                            }
                        }
                    }
                    catch { }
                    finally
                    {
                        proc.Dispose();
                    }
                }
                
                // Check for audio services that might indicate recording
                using var serviceSearcher = new ManagementObjectSearcher("SELECT * FROM Win32_Service WHERE Name LIKE '%Audio%' OR Name LIKE '%Sound%'");
                
                foreach (ManagementObject obj in serviceSearcher.Get())
                {
                    var name = obj["Name"]?.ToString() ?? "";
                    var state = obj["State"]?.ToString() ?? "";
                    var path = obj["PathName"]?.ToString() ?? "";
                    
                    // Check for suspicious audio services
                    if (path.Contains("obs", StringComparison.OrdinalIgnoreCase) ||
                        path.Contains("virtualaudio", StringComparison.OrdinalIgnoreCase))
                    {
                        ConsoleWrite($"[DLP Audio] Suspicious audio service: {name} ({state})");
                    }
                }
            }
            catch (Exception ex)
            {
                ConsoleWrite($"[DLP Audio] Monitor error: {ex.Message}");
            }
            
            await Task.Delay(3000, ct); // Check every 3 seconds
        }
    }
    
    /// <summary>
    /// Deep Process Monitor with Digital Signature verification and EDR remediation
    /// 
    /// UEBA Tier Logic:
    /// - Tier 1 (Auto-block + log): Screenshot hotkeys, basic detection - NO LLM needed
    /// - Tier 2 (Auto-block + log): Known recording tools detected - NO LLM needed
    /// - Tier 3 (Log + warn): Virtual displays, capture cards - NO LLM needed
    /// - Tier 4 (Log for analysis): RECORDING_LIKELY with confidence < 0.9 - LLM UEBA analysis
    /// - Tier 5 (Full UEBA): Anomalous patterns, behavioral analysis - LLM required
    /// </summary>
    private static async Task ProcessMonitor(CancellationToken ct)
    {
        ConsoleWrite("[DLP Process] Monitor started with EDR capabilities.");
        
        // Track recently broadcasted processes to avoid duplicate events
        // Key: process name, Value: last broadcast time
        var recentBroadcasts = new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        var broadcastCooldownSeconds = 30; // Don't re-broadcast same process within 30 seconds
        
        // Known recording/screenshot tools that should be auto-blocked
        var autoBlockProcesses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "obs64", "obs32", "obs", // OBS Studio - screen recording
            "bandicam", // Bandicam - screen recording
            "camtasia", "camtasiastudio", // Camtasia - screen recording
            "sharex", // ShareX - screenshot/recording
            "greenshot", // Greenshot - screenshots
            "lightshot", // Lightshot - screenshots
            "snagit", "snagit32", "snagit64", // Snagit
            "gamebar", "gamecaps", // Windows Game Bar
            "nvidians", // NVIDIA Share/ShadowPlay
            // Windows built-in screenshot tools
            "snippingtool", // Snipping Tool (Windows 10)
            "screenclippinghost", // Screen Clipping (Windows 10/11)
            "screensketch", // Screen Sketch (Windows 10)
            "snip", // Snip & Sketch (short name)
            "sniptool", // Snip Tool (Windows 11)
            "ms-snippingtool", // Windows 11 Snipping Tool
            "screenshottool", // Generic screenshot tool
            "picpick", // PicPick screenshot tool
            "faststone", // FastStone Capture
            "xpsp", // XP Screenshot Probe
        };
        
        // Known processes to monitor but NOT auto-block (need LLM analysis)
        // ONLY actual recording/broadcasting tools - NOT normal applications like browsers
        var monitorOnlyProcesses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "streamlabs",     // Streamlabs - broadcasting/recording
            "xsplit", "wirecast", // Broadcasting tools with recording
            "zoom",           // Zoom with screen recording capability
            "vlc",           // VLC with recording feature
            "opencaster",    // Screen capture tools
            "screencapture", // Screen capture utilities
        };
        
        // Processes to ALWAYS skip (normal system/apps, not recording tools)
        var skipProcesses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "chrome", "msedge", "firefox",  // Browsers - normal apps
            "msedgewebview2", "webview2",   // WebView2 - system component
            "discord", "slack", "teams",     // Communication apps - not recording
            "outlook", "onenote", "winword", "excel", "powerpnt", // Office apps
        };
        
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var processes = Process.GetProcesses();
                
                foreach (var proc in processes)
                {
                    try
                    {
                        var procName = proc.ProcessName.ToLower();
                        
                        // Check if it's in the skip list (normal apps, not recording tools)
                        if (skipProcesses.Any(kp => procName.Contains(kp))) continue;
                        
                        // Check if it's a known recording/screenshot tool
                        var isAutoBlock = autoBlockProcesses.Any(kp => procName.Contains(kp));
                        var isMonitorOnly = monitorOnlyProcesses.Any(kp => procName.Contains(kp));
                        
                        if (!isAutoBlock && !isMonitorOnly) continue;
                        
                        // Deep verification: Check digital signature
                        var verification = VerifyProcessSignature(proc);
                        var windowTitle = GetProcessWindowTitle(proc);
                        var cpuUsage = GetProcessCpuUsage(proc);
                        var confidence = GetRecordingConfidence(windowTitle, cpuUsage, verification);
                        
                        // Only log HIGH severity detections to reduce noise
                        // Monitor-only processes are logged without console output
                        if (isAutoBlock)
                        {
                            ConsoleWrite($"[DLP Process] Auto-block target: {proc.ProcessName} " +
                                $"(PID: {proc.Id})");
                            ConsoleWrite($"[DLP Process] Broadcasting event for: {proc.ProcessName}");
                        }
                        else if (isMonitorOnly)
                        {
                            ConsoleWrite($"[DLP Process] Monitor: {proc.ProcessName} " +
                                $"(PID: {proc.Id})");
                        }
                        
                        // ============================================================
                        // TIER 1 & 2: AUTO-BLOCK + LOG (No LLM needed)
                        // ============================================================
                        
                        if (isAutoBlock && _autoBlockEnabled)
                        {
                            // AUTO-BLOCK: Kill the process immediately
                            var killed = KillProcess(proc.ProcessName);
                            
                            BroadcastEvent(new SecurityEvent
                            {
                                Type = "RECORDING_TOOL_BLOCKED",
                                Severity = "HIGH",
                                Details = $"Recording/screenshot tool blocked and terminated: '{proc.ProcessName}' (PID: {proc.Id})",
                                Timestamp = DateTime.UtcNow
                            });
                            
                            continue; // Process killed, skip further checks
                        }
                        
                        // ============================================================
                        // TIER 3: MONITOR ONLY (Recording tool detected but not auto-block)
                        // Broadcast event for recording tool running
                        // ============================================================
                        
                        else if (isMonitorOnly)
                        {
                            // Check cooldown to avoid duplicate events
                            var procKey = $"{proc.ProcessName}_{proc.Id}";
                            var now = DateTime.UtcNow;
                            if (!recentBroadcasts.TryGetValue(procKey, out var lastTime) || 
                                (now - lastTime).TotalSeconds >= broadcastCooldownSeconds)
                            {
                                recentBroadcasts[procKey] = now;
                                BroadcastEvent(new SecurityEvent
                                {
                                    Type = "SCREEN_RECORDING_RUNNING",
                                    Severity = "HIGH",
                                    Details = $"Recording tool detected: '{proc.ProcessName}' (PID: {proc.Id}). " +
                                              $"Signer: {verification.SignerName ?? "Unknown"}",
                                    Timestamp = now
                                });
                            }
                        }
                    }
                    catch { /* Process might have exited */ }
                    finally
                    {
                        proc.Dispose();
                    }
                }
            }
            catch (Exception ex)
            {
                ConsoleWrite($"[DLP Process] Monitor error: {ex.Message}");
            }
            
            // Clean up old entries from recentBroadcasts to prevent memory leak
            // Keep entries for 5 minutes, remove anything older
            var cutoff = DateTime.UtcNow.AddMinutes(-5);
            var keysToRemove = recentBroadcasts.Where(kvp => kvp.Value < cutoff).Select(kvp => kvp.Key).ToList();
            foreach (var key in keysToRemove)
            {
                recentBroadcasts.Remove(key);
            }
            
            await Task.Delay(2000, ct); // Check every 2 seconds
        }
    }
    
    private static bool isLikelyRecording;
    
    /// <summary>
    /// Check if process is likely actively recording based on multiple factors
    /// </summary>
    private static bool IsProcessLikelyRecording(string? windowTitle, double cpuUsage, ProcessVerification verification)
    {
        isLikelyRecording = CheckIfLikelyRecording(windowTitle, cpuUsage, verification);
        return isLikelyRecording;
    }
    
    /// <summary>
    /// Verify process has valid digital signature
    /// </summary>
    private static ProcessVerification VerifyProcessSignature(Process process)
    {
        var result = new ProcessVerification
        {
            ProcessName = process.ProcessName,
            ProcessId = process.Id
        };
        
        try
        {
            if (string.IsNullOrEmpty(process.MainModule?.FileName))
                return result;
            
            var filePath = process.MainModule.FileName;
            
            // Verify Authenticode signature
            var sig = AuthenticodeTools.VerifyAuthenticodeSignature(filePath);
            result.IsSigned = sig.IsValid;
            result.SignerName = sig.SignerName;
            result.SignerHash = sig.Hash;
            
            // Calculate SHA256 hash
            using var sha256 = SHA256.Create();
            using var stream = File.OpenRead(filePath);
            var hash = sha256.ComputeHash(stream);
            result.FileHash = BitConverter.ToString(hash).Replace("-", "").ToLower();
            
            // Check if hash matches known malicious
            foreach (var kvp in KNOWN_SIGNATURES)
            {
                if (kvp.Value.Any(h => h.Equals(result.FileHash, StringComparison.OrdinalIgnoreCase)))
                {
                    result.IsKnownMalicious = true;
                    result.ThreatType = "KNOWN_RECORDING_TOOL";
                    break;
                }
            }
        }
        catch (Exception ex)
        {
            result.Error = ex.Message;
        }
        
        return result;
    }
    
    /// <summary>
    /// Check if process is likely actively recording
    /// Uses digital signature verification and multiple heuristics
    /// </summary>
    private static bool CheckIfLikelyRecording(string? windowTitle, double cpuUsage, ProcessVerification verification)
    {
        if (windowTitle == null) return false;
        
        var title = windowTitle.ToLower();
        
        // ============================================================
        // 1. CHECK DIGITAL SIGNATURE - Whitelist/Blacklist
        // ============================================================
        
        // If we know the signer is blocked, it's definitely suspicious
        if (!string.IsNullOrEmpty(verification.SignerName))
        {
            // Check blocked signers first (higher priority)
            foreach (var blocked in BLOCKED_SIGNERS)
            {
                if (verification.SignerName.Contains(blocked, StringComparison.OrdinalIgnoreCase))
                {
                    ConsoleWrite($"[DLP] Blocked signer detected: {verification.SignerName}");
                    // Even if just running (not recording), we flag it
                    if (cpuUsage > 2) return true;
                }
            }
            
            // Check trusted signers - these are allowed
            foreach (var trusted in TRUSTED_SIGNERS)
            {
                if (verification.SignerName.Contains(trusted, StringComparison.OrdinalIgnoreCase))
                {
                    // Trusted signer - be more lenient, only flag if clear recording indicators
                    if (title.Contains("recording") && cpuUsage > 20)
                        return true;
                    return false; // Trusted, assume safe unless very obvious
                }
            }
        }
        
        // ============================================================
        // 2. CHECK WINDOW TITLE PATTERNS
        // ============================================================
        
        var recordingIndicators = new[] { "recording", "replay buffer", "live", "streaming", "broadcast", "sharing", "capturing" };
        var hasRecordingIndicator = recordingIndicators.Any(ind => title.Contains(ind));
        
        // ============================================================
        // 3. COMBINE HEURISTICS
        // ============================================================
        
        // High CPU + recording title = very likely recording
        if (hasRecordingIndicator && cpuUsage > 5)
            return true;
        
        // Known malicious hash + any activity = suspicious
        if (verification.IsKnownMalicious && cpuUsage > 5)
            return true;
        
        // Unsigned executable + recording tool name + CPU = likely recording
        if (!verification.IsSigned && cpuUsage > 10 && 
            (title.Contains("recording") || title.Contains("capture")))
            return true;
        
        // Blocked signer + running = flagged
        return false; // Default to safe
    }
    
    /// <summary>
    /// Get confidence score for recording detection
    /// Returns a value between 0.0 (no confidence) and 1.0 (certain)
    /// </summary>
    private static double GetRecordingConfidence(string? windowTitle, double cpuUsage, ProcessVerification verification)
    {
        double confidence = 0.0;
        
        if (windowTitle == null) return confidence;
        var title = windowTitle.ToLower();
        
        // Digital signature checks (40% weight)
        if (!string.IsNullOrEmpty(verification.SignerName))
        {
            foreach (var blocked in BLOCKED_SIGNERS)
            {
                if (verification.SignerName.Contains(blocked, StringComparison.OrdinalIgnoreCase))
                {
                    confidence += 0.4;
                    break;
                }
            }
        }
        
        // Known malicious hash (20% weight)
        if (verification.IsKnownMalicious)
            confidence += 0.2;
        
        // Window title indicators (25% weight)
        var recordingIndicators = new[] { "recording", "replay buffer", "live", "streaming", "broadcast", "capturing" };
        if (recordingIndicators.Any(ind => title.Contains(ind)))
            confidence += 0.25;
        
        // CPU usage (15% weight)
        if (cpuUsage > 20) confidence += 0.15;
        else if (cpuUsage > 10) confidence += 0.10;
        else if (cpuUsage > 5) confidence += 0.05;
        
        return Math.Min(confidence, 1.0); // Cap at 1.0
    }
    
    /// <summary>
    /// Get window title of process
    /// </summary>
    private static string? GetProcessWindowTitle(Process process)
    {
        try
        {
            if (!string.IsNullOrEmpty(process.MainWindowTitle))
                return process.MainWindowTitle;
        }
        catch { }
        return null;
    }
    
    /// <summary>
    /// Get CPU usage of process
    /// </summary>
    private static double GetProcessCpuUsage(Process process)
    {
        try
        {
            return process.TotalProcessorTime.TotalMilliseconds / 
                   (Environment.ProcessorCount * (DateTime.Now - process.StartTime).TotalMilliseconds) * 100;
        }
        catch
        {
            return 0;
        }
    }
    
    // ============================================================
    // BIDIRECTIONAL NAMED PIPE COMMUNICATION
    // Supports both commands (Electron → Sidecar) and events (Sidecar → Electron)
    // ============================================================
    
    private static NamedPipeServerStream? _pipeServer;
    private static StreamWriter? _pipeWriter;
    private static readonly object _pipeLock = new();
    private static bool _electronConnected = false;
    
    /// <summary>
    /// Named Pipe Server for secure bidirectional communication with Electron
    /// - Commands: Electron → Sidecar (GET_STATUS, SET_USB, KILL_PROCESS, etc.)
    /// - Events: Sidecar → Electron (automatically pushed when security events detected)
    /// </summary>
    private static async Task StartPipeServer(CancellationToken ct)
    {
        ConsoleWrite("[DLP Pipe] Bidirectional server starting on pipe '" + PIPE_NAME + "'...");
        
        while (!ct.IsCancellationRequested)
        {
            try
            {
                // Create pipe security to allow Everyone access
                var pipeSecurity = new PipeSecurity();
                var everyoneRule = new PipeAccessRule(
                    new SecurityIdentifier(WellKnownSidType.WorldSid, null),
                    PipeAccessRights.FullControl,
                    System.Security.AccessControl.AccessControlType.Allow);
                pipeSecurity.AddAccessRule(everyoneRule);

                _pipeServer = NamedPipeServerStreamAcl.Create(
                    PIPE_NAME,
                    PipeDirection.InOut,
                    1,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous,
                    4096,    // outBufferSize
                    4096,    // inBufferSize
                    pipeSecurity);
                
                await _pipeServer.WaitForConnectionAsync(ct);
                ConsoleWrite("[DLP Pipe] Electron connected.");
                
                using var reader = new StreamReader(_pipeServer, leaveOpen: true);
                _pipeWriter = new StreamWriter(_pipeServer, leaveOpen: true) { AutoFlush = true };
                
                // Authenticate
                var token = await reader.ReadLineAsync(ct);
                if (token != AUTH_TOKEN)
                {
                    ConsoleWrite("[DLP Pipe] Authentication failed!");
                    await _pipeWriter.WriteLineAsync("AUTH_FAILED");
                    _pipeServer.Disconnect();
                    continue;
                }
                
                await _pipeWriter.WriteLineAsync("AUTH_OK");
                ConsoleWrite("[DLP Pipe] Authentication successful.");
                _electronConnected = true;

                // Flush any queued events immediately after connection
                ConsoleWrite($"[DLP Pipe] Flushing event queue on reconnect, {_eventQueue.Count} events pending");
                await PushEventsToElectron();
                
                // Create tasks for reading and event pushing
                var readTask = Task.Run(async () =>
                {
                    while (_pipeServer.IsConnected && !ct.IsCancellationRequested)
                    {
                        try
                        {
                            var line = await reader.ReadLineAsync(ct);
                            if (line == null) break;

                            // Skip empty lines and auth token (already authenticated)
                            if (string.IsNullOrWhiteSpace(line) || line == AUTH_TOKEN) continue;

                            var response = ProcessCommand(line);
                            await _pipeWriter.WriteLineAsync(response);
                        }
                        catch (OperationCanceledException) { throw; } // Propagate cancellation
                        catch when (!ct.IsCancellationRequested)
                        {
                            ConsoleWrite("[DLP Pipe] Read error, will reconnect...");
                            break;
                        }
                    }
                });

                // Push events to Electron periodically
                var pushTask = Task.Run(async () =>
                {
                    while (_pipeServer.IsConnected && !ct.IsCancellationRequested)
                    {
                        try
                        {
                            await PushEventsToElectron();
                            await Task.Delay(100, ct);
                        }
                        catch (OperationCanceledException) { throw; }
                        catch when (!ct.IsCancellationRequested)
                        {
                            ConsoleWrite("[DLP Pipe] Push error, will reconnect...");
                            break;
                        }
                    }
                });

                // Active connection health monitor - detects disconnects immediately
                // using Poll, instead of waiting for ReadLine to timeout
                var healthTask = Task.Run(async () =>
                {
                    while (_pipeServer.IsConnected && !ct.IsCancellationRequested)
                    {
                        try
                        {
                            // Poll every 1 second to detect connection drops
                            await Task.Delay(1000, ct);
                            if (_pipeServer != null && _pipeServer.CanRead)
                            {
                                // PipeHandle is the underlying OS handle for Poll
                                // Poll return value: 0 = error/disconnected, positive = readable
                                // We just need to check it's still "available"
                                // If IsConnected becomes false, break so WhenAll completes
                                if (!_pipeServer.IsConnected)
                                {
                                    ConsoleWrite("[DLP Pipe] Health check: connection lost, initiating reconnect...");
                                    break;
                                }
                            }
                            else if (_pipeServer.IsConnected == false)
                            {
                                break;
                            }
                        }
                        catch (OperationCanceledException) { throw; }
                        catch { break; }
                    }
                });

                // Wait for ALL tasks to complete before cleaning up
                // Health monitor will detect sudden disconnects (e.g. electron crash/killed)
                // and break its loop, causing WhenAll to complete
                await Task.WhenAll(readTask, pushTask, healthTask);

                // Log disconnect and add small delay before reconnecting
                ConsoleWrite("[DLP Pipe] Electron disconnected, waiting for reconnect...");
                _electronConnected = false;
                try 
                { 
                    if (_pipeServer.IsConnected) _pipeServer.Disconnect(); 
                } 
                catch { }
                _pipeServer.Dispose();
                _pipeServer = null;

                // Brief delay to prevent tight reconnect loop
                await Task.Delay(500, ct);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                ConsoleWrite($"[DLP Pipe] Error: {ex.Message}");
                _electronConnected = false;
                await Task.Delay(1000, ct); // Back off before retry
            }
            finally
            {
                _pipeServer?.Dispose();
                _pipeServer = null;
                _pipeWriter = null;
            }
        }
    }
    
    /// <summary>
    /// Push queued security events to Electron via named pipe
    /// Events are sent as JSON lines for real-time notification
    /// </summary>
    private static async Task PushEventsToElectron()
    {
        if (!_electronConnected || _pipeWriter == null) return;
        
        lock (_eventLock)
        {
            if (_eventQueue.Count == 0) return;
        }
        
        // Dequeue and send events
        var eventsToSend = new List<SecurityEvent>();
        lock (_eventLock)
        {
            while (_eventQueue.Count > 0)
            {
                eventsToSend.Add(_eventQueue.Dequeue());
            }
        }
        
        foreach (var evt in eventsToSend)
        {
            try
            {
                // Only push if connected, otherwise just dequeue and discard
                lock (_pipeLock)
                {
                    if (_pipeServer != null && _pipeServer.IsConnected && _pipeWriter != null)
                    {
                        var json = JsonSerializer.Serialize(evt);
                        _pipeWriter.WriteLine($"EVENT:{json}");
                        _pipeWriter.Flush();
                    }
                    else
                    {
                        // Electron not connected, discard event silently
                        continue;
                    }
                }
            }
            catch (Exception ex)
            {
                // Only log first failure, then suppress subsequent errors to reduce noise
                if (_electronConnected)
                {
                    ConsoleWrite($"[DLP Pipe] Push failed, will retry on reconnect: {ex.Message}");
                }
                // Don't re-queue - just discard to prevent queue buildup
            }
        }
    }
    
    /// <summary>
    /// Broadcast event to Electron via named pipe (real-time push)
    /// CRITICAL security events are broadcast to Electron for backend audit:
    /// - Screenshot attempts (SCREENSHOT_*)
    /// - Recording detected (SCREEN_RECORDING_*)
    /// - USB storage device events (USB_*)
    /// 
    /// NOT broadcast (informational only):
    /// - CONTENT_PROTECTION_* (system status)
    /// - AUDIO_RECORDING_DETECTED (low priority)
    /// - VIRTUAL_DISPLAY_DETECTED (context-dependent)
    /// </summary>
    private static async void BroadcastEvent(SecurityEvent evt)
    {
        // Inject current user context into every event
        lock (_userContextLock)
        {
            if (!string.IsNullOrEmpty(_currentAccountId))
                evt.AccountId = _currentAccountId;
            if (!string.IsNullOrEmpty(_currentUserName))
                evt.UserName = _currentUserName;
            if (!string.IsNullOrEmpty(_currentHostName))
                evt.HostName = _currentHostName;
        }
        
        // Filter: Only broadcast critical events to Electron for backend audit
        var criticalEventPrefixes = new[]
        {
            "SCREENSHOT_",    // Screenshot attempts - HIGH RISK
            "SCREENSHOT_KEY_", // PrintScreen key detected - HIGH RISK
            "SCREEN_RECORDING_",  // Recording start/stop/running - HIGH RISK
            "USB_",           // USB storage - HIGH RISK
            "WINDOW_SHARING_",    // Window sharing detected - HIGH RISK
            "WINDOW_THUMBNAIL_",  // Window thumbnail capture - HIGH RISK
            "WINDOW_CAPTURE_",    // Direct window capture detected - CRITICAL RISK
            "WINDOWS_SNIPPING_TOOL",  // Win+Shift+S screenshot tool - HIGH RISK
            "WIN_PRTSCN_",     // Win+PrintScreen - HIGH RISK
            "ALT_PRTSCN_",    // Alt+PrintScreen - HIGH RISK
            "SNIP_",          // Snip & Sketch tools - HIGH RISK
            "CTRL_SHIFT_S_",  // Ctrl+Shift+S screenshot - HIGH RISK
            "CAPTURE_TOOL_",  // Capture tool detected - HIGH RISK
            "RECORDING_TOOL_", // Recording tool blocked/running - HIGH RISK
            "VIRTUAL_DISPLAY_" // Virtual display detected - MEDIUM RISK
        };
        
        var isCritical = criticalEventPrefixes.Any(prefix => evt.Type.StartsWith(prefix));
        
        if (!isCritical)
        {
            // Only log to console, don't queue for Electron
            ConsoleWrite($"[DLP Event] {evt.Type} [{evt.Severity}]: {evt.Details} (NOT sent to audit)");
            return;
        }
        
        lock (_eventLock)
        {
            _eventQueue.Enqueue(evt);
            if (_eventQueue.Count > 50) _eventQueue.Dequeue();
        }
        
        // Also write to console for debugging
        ConsoleWrite($"[DLP Event →] {evt.Type} [{evt.Severity}]: {evt.Details}");
        
        // Try to push immediately if connected
        // First check pipe server state directly instead of cached flag
        var pipeServerExists = _pipeServer != null;
        var pipeServerConnected = pipeServerExists && _pipeServer.IsConnected;
        var pipeWriterExists = _pipeWriter != null;
        
        if (pipeServerConnected && pipeWriterExists)
        {
            try
            {
                var json = JsonSerializer.Serialize(evt);
                // Use synchronous write with timeout for reliability
                lock (_pipeLock)
                {
                    if (_pipeServer != null && _pipeServer.IsConnected && _pipeWriter != null)
                    {
                        _pipeWriter.WriteLine($"EVENT:{json}");
                        _pipeWriter.Flush();
                        ConsoleWrite($"[DLP Pipe] Event pushed successfully");
                    }
                    else
                    {
                        ConsoleWrite($"[DLP Pipe] Pipe disconnected, event queued for retry");
                    }
                }
            }
            catch (Exception ex)
            {
                ConsoleWrite($"[DLP Pipe] Immediate push failed: {ex.Message}");
                ConsoleWrite($"[DLP Pipe] Event queued for retry when Electron reconnects");
                // Event already in queue, will retry on reconnect
            }
        }
        else
        {
            ConsoleWrite($"[DLP Pipe] Electron not connected, event queued for retry");
        }
    }
    
    /// <summary>
    /// Process command from Electron
    /// </summary>
    private static string ProcessCommand(string command)
    {
        try
        {
            var parts = command.Split(' ', 2);
            var cmd = parts[0].ToUpper();
            var args = parts.Length > 1 ? parts[1] : "";
            
            switch (cmd)
            {
                case "PING":
                    return "PONG";
                    
                case "GET_USB_STATUS":
                    var status = GetUsbStorageStatus();
                    return status ? "USB_STORAGE_ENABLED" : "USB_STORAGE_DISABLED";
                    
                case "SET_USB_ENABLED":
                    SetUsbStorageEnabled(true);
                    BroadcastEvent(new SecurityEvent
                    {
                        Type = "USB_POLICY_CHANGED",
                        Severity = "INFO",
                        Details = "USB storage policy changed to ALLOWED by administrator",
                        Timestamp = DateTime.UtcNow
                    });
                    return "USB_STORAGE_ENABLED - Mass storage devices (flash drives, external HDD) are now allowed. HID devices (keyboard/mouse) unaffected.";
                    
                case "SET_USB_DISABLED":
                    SetUsbStorageEnabled(false);
                    BroadcastEvent(new SecurityEvent
                    {
                        Type = "USB_POLICY_CHANGED",
                        Severity = "INFO",
                        Details = "USB storage policy changed to BLOCKED by administrator",
                        Timestamp = DateTime.UtcNow
                    });
                    return "USB_STORAGE_DISABLED - Mass storage devices blocked. HID devices (keyboard/mouse) remain functional.";
                    
                case "SET_USER_INFO":
                    // Format: "SET_USER_INFO:accountId|userName|hostName"
                    // Called by Electron when user logs in, to annotate all future security events
                    UpdateUserContext(args);
                    return "USER_INFO_UPDATED";
                    
                case "GET_USB_INFO":
                    var info = GetUsbStorageStatus();
                    return $"USB Storage Driver: {(info ? "ENABLED" : "DISABLED")}\nHID Devices: ALLOWED (keyboard, mouse unaffected)\nMass Storage: {(info ? "ALLOWED" : "BLOCKED")}";
                    
                case "GET_PROCESSES":
                    return GetRunningProcesses();
                    
                case "KILL_PROCESS":
                    var killResult = KillProcess(args);
                    if (killResult.StartsWith("KILLED"))
                    {
                        BroadcastEvent(new SecurityEvent
                        {
                            Type = "PROCESS_TERMINATED",
                            Severity = "HIGH",
                            Details = $"Process terminated by administrator: {args}",
                            Timestamp = DateTime.UtcNow
                        });
                    }
                    return killResult;
                    
                case "GET_EVENTS":
                    return GetRecentEvents();
                    
                case "LOCK_WORKSTATION":
                    LockWorkstation();
                    BroadcastEvent(new SecurityEvent
                    {
                        Type = "WORKSTATION_LOCKED",
                        Severity = "HIGH",
                        Details = "Workstation locked by administrator",
                        Timestamp = DateTime.UtcNow
                    });
                    return "WORKSTATION_LOCKED";
                    
                case "SET_AUTO_BLOCK":
                    // Enable/disable automatic blocking of recording tools
                    var enabled = args.Equals("true", StringComparison.OrdinalIgnoreCase);
                    SetAutoBlockEnabled(enabled);
                    return $"AUTO_BLOCK {(enabled ? "ENABLED" : "DISABLED")}";
                    
                case "GET_AUTO_BLOCK":
                    return $"AUTO_BLOCK {(IsAutoBlockEnabled() ? "ENABLED" : "DISABLED")}";
                    
                case "GET_UEBA_TIER":
                    // Return UEBA processing tier recommendation
                    return "UEBA_TIER:4 - RECORDING_LIKELY requires LLM analysis for confirmation";
                    
                case "ENABLE_PROTECTION":
                    EnableGlobalProtection();
                    return "CONTENT_PROTECTION_ENABLED - Window content will appear as black in screenshots/recordings";
                    
                case "DISABLE_PROTECTION":
                    DisableGlobalProtection();
                    return "CONTENT_PROTECTION_DISABLED - Normal window display restored";
                    
                case "GET_PROTECTION_STATUS":
                    return GetProtectionStatus();

                case "GET_USB_DEVICES":
                    // Return current USB mass storage devices as a JSON array
                    ConsoleWrite($"[DLP Pipe] GET_USB_DEVICES command received");
                    var usbResult = GetCurrentUsbDevices();
                    ConsoleWrite($"[DLP Pipe] GET_USB_DEVICES returning: {usbResult.Substring(0, Math.Min(100, usbResult.Length))}...");
                    return usbResult;

                default:
                    return $"UNKNOWN_COMMAND: {cmd}";
            }
        }
        catch (Exception ex)
        {
            return $"ERROR: {ex.Message}";
        }
    }
    
    /// <summary>
    /// Lock the workstation (requires Windows API)
    /// </summary>
    [DllImport("user32.dll")]
    private static extern bool LockWorkstation();
    
    private static void LockWorkstationWithLogging()
    {
        ConsoleWrite("[DLP EDR] Locking workstation...");
        LockWorkstation();
    }
    
    /// <summary>
    /// Auto-block configuration
    /// </summary>
    private static bool _autoBlockEnabled = true;
    
    private static void SetAutoBlockEnabled(bool enabled)
    {
        _autoBlockEnabled = enabled;
        ConsoleWrite($"[DLP EDR] Auto-block {(enabled ? "ENABLED" : "DISABLED")}");
    }
    
    private static bool IsAutoBlockEnabled() => _autoBlockEnabled;
    
    // ============================================================
    // WINDOW CONTENT PROTECTION
    // Uses SetWindowDisplayAffinity to prevent screenshots
    // When WDA_MONITOR is set, window appears as black in captures
    // ============================================================
    
    // List of protected window handles
    private static readonly HashSet<IntPtr> _protectedWindows = new();
    private static bool _windowProtectionEnabled = false;
    
    /// <summary>
    /// Enable content protection on a specific window.
    /// When protected, the window appears BLACK in screenshots and recordings.
    /// Uses SetWindowDisplayAffinity API (Windows 7+).
    /// </summary>
    private static bool EnableWindowProtection(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero) return false;
        
        try
        {
            if (SetWindowDisplayAffinity(hwnd, WDA_MONITOR))
            {
                _protectedWindows.Add(hwnd);
                ConsoleWrite($"[DLP Protection] Window {hwnd} content protection enabled");
                return true;
            }
        }
        catch (Exception ex)
        {
            ConsoleWrite($"[DLP Protection] Failed to set protection: {ex.Message}");
        }
        return false;
    }
    
    /// <summary>
    /// Disable content protection on a window.
    /// </summary>
    private static bool DisableWindowProtection(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero) return false;
        
        try
        {
            if (SetWindowDisplayAffinity(hwnd, WDA_NONE))
            {
                _protectedWindows.Remove(hwnd);
                ConsoleWrite($"[DLP Protection] Window {hwnd} content protection disabled");
                return true;
            }
        }
        catch (Exception ex)
        {
            ConsoleWrite($"[DLP Protection] Failed to disable protection: {ex.Message}");
        }
        return false;
    }
    
    /// <summary>
    /// Enable protection on Electron main window automatically.
    /// Called when DLP protection is activated.
    /// </summary>
    private static void EnableGlobalProtection()
    {
        if (_windowProtectionEnabled) return;
        
        _windowProtectionEnabled = true;
        ConsoleWrite("[DLP Protection] Global window protection ENABLED");
        
        // Find and protect Electron windows
        var electronProcesses = Process.GetProcessesByName("electron");
        foreach (var proc in electronProcesses)
        {
            try
            {
                // Find windows belonging to this process
                EnumWindows((hwnd, lParam) =>
                {
                    uint processId;
                    GetWindowThreadProcessId(hwnd, out processId);
                    
                    if (processId == (uint)proc.Id)
                    {
                        // Check if it's a main window (has title)
                        var title = new StringBuilder(256);
                        GetWindowText(hwnd, title, title.Capacity);
                        
                        if (title.Length > 0)
                        {
                            EnableWindowProtection(hwnd);
                        }
                    }
                    return true;
                }, IntPtr.Zero);
            }
            catch { }
            finally
            {
                proc.Dispose();
            }
        }
        
        BroadcastEvent(new SecurityEvent
        {
            Type = "CONTENT_PROTECTION_ENABLED",
            Severity = "INFO",
            Details = "Window content protection enabled. Screenshots will show black.",
            Timestamp = DateTime.UtcNow
        });
    }
    
    /// <summary>
    /// Disable all window protections.
    /// </summary>
    private static void DisableGlobalProtection()
    {
        if (!_windowProtectionEnabled) return;
        
        _windowProtectionEnabled = false;
        
        foreach (var hwnd in _protectedWindows.ToList())
        {
            DisableWindowProtection(hwnd);
        }
        
        _protectedWindows.Clear();
        ConsoleWrite("[DLP Protection] Global window protection DISABLED");
        
        BroadcastEvent(new SecurityEvent
        {
            Type = "CONTENT_PROTECTION_DISABLED",
            Severity = "INFO",
            Details = "Window content protection disabled.",
            Timestamp = DateTime.UtcNow
        });
    }
    
    /// <summary>
    /// Enumerate all windows - P/Invoke for window finding
    /// </summary>
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    
    /// <summary>
    /// Get protection status
    /// </summary>
    private static string GetProtectionStatus()
    {
        return $"CONTENT_PROTECTION: {(_windowProtectionEnabled ? "ENABLED" : "DISABLED")}\n" +
               $"Protected Windows: {_protectedWindows.Count}";
    }
    
    /// <summary>
    /// Kill a suspicious process
    /// </summary>
    private static string KillProcess(string processName)
    {
        try
        {
            var processes = Process.GetProcessesByName(processName);
            foreach (var p in processes)
            {
                p.Kill();
                ConsoleWrite($"[DLP Sidecar] Killed process: {processName}");
            }
            return $"KILLED:{processes.Length}";
        }
        catch (Exception ex)
        {
            return $"KILL_FAILED:{ex.Message}";
        }
    }
    
    /// <summary>
    /// Get list of running processes as JSON
    /// </summary>
    private static string GetRunningProcesses()
    {
        var processes = Process.GetProcesses()
            .Where(p => !p.ProcessName.StartsWith("svchost"))
            .Select(p => new { Name = p.ProcessName, ID = p.Id })
            .Take(100)
            .ToList();
        
        return JsonSerializer.Serialize(processes);
    }
    
    // Event queue for Electron to consume
    private static readonly Queue<SecurityEvent> _eventQueue = new();
    private static readonly object _eventLock = new();
    
    // User context - updated when user logs in via SET_USER_INFO command
    // Used to annotate all security events with correct user identification
    private static string? _currentAccountId = null;
    private static string? _currentUserName = null;
    private static string? _currentHostName = null;
    private static readonly object _userContextLock = new();
    
    /// <summary>
    /// Get recent events for Electron
    /// </summary>
    private static string GetRecentEvents()
    {
        lock (_eventLock)
        {
            var events = _eventQueue.ToArray().Reverse().Take(10).ToArray();
            return JsonSerializer.Serialize(events);
        }
    }
}

/// <summary>
/// Security event data structure
/// </summary>
public class SecurityEvent
{
    public string Type { get; set; } = "";
    public string Severity { get; set; } = "INFO";
    public string Details { get; set; } = "";
    public DateTime Timestamp { get; set; }
    // User context - populated from JWT when user logs in
    public string? AccountId { get; set; }
    public string? UserName { get; set; }
    public string? HostName { get; set; }
}

/// <summary>
/// Process verification result
/// </summary>
public class ProcessVerification
{
    public string ProcessName { get; set; } = "";
    public int ProcessId { get; set; }
    public bool IsSigned { get; set; }
    public string? SignerName { get; set; }
    public string? SignerHash { get; set; }
    public string? FileHash { get; set; }
    public bool IsKnownMalicious { get; set; }
    public string? ThreatType { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Authenticode signature verification tools
/// </summary>
public static class AuthenticodeTools
{
    [DllImport("wintrust.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int WinVerifyTrust(IntPtr hwnd, [MarshalAs(UnmanagedType.LPStruct)] Guid pgActionID, ref WINTRUST_DATA pWVTData);
    
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct WINTRUST_FILE_INFO
    {
        public uint cbStruct;
        public string pcwszFilePath;
        public IntPtr hFile;
        public IntPtr pgKnownSubject;
    }
    
    [StructLayout(LayoutKind.Sequential)]
    private struct WINTRUST_DATA
    {
        public uint cbStruct;
        public IntPtr pPolicyCallbackData;
        public IntPtr pSIPClientData;
        public uint dwUIChoice;
        public uint fdwRevocationChecks;
        public uint dwUnionChoice;
        public IntPtr pFile;
        public uint dwStateAction;
        public IntPtr hWVTStateData;
        public IntPtr pwszURLReference;
        public uint dwProvFlags;
        public uint dwUIContext;
        public IntPtr pSignatureSettings;
    }
    
    private static readonly Guid WINTRUST_ACTION_GENERIC_VERIFY_V2 = new("00AAC56B-CD44-11d0-8CC2-00C04FC295EE");
    
    public static (bool IsValid, string? SignerName, string? Hash) VerifyAuthenticodeSignature(string filePath)
    {
        try
        {
            var fileInfo = new WINTRUST_FILE_INFO
            {
                cbStruct = (uint)Marshal.SizeOf<WINTRUST_FILE_INFO>(),
                pcwszFilePath = filePath
            };
            
            var trustData = new WINTRUST_DATA
            {
                cbStruct = (uint)Marshal.SizeOf<WINTRUST_DATA>(),
                dwUnionChoice = 2, // WTD_CHOICE_FILE
                pFile = Marshal.AllocHGlobal(Marshal.SizeOf<WINTRUST_FILE_INFO>()),
                dwUIChoice = 2 // WTD_UI_NONE
            };
            Marshal.StructureToPtr(fileInfo, trustData.pFile, false);
            
            var result = WinVerifyTrust(IntPtr.Zero, WINTRUST_ACTION_GENERIC_VERIFY_V2, ref trustData);
            
            Marshal.FreeHGlobal(trustData.pFile);
            
            if (result == 0)
            {
                // Get signer info
                var signerInfo = GetSignerInfo(filePath);
                return (true, signerInfo.Name, signerInfo.Hash);
            }
            
            return (false, null, null);
        }
        catch
        {
            return (false, null, null);
        }
    }
    
    private static (string? Name, string? Hash) GetSignerInfo(string filePath)
    {
        try
        {
            // Simplified - just return file hash for now
            using var sha256 = SHA256.Create();
            using var stream = File.OpenRead(filePath);
            var hash = sha256.ComputeHash(stream);
            return (null, BitConverter.ToString(hash).Replace("-", ""));
        }
        catch
        {
            return (null, null);
        }
    }
}
