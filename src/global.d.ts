// global.d.ts
type FbqCommand = "track" | "trackCustom";
type FbqEventName = "PageView" | "OutboundClick";

interface Window {
  fbq?: (
    command: FbqCommand,
    eventName: FbqEventName,
    params?: Record<string, unknown>
  ) => void;
}
