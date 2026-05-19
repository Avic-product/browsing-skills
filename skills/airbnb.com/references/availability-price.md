# Airbnb — Availability Price Reference

## Requirements

**Browser:** Required. The booking card and price breakdown render client-side.

**Login:** Not required for most public listings. Some taxes, discounts, or region-specific fees may differ by logged-in account, location, currency, or experiment.

**Page state:** Navigate with `check_in`, `check_out`, and guest parameters when possible. If the listing shows an unavailable message or asks for dates, use the date picker in the UI before running this action.

## How to run this action

Once the listing page is loaded with dates selected, execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/run-action` endpoint:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: availability-price

Use when the user wants to check selected-date availability and visible price breakdown for a specific Airbnb stay.

**Navigate to:** `https://www.airbnb.com/rooms/<listing-id>?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD&adults=N&children=N&infants=N&pets=N`

**Code:**

```js
({
  name: "airbnb-availability-price",
  description: "Extract visible availability and price breakdown from an Airbnb listing booking card",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"], description: "Output mode. data returns JSON. display returns self-contained HTML." }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";

    function clean(text) {
      return (text || "").replace(/\s+/g, " ").trim();
    }

    function moneyLines(text) {
      var chunks = (text || "").split(/\n+/);
      var out = [];
      for (var i = 0; i < chunks.length; i++) {
        var item = clean(chunks[i]);
        if (item && /(?:[$€£]|CA\$|A\$|USD|EUR|GBP)\s?[0-9]/.test(item) && out.indexOf(item) === -1) out.push(item);
      }
      return out;
    }

    function findBookingRoot() {
      var buttons = document.querySelectorAll("button, a");
      for (var i = 0; i < buttons.length; i++) {
        var text = clean(buttons[i].textContent || buttons[i].getAttribute("aria-label"));
        if (/\b(Reserve|Check availability|Request to book)\b/i.test(text)) {
          var node = buttons[i];
          for (var depth = 0; depth < 8 && node.parentElement; depth++) {
            if (clean(node.textContent).length > 80 && /(?:[$€£]|CA\$|A\$|USD|EUR|GBP)|Reserve|availability/i.test(node.textContent)) return node;
            node = node.parentElement;
          }
        }
      }
      return document.querySelector("main") || document.body;
    }

    var urlParams = new URLSearchParams(window.location.search);
    var root = findBookingRoot();
    var text = root.innerText || root.textContent || "";
    var allText = clean((document.querySelector("main") || document.body).textContent);
    var unavailable = /\b(unavailable|not available|sold out|no longer available|try different dates)\b/i.test(text) || /\b(unavailable|not available|sold out|try different dates)\b/i.test(allText);
    var available = !unavailable && /\b(Reserve|Request to book|Check availability)\b/i.test(text);

    var data = {
      url: window.location.href.split("#")[0],
      listingId: (window.location.href.match(/\/rooms\/(\d+)/) || [])[1] || "",
      checkIn: urlParams.get("check_in") || urlParams.get("checkin") || "",
      checkOut: urlParams.get("check_out") || urlParams.get("checkout") || "",
      adults: urlParams.get("adults") || "",
      children: urlParams.get("children") || "",
      infants: urlParams.get("infants") || "",
      pets: urlParams.get("pets") || "",
      available: available,
      unavailableReason: unavailable ? "The visible page text indicates this stay is unavailable for the selected dates or parameters." : "",
      nightlyPrice: "",
      priceBreakdown: [],
      total: "",
      callToAction: "",
      rawBookingCardText: clean(text)
    };

    var buttons = root.querySelectorAll("button, a");
    for (var b = 0; b < buttons.length; b++) {
      var buttonText = clean(buttons[b].textContent || buttons[b].getAttribute("aria-label"));
      if (/\b(Reserve|Check availability|Request to book)\b/i.test(buttonText)) {
        data.callToAction = buttonText;
        break;
      }
    }
    if (!data.callToAction && buttons.length) data.callToAction = clean(buttons[0].textContent || buttons[0].getAttribute("aria-label"));

    var lines = moneyLines(text);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!data.nightlyPrice && /\bnight\b/i.test(line)) data.nightlyPrice = line;
      if (/total/i.test(line)) data.total = line;
      data.priceBreakdown.push(line);
    }
    if (!data.total && data.priceBreakdown.length) data.total = data.priceBreakdown[data.priceBreakdown.length - 1];
    if (!data.nightlyPrice && data.priceBreakdown.length) data.nightlyPrice = data.priceBreakdown[0];

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#222;padding:22px;max-width:720px;margin:0 auto;'>";
      h += "<h2 style='margin:0 0 12px;font-size:22px;'>Airbnb availability and price</h2>";
      h += "<div style='font-weight:700;margin-bottom:8px;'>" + (data.available ? "Available or bookable UI visible" : "Unavailable or unclear") + "</div>";
      h += "<div style='color:#555;margin-bottom:12px;'>" + [data.checkIn, data.checkOut].filter(Boolean).join(" to ") + "</div>";
      if (data.nightlyPrice) h += "<div>Nightly price: " + data.nightlyPrice + "</div>";
      if (data.total) h += "<div style='font-weight:700;margin:6px 0;'>Total: " + data.total + "</div>";
      if (data.priceBreakdown.length) h += "<ul><li>" + data.priceBreakdown.join("</li><li>") + "</li></ul>";
      if (data.unavailableReason) h += "<div style='color:#b00020;'>" + data.unavailableReason + "</div>";
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, listingId, checkIn, checkOut, adults, children, infants, pets, available, unavailableReason, nightlyPrice, priceBreakdown, total, callToAction, rawBookingCardText }`

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `airbnb.com` `availability-price`.

