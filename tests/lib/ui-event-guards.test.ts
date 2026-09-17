import { describe, it, expect } from "vitest";
import { isSelectionSafeOverlayTarget } from "@/lib/ui-event-guards";

describe("isSelectionSafeOverlayTarget (issue009)", () => {
  it("null / 非 Element → 视为安全（忽略）", () => {
    expect(isSelectionSafeOverlayTarget(null)).toBe(true);
    expect(isSelectionSafeOverlayTarget(document.createTextNode("x"))).toBe(
      true
    );
  });

  it("普通节点 → 不安全（可取消选中）", () => {
    const el = document.createElement("div");
    expect(isSelectionSafeOverlayTarget(el)).toBe(false);
  });

  it("Dialog / Dock / Portal 内 → 安全", () => {
    const dock = document.createElement("div");
    dock.setAttribute("data-selection-dock", "");
    const btn = document.createElement("button");
    dock.appendChild(btn);
    document.body.appendChild(dock);
    expect(isSelectionSafeOverlayTarget(btn)).toBe(true);

    const dialog = document.createElement("div");
    dialog.setAttribute("data-slot", "dialog-content");
    const item = document.createElement("button");
    dialog.appendChild(item);
    document.body.appendChild(dialog);
    expect(isSelectionSafeOverlayTarget(item)).toBe(true);

    const portal = document.createElement("div");
    portal.setAttribute("data-slot", "dialog-portal");
    const nested = document.createElement("span");
    portal.appendChild(nested);
    document.body.appendChild(portal);
    expect(isSelectionSafeOverlayTarget(nested)).toBe(true);

    dock.remove();
    dialog.remove();
    portal.remove();
  });
});
