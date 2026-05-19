# Booking.com — Book Room Reference

## Requirements

**Browser:** Required for every action. Booking serves bot-challenge pages to plain `fetch` requests (you'll see `?chal_t=` appended to URLs). Use Playwright, a built-in Chromium integration, or the [Chrome Bridge](https://github.com/tomer-van-cohen/browsing-skills/tree/main/chrome-bridge) companion (which runs scripts in the user's already-open Chrome session — no challenge to solve).

**Login:** Optional. Logged-in sessions get personalized prices, Genius discounts, and saved preferences. If the user wants logged-in pricing, ensure the bridge connects to a Chrome profile that's already signed in to booking.com — Booking's auth is cookie-based but the cookies are split across multiple HttpOnly entries, so a user-provided cookie injection isn't practical. The user's real Chrome session is the simplest path.

**Currency / language:** Booking auto-detects from IP and account settings. To force a currency, append `&selected_currency=EUR` (or USD, GBP, etc.) to any search/hotel URL.

## How to run this action

Once the right URL is loaded, execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/run-action` endpoint:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: book-room

Use when the user wants to start a reservation. **This action stops at the guest-details page** — it submits the room-selection form and returns once Booking has navigated to `secure.booking.com/book.html?stage=1`. **The user must complete guest details, payment, and any captcha themselves.** Do not attempt to fill in payment information programmatically.

**Navigate to:** the hotel's URL (same as `hotel-data`). Wait ~5 seconds for the room table to render.

**Code:**

```js
({
  name: "booking-book-room",
  description: "Submit a Booking.com room reservation up to the guest-details page. Stops before payment/captcha.",
  inputSchema: {
    type: "object",
    properties: {
      blockId: { type: "string", description: "Exact block ID like 937895101_419838496_2_2_0 (the row's data-hotel-rounded attribute, also the suffix of the nr_rooms_<blockId> select name). Preferred over roomName for unambiguous selection — multiple rate plans for the same room have the same name but different blockIds." },
      roomName: { type: "string", description: "Substring match against room name (e.g. \"Deluxe\"). First matching row wins. Use blockId for precise control." },
      quantity: { type: "integer", minimum: 1, default: 1, description: "Number of rooms. Must be <= the row's max available." }
    }
  },
  execute: function(params) {
    var p = params || {};
    var qty = p.quantity || 1;
    var form = document.querySelector("#hprt-form");
    if (!form) return { content: [{ type: "text", text: JSON.stringify({ error: "reservation form #hprt-form not found — are you on a hotel page with check-in/check-out dates set?" }) }] };
    var rows = form.querySelectorAll("#hprt-table tbody tr");
    var matched = null;
    var matchedRoom = "";
    var matchedBlockId = "";
    var currentName = "";
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var nameLink = row.querySelector(".hprt-roomtype-link, .hprt-roomtype-name");
      if (nameLink) currentName = nameLink.textContent.trim().replace(/\s+/g, " ");
      var blockId = row.getAttribute("data-hotel-rounded") || "";
      var sel = row.querySelector("select[name^=nr_rooms_]");
      if (!sel) continue;
      if (p.blockId) {
        if (blockId === p.blockId || sel.name === "nr_rooms_" + p.blockId) {
          matched = sel; matchedRoom = currentName; matchedBlockId = blockId; break;
        }
      } else if (p.roomName) {
        if (currentName.toLowerCase().indexOf(String(p.roomName).toLowerCase()) >= 0) {
          matched = sel; matchedRoom = currentName; matchedBlockId = blockId; break;
        }
      } else if (!matched) {
        matched = sel; matchedRoom = currentName; matchedBlockId = blockId;
      }
    }
    if (!matched) return { content: [{ type: "text", text: JSON.stringify({ error: "no matching room row", blockIdRequested: p.blockId, roomNameRequested: p.roomName }) }] };
    var maxQty = matched.options.length > 0 ? parseInt(matched.options[matched.options.length - 1].value, 10) : 0;
    if (parseInt(qty, 10) > maxQty) return { content: [{ type: "text", text: JSON.stringify({ error: "requested quantity " + qty + " exceeds max available " + maxQty + " for this row", room: matchedRoom, blockId: matchedBlockId }) }] };
    matched.value = String(qty);
    matched.dispatchEvent(new Event("change", { bubbles: true }));
    var btns = form.querySelectorAll("button");
    var reserveBtn = null;
    for (var k = 0; k < btns.length; k++) {
      if (/reserve/i.test(btns[k].textContent || "")) { reserveBtn = btns[k]; break; }
    }
    var result = {
      action: "submitted",
      selectedRoom: matchedRoom,
      selectedBlockId: matchedBlockId,
      selectedQuantity: qty,
      formAction: form.getAttribute("action"),
      stopsAt: "secure.booking.com/book.html?stage=1 (Your Details — guest info + payment)",
      handoffNote: "The page is navigating to the guest-details step. The user must finish: guest details, payment method, and any captcha. Do NOT attempt to fill in payment fields programmatically."
    };
    if (reserveBtn) reserveBtn.click(); else form.submit();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
})
```

**Returns:** `{ action: "submitted", selectedRoom, selectedBlockId, selectedQuantity, formAction, stopsAt, handoffNote }`. After ~5 seconds the page is at `secure.booking.com/book.html?stage=1`. Read `window.location.href` to confirm, then **hand control back to the user** — say something like "I've selected the room and started the reservation. Booking is now showing the guest-details page in your browser. Please fill in your details and payment to complete the booking."

---

## Reporting issues

If selectors break (Booking ships UI changes regularly), file an issue: https://github.com/tomer-van-cohen/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `booking.com` `book-room`.

