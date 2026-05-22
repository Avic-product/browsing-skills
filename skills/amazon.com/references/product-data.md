# Amazon.com — Product Data Reference

## Requirements

**Browser:** Strongly recommended. Product pages vary by account, region, delivery address, experiments, and bot checks.

**Login / location:** Optional for public details, but delivery promises, grocery availability, Subscribe & Save, local-market pricing, and add-to-cart eligibility may require a signed-in session with a selected address.

**Safety:** This action only reads the product page. It does not click Add to Cart, Buy Now, Subscribe, coupon clips, variations, or checkout controls.

## How to run this action

Once the product page is loaded, execute via `page.evaluate()` (Playwright) or POST to the chrome-bridge `/run-action` endpoint:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: product-data

Use when the user wants details from a specific Amazon product page.

**Navigate to:** `https://www.amazon.com/dp/<ASIN>` or any Amazon product detail URL.

**Code:**

```js
({
  name: "amazon-product-data",
  description: "Extract visible product detail data from an Amazon product page",
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

    function elementText(el) {
      if (!el) return "";
      var clone = el.cloneNode(true);
      var noisy = clone.querySelectorAll("script, style, noscript");
      for (var i = 0; i < noisy.length; i++) noisy[i].parentNode.removeChild(noisy[i]);
      return clean(clone.textContent || clone.getAttribute("aria-label"));
    }

    function textOf(selector, root) {
      var el = (root || document).querySelector(selector);
      return elementText(el);
    }

    function allText(selector, root, limit) {
      var out = [];
      var els = (root || document).querySelectorAll(selector);
      for (var i = 0; i < els.length && (!limit || out.length < limit); i++) {
        var t = clean(els[i].textContent || els[i].getAttribute("aria-label"));
        if (t && out.indexOf(t) === -1) out.push(t);
      }
      return out;
    }

    function asinFromPage() {
      var m = window.location.href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
      if (m) return m[1].toUpperCase();
      var inputs = document.querySelectorAll('input[name="ASIN"], input#ASIN');
      for (var i = 0; i < inputs.length; i++) {
        var v = inputs[i].value || inputs[i].getAttribute("value") || "";
        if (/^[A-Z0-9]{10}$/i.test(v)) return v.toUpperCase();
      }
      return "";
    }

    function priceFrom(root) {
      var selectors = [
        "#corePrice_feature_div .a-price .a-offscreen",
        "#apex_desktop .a-price .a-offscreen",
        "#priceblock_ourprice",
        "#priceblock_dealprice",
        "#price_inside_buybox",
        ".apexPriceToPay .a-offscreen",
        ".a-price .a-offscreen"
      ];
      for (var i = 0; i < selectors.length; i++) {
        var t = textOf(selectors[i], root);
        if (t) return t;
      }
      return "";
    }

    function ratingFromPage() {
      var raw = textOf("#averageCustomerReviews .a-icon-alt") || textOf("#acrPopover");
      var match = raw.match(/([0-9.]+)\s+out of 5/i);
      return match ? match[1] + " out of 5 stars" : raw;
    }

    function imageUrls() {
      var out = [];
      var imgs = document.querySelectorAll("#altImages img, #imgTagWrapperId img, img[data-old-hires], img.a-dynamic-image");
      for (var i = 0; i < imgs.length; i++) {
        var src = imgs[i].getAttribute("data-old-hires") || imgs[i].currentSrc || imgs[i].src || imgs[i].getAttribute("data-src") || "";
        if (src && out.indexOf(src) === -1 && !/grey-pixel|transparent-pixel/.test(src)) out.push(src);
      }
      return out.slice(0, 12);
    }

    function variantData() {
      var out = [];
      var rows = document.querySelectorAll("#twister .a-row, #twister-plus-inline-twister .a-row, [id^='variation_']");
      for (var i = 0; i < rows.length; i++) {
        var label = clean((rows[i].querySelector(".a-form-label, .a-color-secondary") || {}).textContent || "");
        var selected = clean((rows[i].querySelector(".selection, .a-color-base") || {}).textContent || "");
        var options = allText("li, option, button, .swatch-title-text-display", rows[i], 20);
        if (label || selected || options.length) {
          out.push({ label: label, selected: selected, options: options });
        }
      }
      return out.slice(0, 12);
    }

    var bodyText = document.body ? document.body.textContent || "" : "";
    var buyBox = document.querySelector("#buybox, #rightCol, #desktop_buybox") || document;
    var addToCart = document.querySelector("#add-to-cart-button, input[name='submit.add-to-cart']");
    var buyNow = document.querySelector("#buy-now-button, input[name='submit.buy-now']");
    var deliveryTexts = allText("#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE, #mir-layout-DELIVERY_BLOCK, #deliveryBlockMessage, [data-csa-c-content-id*='delivery'], #contextualIngressPtLabel_deliveryShortLine", buyBox, 8);

    var data = {
      url: window.location.href.split("#")[0],
      asin: asinFromPage(),
      title: textOf("#productTitle") || textOf("#title") || document.title,
      brand: textOf("#bylineInfo") || textOf("#brand"),
      price: priceFrom(document),
      unitPrice: textOf("#corePrice_feature_div .a-size-base.a-color-secondary") || "",
      availability: textOf("#availability") || textOf("#outOfStock") || "",
      seller: textOf("#merchant-info") || textOf("[offer-display-feature-name='desktop-merchant-info']"),
      sellerName: textOf("[offer-display-feature-name='desktop-merchant-info'] .offer-display-feature-text-message") || textOf("#merchant-info a") || textOf("#merchant-info"),
      shipsFrom: textOf("[offer-display-feature-name='desktop-fulfiller-info']"),
      rating: ratingFromPage(),
      reviewCount: textOf("#acrCustomerReviewText"),
      boughtRecently: (clean(bodyText).match(/[0-9K,.+]+\s+bought\s+in\s+past\s+(?:month|week)/i) || [""])[0],
      bullets: allText("#feature-bullets li span.a-list-item, #featurebullets_feature_div li span.a-list-item", document, 20),
      productDescription: textOf("#productDescription") || textOf("#aplus"),
      delivery: deliveryTexts,
      variations: variantData(),
      images: imageUrls(),
      addToCartAvailable: !!(addToCart && !addToCart.disabled),
      buyNowVisible: !!buyNow,
      subscribeAndSaveVisible: /Subscribe\s*&\s*Save|Subscribe & Save/i.test(bodyText),
      couponVisible: /coupon|Apply coupon|Clip Coupon/i.test(bodyText),
      warnings: []
    };

    if (/captcha|enter the characters you see below|robot check/i.test(bodyText)) data.warnings.push("Amazon appears to be showing a bot check or CAPTCHA page.");
    if (/currently unavailable|out of stock/i.test(data.availability)) data.warnings.push("The visible availability text says the product may not be purchasable.");

    if (mode === "display") {
      var h = '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#111;padding:20px;max-width:820px;margin:0 auto;">';
      h += '<h2 style="font-size:20px;margin:0 0 8px;">' + (data.title || "Amazon product") + '</h2>';
      h += '<div style="font-weight:700;margin-bottom:6px;">' + (data.price || "") + '</div>';
      h += '<div style="color:#555;margin-bottom:10px;">' + [data.brand, data.availability, data.seller, data.rating, data.reviewCount].filter(Boolean).join(" · ") + '</div>';
      if (data.images[0]) h += '<img src="' + data.images[0] + '" style="max-width:180px;max-height:180px;object-fit:contain;float:right;margin:0 0 12px 12px;">';
      if (data.bullets.length) h += '<ul><li>' + data.bullets.slice(0, 8).join('</li><li>') + '</li></ul>';
      if (data.warnings.length) h += '<p style="color:#8a5200;">' + data.warnings.join(" ") + '</p>';
      h += '</div>';
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, asin, title, brand, price, unitPrice, availability, seller, sellerName, shipsFrom, rating, reviewCount, boughtRecently, bullets, productDescription, delivery, variations, images, addToCartAvailable, buyNowVisible, subscribeAndSaveVisible, couponVisible, warnings }`

## Benchmark

- **With skill:** 12,321 API tokens (12,122 prompt, 199 completion), 3 API calls, 2 browser calls, ~9.6s total on `https://www.amazon.com/dp/B0C43R8SRB` using Chrome Bridge, captured at `2026-05-20T05:59:09.827Z`. Returned ASIN, title, price, availability, seller field, rating, review count, 8 bullets, 12 images, Add to Cart state, and Buy Now visibility.
- **Without skill:** 8,673 API tokens (7,186 prompt, 1,487 completion), 4 API calls, 4 browser inspection/eval calls, ~19.6s total on the same product page and Chrome profile. Returned ASIN, title, brand, price, availability, seller, rating, review count, 8 bullets, 8 images, and Add to Cart state, but missed Buy Now visibility and included locale/bot-text caveats.
- **Comparison:** Both paths extracted the core product data. The skill branch used fewer browser calls, ran faster, and returned richer image coverage plus Buy Now visibility; the no-skill path used fewer tokens on this stable page but produced a partial result under the benchmark rubric.
