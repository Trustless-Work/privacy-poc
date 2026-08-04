/** Scrollable timestamped log output, shared by the wallet and advanced-mode pages. */
export function LogPanel({ logs }: { logs: string[] }) {
  if (logs.length === 0) return null;
  return (
    <pre className="nb-log mt-6 max-h-56 overflow-auto p-4 text-xs">
      {logs.join("\n")}
    </pre>
  );
}
