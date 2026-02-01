import { describe, it, expect } from "vitest";
import { parseTaskInput } from "@/lib/todo-utils";

describe("parseTaskInput 日期智能识别", () => {
  const expectDate = (iso: string | null | undefined, y: number, m: number, d: number) => {
    expect(iso).toBeTruthy();
    const date = new Date(iso!);
    expect(date.getFullYear()).toBe(y);
    expect(date.getMonth()).toBe(m - 1); // 0-indexed
    expect(date.getDate()).toBe(d);
  };

  it("支持 2026.2.7 点号格式", () => {
    const r = parseTaskInput("开会 2026.2.7");
    expect(r.title).toBe("开会");
    expectDate(r.due_date, 2026, 2, 7);
  });

  it("支持 2.7 月.日格式", () => {
    const r = parseTaskInput("出差 2.7");
    expect(r.title).toBe("出差");
    expect(r.due_date).toBeTruthy();
    const d = new Date(r.due_date!);
    expect(d.getMonth()).toBe(1); // Feb = 1
    expect(d.getDate()).toBe(7);
  });

  it("支持 2026年2月7日", () => {
    const r = parseTaskInput("汇报 2026年2月7日");
    expect(r.title).toBe("汇报");
    expectDate(r.due_date, 2026, 2, 7);
  });

  it("支持 2月7日", () => {
    const r = parseTaskInput("体检 2月7日");
    expect(r.title).toBe("体检");
    expect(r.due_date).toBeTruthy();
    const d = new Date(r.due_date!);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(7);
  });

  it("支持 2026-2-7", () => {
    const r = parseTaskInput("会议 2026-2-7");
    expect(r.title).toBe("会议");
    expectDate(r.due_date, 2026, 2, 7);
  });

  it("支持 2-7 月-日", () => {
    const r = parseTaskInput("约饭 2-7");
    expect(r.title).toBe("约饭");
    expect(r.due_date).toBeTruthy();
    const d = new Date(r.due_date!);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(7);
  });

  it("支持 2026/2/7", () => {
    const r = parseTaskInput("截止 2026/2/7");
    expect(r.title).toBe("截止");
    expectDate(r.due_date, 2026, 2, 7);
  });

  it("支持 2/7 月/日", () => {
    const r = parseTaskInput("交稿 2/7");
    expect(r.title).toBe("交稿");
    expect(r.due_date).toBeTruthy();
    const d = new Date(r.due_date!);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(7);
  });

  it("支持 2026.02.07 补零格式", () => {
    const r = parseTaskInput("上线 2026.02.07");
    expect(r.title).toBe("上线");
    expectDate(r.due_date, 2026, 2, 7);
  });

  it("2.7.1 等版本号不被误识别为 2.7 日期", () => {
    const r = parseTaskInput("发版 2.7.1");
    expect(r.title).toBe("发版 2.7.1");
    expect(r.due_date).toBeNull();
  });
});
