export function truncateAddress(value: string, chars = 4): string {
  if (!value || value.length <= chars * 2 + 3) {
    return value;
  }

  return `${value.slice(0, chars + 2)}...${value.slice(-chars)}`;
}

export function formatRelativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function explorerLink(baseUrl: string, hash: string, kind: "tx" | "address" = "tx"): string {
  return `${baseUrl}/${kind}/${hash}`;
}

export function copyToClipboard(value: string): Promise<void> {
  return navigator.clipboard.writeText(value);
}
