import { describe, expect, it } from "vitest";
import { describeUserAgent } from "./user-agent";

const UA = {
  chromeWin:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  edgeWin:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
  yandex:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 YaBrowser/24.4.0.0 Safari/537.36",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
  firefoxMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:129.0) Gecko/20100101 Firefox/129.0",
};

describe("describeUserAgent", () => {
  it("tells Chrome from the browsers built on it", () => {
    expect(describeUserAgent(UA.chromeWin)).toEqual({ browser: "Chrome", os: "Windows", mobile: false });
    expect(describeUserAgent(UA.edgeWin).browser).toBe("Edge");
    expect(describeUserAgent(UA.yandex).browser).toBe("Yandex Browser");
  });

  it("recognises phones", () => {
    expect(describeUserAgent(UA.safariIphone)).toEqual({ browser: "Safari", os: "iPhone", mobile: true });
    expect(describeUserAgent(UA.chromeAndroid)).toEqual({ browser: "Chrome", os: "Android", mobile: true });
  });

  it("handles macOS Firefox and a missing header", () => {
    expect(describeUserAgent(UA.firefoxMac)).toEqual({ browser: "Firefox", os: "macOS", mobile: false });
    expect(describeUserAgent(null)).toEqual({ browser: "Noma'lum", os: "Noma'lum tizim", mobile: false });
  });
});
