using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms; // For WM_DEVICECHANGE

namespace SecurityMonitor
{
    #region Native API Structures

    [StructLayout(LayoutKind.Sequential)]
    public struct DEV_BROADCAST_HDR
    {
        public uint dbch_size;
        public uint dbch_devicetype;
        public uint dbch_reserved;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DEV_BROADCAST_DEVICEINTERFACE
    {
        public uint dbcc_size;
        public uint dbcc_devicetype;
        public uint dbcc_reserved;
        public Guid dbcc_classguid;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 255)]
        public string dbcc_name;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DEV_BROADCAST_VOLUME
    {
        public uint dbcv_size;
        public uint dbcv_devicetype;
        public uint dbcv_reserved;
        public uint dbcv_unitmask;
        public ushort dbcv_flags;
    }

    #endregion

    #region P/Invoke Declarations

    public static class NativeMethods
    {
        public const int WM_DEVICECHANGE = 0x0219;
        public const int DBT_DEVICEARRIVAL = 0x8000;
        public const int DBT_DEVICEREMOVECOMPLETE = 0x8004;
        public const int DBT_DEVTYP_DEVICEINTERFACE = 0x00000005;
        public const int DBT_DEVTYP_VOLUME = 0x00000002;

        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr FindWindow(string? lpClassName, string? lpWindowName);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll")]
        public static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("advapi32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern IntPtr CreateFile(
            string lpFileName,
            uint dwDesiredAccess,
            uint dwShareMode,
            IntPtr lpSecurityAttributes,
            uint dwCreationDisposition,
            uint dwFlagsAndAttributes,
            IntPtr hTemplateFile);

        [DllImport("advapi32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool DeviceIoControl(
            IntPtr hDevice,
            uint dwIoControlCode,
            IntPtr lpInBuffer,
            uint nInBufferSize,
            IntPtr lpOutBuffer,
            uint nOutBufferSize,
            out uint lpBytesReturned,
            IntPtr lpOverlapped);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern IntPtr CreateNamedPipe(
            string lpName,
            uint dwOpenMode,
            uint dwPipeMode,
            uint nMaxInstances,
            uint nOutBufferSize,
            uint nInBufferSize,
            uint nDefaultTimeOut,
            IntPtr lpSecurityAttributes);

        [DllImport("kernel32.dll")]
        public static extern bool ConnectNamedPipe(IntPtr hNamedPipe, IntPtr lpOverlapped);

        [DllImport("kernel32.dll")]
        public static extern bool DisconnectNamedPipe(IntPtr hNamedPipe);

        [DllImport("kernel32.dll")]
        public static extern bool ReadFile(
            IntPtr hFile,
            byte[] lpBuffer,
            uint nNumberOfBytesToRead,
            out uint lpNumberOfBytesRead,
            IntPtr lpOverlapped);

        [DllImport("kernel32.dll")]
        public static extern bool WriteFile(
            IntPtr hFile,
            byte[] lpBuffer,
            uint nNumberOfBytesToWrite,
            out uint lpNumberOfBytesWritten,
            IntPtr lpOverlapped);

        [DllImport("kernel32.dll")]
        public static extern IntPtr CreateEvent(IntPtr lpSecurityAttributes, bool bManualReset, bool bInitialState, string? lpName);

        [DllImport("kernel32.dll")]
        public static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

        [DllImport("kernel32.dll")]
        public static extern bool CloseHandle(IntPtr hObject);

        [DllImport("kernel32.dll")]
        public static extern IntPtr GetStdHandle(uint nStdHandle);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetStdHandle(uint nStdHandle, IntPtr hHandle);

        public const uint INVALID_HANDLE_VALUE = 0xFFFFFFFF;
        public const uint GENERIC_READ = 0x80000000;
        public const uint GENERIC_WRITE = 0x40000000;
        public const uint FILE_SHARE_READ = 0x00000001;
        public const uint FILE_SHARE_WRITE = 0x00000002;
        public const uint OPEN_EXISTING = 3;
        public const uint PIPE_ACCESS_DUPLEX = 0x00000003;
        public const uint PIPE_TYPE_MESSAGE = 0x00000004;
        public const uint PIPE_READMODE_MESSAGE = 0x00000002;
        public const uint PIPE_WAIT = 0x00000000;
        public const uint INFINITE = 0xFFFFFFFF;
    }

    #endregion

    #region Data Models

    public class SecurityEvent
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = "SECURITY_EVENT";

        [JsonPropertyName("eventType")]
        public string EventType { get; set; } = "";

        [JsonPropertyName("severity")]
        public string Severity { get; set; } = "MEDIUM";

        [JsonPropertyName("details")]
        public EventDetails Details { get; set; } = new();

        [JsonPropertyName("requiresAction")]
        public bool RequiresAction { get; set; } = true;

        [JsonPropertyName("timestamp")]
        public string Timestamp { get; set; } = DateTime.UtcNow.ToString("o");
    }

    public class EventDetails
    {
        [JsonPropertyName("deviceId")]
        public string? DeviceId { get; set; }

        [JsonPropertyName("processName")]
        public string? ProcessName { get; set; }

        [JsonPropertyName("windowTitle")]
        public string? WindowTitle { get; set; }

        [JsonPropertyName("processPath")]
        public string? ProcessPath { get; set; }

        [JsonPropertyName("hash")]
        public string? Hash { get; set; }

        [JsonPropertyName("signature")]
        public string? Signature { get; set; }

        [JsonPropertyName("deviceClass")]
        public string? DeviceClass { get; set; }

        [JsonPropertyName("volumeLabel")]
        public string? VolumeLabel { get; set; }

        [JsonPropertyName("username")]
        public string? Username { get; set; }

        [JsonPropertyName("hostname")]
        public string? Hostname { get; set; }
    }

    public class CommandMessage
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = "COMMAND";

        [JsonPropertyName("command")]
        public string Command { get; set; } = "";

        [JsonPropertyName("target")]
        public string? Target { get; set; }

        [JsonPropertyName("reason")]
        public string? Reason { get; set; }
    }

    #endregion

    #region USB Controller

    public class UsbController : IDisposable
    {
        private readonly List<string> _knownMassStorageDevices = new();
        private Form? _deviceChangeForm;
        private bool _usbStorageEnabled = true;

        // USB Storage Registry Path
        private const string USB_STOR_REG_PATH = @"SYSTEM\CurrentControlSet\Services\USBSTOR";

        public event EventHandler<SecurityEvent>? UsbDeviceArrived;
        public event EventHandler<SecurityEvent>? UsbDeviceRemoved;

        public void StartMonitoring()
        {
            Console.WriteLine("[USB] Starting USB monitoring...");

            // Create hidden form for WM_DEVICECHANGE handling
            var thread = new Thread(() =>
            {
                Application.Run(new DeviceChangeForm(this));
            });
            thread.SetApartmentState(ApartmentState.STA);
            thread.IsBackground = true;
            thread.Start();

            // Initial scan
            ScanCurrentUsbDevices();
        }

        private void ScanCurrentUsbDevices()
        {
            try
            {
                // Enumerate removable drives using WMI
                var searcher = new System.Management.ManagementObjectSearcher(
                    "SELECT DeviceID, VolumeName, Size FROM Win32_LogicalDisk WHERE DriveType=2");

                foreach (System.Management.ManagementObject drive in searcher.Get())
                {
                    var deviceId = drive["DeviceID"]?.ToString() ?? "";
                    var volumeLabel = drive["VolumeName"]?.ToString();
                    _knownMassStorageDevices.Add(deviceId);

                    Console.WriteLine($"[USB] Found removable drive: {deviceId} ({volumeLabel ?? "NO_LABEL"})");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[USB] Error scanning USB devices: {ex.Message}");
            }
        }

        public void OnDeviceChange(int wParam, IntPtr lParam)
        {
            if (lParam == IntPtr.Zero) return;

            try
            {
                if (wParam == NativeMethods.DBT_DEVICEARRIVAL)
                {
                    var deviceId = GetDeviceId(lParam);
                    if (!string.IsNullOrEmpty(deviceId))
                    {
                        Console.WriteLine($"[USB] Device arrived: {deviceId}");

                        // Check device class
                        var deviceClass = GetDeviceClass(deviceId);
                        if (IsMassStorageDevice(deviceId, deviceClass))
                        {
                            _knownMassStorageDevices.Add(deviceId);

                            var evt = new SecurityEvent
                            {
                                EventType = "USB_MASS_STORAGE_DETECTED",
                                Severity = "HIGH",
                                RequiresAction = true,
                                Details = new EventDetails
                                {
                                    DeviceId = deviceId,
                                    DeviceClass = "MassStorage",
                                    Username = Environment.UserName,
                                    Hostname = Environment.MachineName
                                }
                            };

                            // Block the device
                            BlockUsbDevice(deviceId);

                            UsbDeviceArrived?.Invoke(this, evt);
                        }
                        else
                        {
                            Console.WriteLine($"[USB] Non-mass storage device (allowed): {deviceId}");
                        }
                    }
                }
                else if (wParam == NativeMethods.DBT_DEVICEREMOVECOMPLETE)
                {
                    var deviceId = GetDeviceId(lParam);
                    if (!string.IsNullOrEmpty(deviceId))
                    {
                        Console.WriteLine($"[USB] Device removed: {deviceId}");
                        _knownMassStorageDevices.Remove(deviceId);

                        var evt = new SecurityEvent
                        {
                            EventType = "USB_DEVICE_REMOVED",
                            Severity = "LOW",
                            RequiresAction = false,
                            Details = new EventDetails
                            {
                                DeviceId = deviceId,
                                Username = Environment.UserName,
                                Hostname = Environment.MachineName
                            }
                        };

                        UsbDeviceRemoved?.Invoke(this, evt);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[USB] Error handling device change: {ex.Message}");
            }
        }

        private string? GetDeviceId(IntPtr lParam)
        {
            try
            {
                var header = Marshal.PtrToStructure<DEV_BROADCAST_HDR>(lParam);

                if (header.dbch_devicetype == NativeMethods.DBT_DEVTYP_DEVICEINTERFACE)
                {
                    var deviceInfo = Marshal.PtrToStructure<DEV_BROADCAST_DEVICEINTERFACE>(lParam);
                    return deviceInfo.dbcc_name;
                }
                else if (header.dbch_devicetype == NativeMethods.DBT_DEVTYP_VOLUME)
                {
                    var volume = Marshal.PtrToStructure<DEV_BROADCAST_VOLUME>(lParam);
                    // Get drive letter from unitmask
                    for (int i = 0; i < 26; i++)
                    {
                        if ((volume.dbcv_unitmask & (1 << i)) != 0)
                        {
                            return $"{Char.ConvertFromUtf32('A' + i)}:";
                        }
                    }
                }
            }
            catch { }

            return null;
        }

        private string? GetDeviceClass(string deviceId)
        {
            try
            {
                // Query device class via WMI
                var searcher = new System.Management.ManagementObjectSearcher(
                    $"SELECT * FROM Win32_PnPEntity WHERE DeviceID = '{deviceId.Replace("\\", "\\\\")}'");

                foreach (System.Management.ManagementObject obj in searcher.Get())
                {
                    return obj["PNPClass"]?.ToString();
                }
            }
            catch { }

            return null;
        }

        private bool IsMassStorageDevice(string? deviceId, string? deviceClass)
        {
            if (string.IsNullOrEmpty(deviceId)) return false;

            // Check if it's a drive letter (removable disk)
            if (deviceId.Length == 2 && deviceId.EndsWith(":"))
            {
                return true; // Treat as mass storage
            }

            // Check device class
            if (!string.IsNullOrEmpty(deviceClass))
            {
                var lowerClass = deviceClass.ToLowerInvariant();
                // Whitelist: Allow these device classes
                if (lowerClass.Contains("keyboard") ||
                    lowerClass.Contains("mouse") ||
                    lowerClass.Contains("pointing") ||
                    lowerClass.Contains("hid") ||
                    lowerClass.Contains("usb hub") ||
                    lowerClass.Contains("bluetooth"))
                {
                    return false;
                }
            }

            // Default to mass storage for unknown devices
            return true;
        }

        public void BlockUsbDevice(string deviceId)
        {
            Console.WriteLine($"[USB] Blocking device: {deviceId}");

            try
            {
                // Method 1: Disable the device via WMI
                DisableDeviceViaWmi(deviceId);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[USB] Failed to disable device: {ex.Message}");
            }
        }

        private void DisableDeviceViaWmi(string deviceId)
        {
            try
            {
                var searcher = new System.Management.ManagementObjectSearcher(
                    $"SELECT * FROM Win32_PnPEntity WHERE DeviceID = '{deviceId.Replace("\\", "\\\\")}'");

                foreach (System.Management.ManagementObject device in searcher.Get())
                {
                    var result = device.InvokeMethod("Disable", null);
                    Console.WriteLine($"[USB] Disable result: {result}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[USB] WMI Disable failed: {ex.Message}");
            }
        }

        public void SetUsbStorageEnabled(bool enabled)
        {
            _usbStorageEnabled = enabled;
            Console.WriteLine($"[USB] USB Storage policy: {(enabled ? "ENABLED" : "DISABLED")}");

            try
            {
                using var key = Microsoft.Win32.Registry.LocalMachine.CreateSubKey(USB_STOR_REG_PATH);
                if (key != null)
                {
                    // Start = 3 (Boot start), Start = 4 (Disabled)
                    key.SetValue("Start", enabled ? 3 : 4, Microsoft.Win32.RegistryValueKind.DWord);
                    Console.WriteLine($"[USB] Registry updated: USBSTOR Start = {(enabled ? 3 : 4)}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[USB] Registry update failed: {ex.Message}");
            }
        }

        public void Dispose()
        {
            _deviceChangeForm?.Close();
        }
    }

    // Hidden form for receiving Windows messages
    internal class DeviceChangeForm : Form
    {
        private readonly UsbController _controller;

        public DeviceChangeForm(UsbController controller)
        {
            _controller = controller;
            _controller._deviceChangeForm = this;

            // Set form properties for hidden operation
            var styles = NativeMethods.GetWindowLong(Handle, NativeMethods.GWL_STYLE);
            NativeMethods.SetWindowLong(Handle, NativeMethods.GWL_STYLE, (IntPtr)(styles & ~(int)NativeMethods.WS.VISIBLE));
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == NativeMethods.WM_DEVICECHANGE)
            {
                _controller.OnDeviceChange((int)m.WParam, m.LParam);
            }
            base.WndProc(ref m);
        }

        private const int GWL_STYLE = -16;
        private const int WS_VISIBLE = 0x10000000;

        [DllImport("user32.dll")]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll")]
        private static extern int SetWindowLong(IntPtr hWnd, int nIndex, IntPtr dwNewLong);
    }

    #endregion

    #region Process Monitor

    public class ProcessMonitor
    {
        private readonly Dictionary<string, string> _knownProcessHashes = new();
        private System.Timers.Timer? _monitorTimer;

        // Known process hashes (SHA256) - should be populated from config
        private readonly Dictionary<string, string[]> _suspiciousProcessSignatures = new()
        {
            { "obs64.exe", Array.Empty<string>() }, // Add actual hashes
            { "obs32.exe", Array.Empty<string>() },
            { "bandicam.exe", Array.Empty<string>() },
            { "camtasia.exe", Array.Empty<string>() },
            { "sharex.exe", Array.Empty<string>() },
            { "greenshot.exe", Array.Empty<string>() },
            { "lightshot.exe", Array.Empty<string>() },
            { "snagit.exe", Array.Empty<string>() },
            { "gamebar.exe", Array.Empty<string>() },
            { "looms.exe", Array.Empty<string>() },
        };

        public event EventHandler<SecurityEvent>? SuspiciousProcessDetected;

        public void StartMonitoring(int intervalMs = 3000)
        {
            Console.WriteLine("[Process] Starting process monitoring...");

            _monitorTimer = new System.Timers.Timer(intervalMs);
            _monitorTimer.Elapsed += (_, _) => ScanProcesses();
            _monitorTimer.AutoReset = true;
            _monitorTimer.Start();
        }

        private void ScanProcesses()
        {
            try
            {
                var processes = Process.GetProcesses();

                foreach (var process in processes)
                {
                    try
                    {
                        var processName = process.ProcessName.ToLowerInvariant() + ".exe";
                        var windowTitle = "";

                        // Try to get window title
                        if (!string.IsNullOrEmpty(process.MainWindowTitle))
                        {
                            windowTitle = process.MainWindowTitle;
                        }

                        // Check if this is a suspicious process
                        if (IsSuspiciousProcess(processName))
                        {
                            // Get process path and verify
                            var processPath = GetProcessPath(process);
                            var hash = CalculateFileHash(processPath ?? "");

                            // Create security event
                            var evt = new SecurityEvent
                            {
                                EventType = "SUSPICIOUS_PROCESS_DETECTED",
                                Severity = "HIGH",
                                RequiresAction = true,
                                Details = new EventDetails
                                {
                                    ProcessName = process.ProcessName + ".exe",
                                    ProcessPath = processPath,
                                    WindowTitle = windowTitle,
                                    Hash = hash,
                                    Username = Environment.UserName,
                                    Hostname = Environment.MachineName
                                }
                            };

                            // Verify digital signature
                            var signature = VerifyDigitalSignature(processPath ?? "");
                            if (!string.IsNullOrEmpty(signature))
                            {
                                evt.Details.Signature = signature;
                            }

                            SuspiciousProcessDetected?.Invoke(this, evt);
                        }
                    }
                    catch { }
                    finally
                    {
                        process.Dispose();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Process] Scan error: {ex.Message}");
            }
        }

        private bool IsSuspiciousProcess(string processName)
        {
            return _suspiciousProcessSignatures.Keys.Any(k =>
                processName.Contains(k.Replace(".exe", ""), StringComparison.OrdinalIgnoreCase));
        }

        private string? GetProcessPath(Process process)
        {
            try
            {
                return process.MainModule?.FileName;
            }
            catch
            {
                return null;
            }
        }

        private string? CalculateFileHash(string filePath)
        {
            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                return null;

            try
            {
                using var sha256 = SHA256.Create();
                using var stream = File.OpenRead(filePath);
                var hash = sha256.ComputeHash(stream);
                return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
            }
            catch
            {
                return null;
            }
        }

        private string? VerifyDigitalSignature(string filePath)
        {
            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
                return null;

            try
            {
                // Use signtool output to check signature
                var startInfo = new ProcessStartInfo
                {
                    FileName = "powershell",
                    Arguments = $"(Get-AuthenticodeSignature '{filePath.Replace("'", "''")}').Status",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true
                };

                using var process = Process.Start(startInfo);
                var output = process?.StandardOutput.ReadToEnd();
                process?.WaitForExit(5000);

                if (output != null && output.Trim() == "Valid")
                {
                    // Get signer certificate info
                    var certInfo = new ProcessStartInfo
                    {
                        FileName = "powershell",
                        Arguments = $"(Get-AuthenticodeSignature '{filePath.Replace("'", "''")}').SignerCertificate.Subject",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        CreateNoWindow = true
                    };

                    using var certProcess = Process.Start(certInfo);
                    var subject = certProcess?.StandardOutput.ReadToEnd();
                    certProcess?.WaitForExit(5000);

                    return subject?.Trim();
                }

                return "Unsigned";
            }
            catch
            {
                return null;
            }
        }

        public void StopMonitoring()
        {
            _monitorTimer?.Stop();
            _monitorTimer?.Dispose();
        }
    }

    #endregion

    #region Recording Detector

    public class RecordingDetector
    {
        private System.Timers.Timer? _detectorTimer;
        private readonly HashSet<string> _detectedWindows = new();

        // Recording window patterns
        private readonly Dictionary<string, string[]> _recordingPatterns = new()
        {
            { "obs", new[] { "recording", "streaming", "replay buffer", "obs studio" } },
            { "bandicam", new[] { "recording", "capturing", "bandicam" } },
            { "camtasia", new[] { "recording", "rec", "camtasia" } },
            { "game bar", new[] { "capturing", "game bar", "xbox" } },
            { "nvidia", new[] { "shadowplay", "nvidia", "recording" } },
            { "looms", new[] { "recording", "loom" } },
            { "screencastify", new[] { "recording", "screencastify" } },
            { "discord", new[] { "screenshare", "go live", "streaming" } },
            { "teams", new[] { "sharing", "presenting", "teams" } },
            { "zoom", new[] { "sharing", "zoom", "recording" } },
        };

        public event EventHandler<SecurityEvent>? RecordingDetected;

        public void StartMonitoring(int intervalMs = 2000)
        {
            Console.WriteLine("[Recording] Starting recording detection...");

            _detectorTimer = new System.Timers.Timer(intervalMs);
            _detectorTimer.Elapsed += (_, _) => ScanWindows();
            _detectorTimer.AutoReset = true;
            _detectorTimer.Start();
        }

        private void ScanWindows()
        {
            try
            {
                NativeMethods.EnumWindows((hWnd, _) =>
                {
                    try
                    {
                        if (!NativeMethods.IsWindowVisible(hWnd))
                            return true;

                        var length = NativeMethods.GetWindowTextLength(hWnd);
                        if (length == 0)
                            return true;

                        var sb = new StringBuilder(length + 1);
                        NativeMethods.GetWindowText(hWnd, sb, sb.Capacity);
                        var title = sb.ToString();

                        if (string.IsNullOrWhiteSpace(title))
                            return true;

                        // Check for recording indicators
                        var titleLower = title.ToLowerInvariant();
                        foreach (var (process, patterns) in _recordingPatterns)
                        {
                            foreach (var pattern in patterns)
                            {
                                if (titleLower.Contains(pattern))
                                {
                                    var windowKey = $"{hWnd}:{title}";
                                    if (!_detectedWindows.Contains(windowKey))
                                    {
                                        _detectedWindows.Add(windowKey);

                                        NativeMethods.GetWindowThreadProcessId(hWnd, out uint processId);
                                        var proc = Process.GetProcessById((int)processId);
                                        var processPath = GetProcessPathSafe(proc);

                                        var evt = new SecurityEvent
                                        {
                                            EventType = "RECORDING_DETECTED",
                                            Severity = "HIGH",
                                            RequiresAction = true,
                                            Details = new EventDetails
                                            {
                                                ProcessName = proc.ProcessName + ".exe",
                                                ProcessPath = processPath,
                                                WindowTitle = title,
                                                Username = Environment.UserName,
                                                Hostname = Environment.MachineName
                                            }
                                        };

                                        RecordingDetected?.Invoke(this, evt);
                                        Console.WriteLine($"[Recording] DETECTED: {title} (Process: {proc.ProcessName})");
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    catch { }

                    return true;
                }, IntPtr.Zero);

                // Clean up old window entries periodically
                if (_detectedWindows.Count > 100)
                {
                    _detectedWindows.Clear();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Recording] Scan error: {ex.Message}");
            }
        }

        private string? GetProcessPathSafe(Process process)
        {
            try
            {
                return process.MainModule?.FileName;
            }
            catch
            {
                return null;
            }
        }

        public void StopMonitoring()
        {
            _detectorTimer?.Stop();
            _detectorTimer?.Dispose();
        }
    }

    #endregion

    #region Named Pipe Server

    public class IpcServer : IDisposable
    {
        private const string PIPE_NAME = @"\\.\pipe\DLP_SecurityPipe";
        private const uint BUFFER_SIZE = 4096;

        private Thread? _listenerThread;
        private readonly List<IntPtr> _connectedClients = new();
        private bool _isRunning;

        public event EventHandler<CommandMessage>? CommandReceived;

        public void Start()
        {
            Console.WriteLine($"[IPC] Starting named pipe server: {PIPE_NAME}");

            _isRunning = true;
            _listenerThread = new Thread(ListenForClients);
            _listenerThread.IsBackground = true;
            _listenerThread.Start();
        }

        private void ListenForClients()
        {
            while (_isRunning)
            {
                try
                {
                    var pipe = NativeMethods.CreateNamedPipe(
                        PIPE_NAME,
                        NativeMethods.PIPE_ACCESS_DUPLEX,
                        NativeMethods.PIPE_TYPE_MESSAGE | NativeMethods.PIPE_READMODE_MESSAGE | NativeMethods.PIPE_WAIT,
                        10, // Max instances
                        BUFFER_SIZE,
                        BUFFER_SIZE,
                        0,
                        IntPtr.Zero);

                    if (pipe == new IntPtr(-1))
                    {
                        Thread.Sleep(100);
                        continue;
                    }

                    Console.WriteLine("[IPC] Client connected");
                    _connectedClients.Add(pipe);

                    // Handle client in separate thread
                    var clientThread = new Thread(() => HandleClient(pipe));
                    clientThread.IsBackground = true;
                    clientThread.Start();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[IPC] Listen error: {ex.Message}");
                    Thread.Sleep(100);
                }
            }
        }

        private void HandleClient(IntPtr pipe)
        {
            var buffer = new byte[BUFFER_SIZE];

            while (_isRunning)
            {
                try
                {
                    uint bytesRead = 0;
                    var success = NativeMethods.ReadFile(pipe, buffer, BUFFER_SIZE, out bytesRead, IntPtr.Zero);

                    if (!success || bytesRead == 0)
                    {
                        break;
                    }

                    var message = Encoding.UTF8.GetString(buffer, 0, (int)bytesRead);
                    Console.WriteLine($"[IPC] Received: {message}");

                    try
                    {
                        var command = JsonSerializer.Deserialize<CommandMessage>(message);
                        if (command != null)
                        {
                            CommandReceived?.Invoke(this, command);
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[IPC] Parse error: {ex.Message}");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[IPC] Read error: {ex.Message}");
                    break;
                }
            }

            NativeMethods.DisconnectNamedPipe(pipe);
            _connectedClients.Remove(pipe);
            NativeMethods.CloseHandle(pipe);
            Console.WriteLine("[IPC] Client disconnected");
        }

        public void SendEvent(SecurityEvent evt)
        {
            var json = JsonSerializer.Serialize(evt);
            SendMessage(json);
        }

        public void SendMessage(string message)
        {
            var data = Encoding.UTF8.GetBytes(message + "\n");

            foreach (var client in _connectedClients.ToList())
            {
                try
                {
                    uint written = 0;
                    NativeMethods.WriteFile(client, data, (uint)data.Length, out written, IntPtr.Zero);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[IPC] Write error: {ex.Message}");
                }
            }
        }

        public void Stop()
        {
            _isRunning = false;

            foreach (var client in _connectedClients)
            {
                try
                {
                    NativeMethods.DisconnectNamedPipe(client);
                    NativeMethods.CloseHandle(client);
                }
                catch { }
            }
            _connectedClients.Clear();
        }

        public void Dispose()
        {
            Stop();
        }
    }

    #endregion

    #region Main Program

    class Program
    {
        private static UsbController? _usbController;
        private static ProcessMonitor? _processMonitor;
        private static RecordingDetector? _recordingDetector;
        private static IpcServer? _ipcServer;

        static async Task Main(string[] args)
        {
            Console.WriteLine("========================================");
            Console.WriteLine("  DLP Security Monitor - Sidecar v1.0");
            Console.WriteLine("========================================");
            Console.WriteLine();

            // Initialize components
            _usbController = new UsbController();
            _processMonitor = new ProcessMonitor();
            _recordingDetector = new RecordingDetector();
            _ipcServer = new IpcServer();

            // Wire up events
            _usbController.UsbDeviceArrived += OnSecurityEvent;
            _usbController.UsbDeviceRemoved += OnSecurityEvent;
            _processMonitor.SuspiciousProcessDetected += OnSecurityEvent;
            _recordingDetector.RecordingDetected += OnSecurityEvent;
            _ipcServer.CommandReceived += OnCommandReceived;

            // Start monitoring
            _ipcServer.Start();
            _usbController.StartMonitoring();
            _processMonitor.StartMonitoring(3000);
            _recordingDetector.StartMonitoring(2000);

            Console.WriteLine();
            Console.WriteLine("[Main] All monitors started. Press Ctrl+C to stop.");
            Console.WriteLine();

            // Keep running
            var cts = new CancellationTokenSource();
            Console.CancelKeyPress += (_, e) =>
            {
                e.Cancel = true;
                Console.WriteLine("\n[Main] Shutting down...");
                Shutdown();
                cts.Cancel();
            };

            try
            {
                await Task.Delay(Timeout.Infinite, cts.Token);
            }
            catch (TaskCanceledException)
            {
            }
        }

        private static void OnSecurityEvent(object? sender, SecurityEvent evt)
        {
            Console.WriteLine($"[EVENT] {evt.EventType} - {evt.Severity}");

            // Send to Electron via IPC
            _ipcServer?.SendEvent(evt);

            // Also output to stdout for external capture
            var json = JsonSerializer.Serialize(evt);
            Console.WriteLine($"[EVENT_JSON] {json}");
        }

        private static void OnCommandReceived(object? sender, CommandMessage cmd)
        {
            Console.WriteLine($"[COMMAND] {cmd.Command} - Target: {cmd.Target}");

            switch (cmd.Command)
            {
                case "BLOCK_USB":
                    _usbController?.SetUsbStorageEnabled(false);
                    break;

                case "ENABLE_USB":
                    _usbController?.SetUsbStorageEnabled(true);
                    break;

                case "KILL_PROCESS":
                    if (!string.IsNullOrEmpty(cmd.Target))
                    {
                        KillProcess(cmd.Target);
                    }
                    break;

                default:
                    Console.WriteLine($"[COMMAND] Unknown command: {cmd.Command}");
                    break;
            }
        }

        private static void KillProcess(string processName)
        {
            try
            {
                var processes = Process.GetProcessesByName(
                    processName.Replace(".exe", ""));

                foreach (var proc in processes)
                {
                    proc.Kill();
                    Console.WriteLine($"[KILL] Terminated: {proc.ProcessName}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[KILL] Error: {ex.Message}");
            }
        }

        private static void Shutdown()
        {
            Console.WriteLine("[Main] Cleaning up...");

            _usbController?.Dispose();
            _processMonitor?.StopMonitoring();
            _recordingDetector?.StopMonitoring();
            _ipcServer?.Dispose();

            Console.WriteLine("[Main] Done.");
        }
    }

    #endregion
}
