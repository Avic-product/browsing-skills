---
name: x-profile-data
description: "Extract profile data from an X (Twitter) user's profile page (URL is just https://x.com/<handle>, no /status, /search, or other sub-paths): display name, handle, verified status, bio, follower/following counts, join date, avatar, and website"
navigateTo: https://x.com/<handle>
auth:
  required: true
  hint: Requires auth_token session cookie from x.com
requiresBrowser: true
tags:
  - x
  - twitter
  - webmcp
  - extractor
returns: '{ displayName, handle, verified, url, bio, joinDate, following, followers, avatarUrl, website }'
---

# x-profile-data

Extract profile data from an X (Twitter) user page: display name, handle, verified status, bio, follower/following counts, join date, avatar, and website

## Returns

`{ displayName, handle, verified, url, bio, joinDate, following, followers, avatarUrl, website }`

## Code

```js
({
  name: "x-profile-data",
  description: "Extract profile data from an X user page",
  inputSchema: { type: "object", properties: { mode: { type: "string", enum: ["data", "display"] } } },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var data = {};
    var nameEl = document.querySelector("[data-testid=UserName]");
    if (nameEl) {
      var nameSpan = nameEl.querySelector("span");
      data.displayName = nameSpan ? nameSpan.textContent.trim() : "";
      var spans = nameEl.querySelectorAll("span");
      for (var i = 0; i < spans.length; i++) { if (spans[i].textContent.startsWith("@")) { data.handle = spans[i].textContent.trim(); break; } }
    }
    data.verified = document.querySelector("[data-testid=UserName] [data-testid=icon-verified]") !== null;
    data.url = window.location.href.split("?")[0];
    var bio = document.querySelector("[data-testid=UserDescription]");
    data.bio = bio ? bio.textContent.trim() : "";
    var joinDate = document.querySelector("[data-testid=UserJoinDate]");
    data.joinDate = joinDate ? joinDate.textContent.trim().replace("Joined ", "") : "";
    var followLinks = document.querySelectorAll("a[href*=\"/verified_followers\"], a[href*=\"/following\"], a[href*=\"/followers\"]");
    for (var j = 0; j < followLinks.length; j++) {
      var href = followLinks[j].getAttribute("href");
      var text = followLinks[j].textContent.trim();
      if (href.includes("following")) data.following = text.replace(" Following", "");
      if (href.includes("followers") || href.includes("verified_followers")) data.followers = text.replace(" Followers", "");
    }
    var primaryCol = document.querySelector("[data-testid=primaryColumn]");
    if (primaryCol) {
      var avatarImgs = primaryCol.querySelectorAll("img[src*=profile_images]");
      if (avatarImgs.length > 0) data.avatarUrl = avatarImgs[0].src.replace(/_bigger|_normal|_x96|_200x200|_400x400/g, "");
    }
    var headerItems = document.querySelector("[data-testid=UserProfileHeader_Items]");
    if (headerItems) {
      var headerLinks = headerItems.querySelectorAll("a[href]");
      for (var k = 0; k < headerLinks.length; k++) {
        var lhref = headerLinks[k].getAttribute("href");
        if (lhref && !lhref.includes("x.com") && !lhref.includes("twitter.com")) data.website = headerLinks[k].textContent.trim();
      }
    }
    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:600px;margin:0 auto;border-radius:12px;\">";
      h += "<div style=\"display:flex;align-items:center;gap:16px;margin-bottom:16px;\">";
      if (data.avatarUrl) h += "<img src=\"" + data.avatarUrl + "\" style=\"width:64px;height:64px;border-radius:50%;\">";
      h += "<div><div style=\"font-weight:600;font-size:20px;\">" + (data.displayName||"") + (data.verified?" \u2713":"") + "</div>";
      h += "<div style=\"color:#888;\">" + (data.handle||"") + "</div></div></div>";
      if (data.bio) h += "<div style=\"margin-bottom:16px;\">" + data.bio + "</div>";
      h += "<div style=\"display:flex;gap:20px;margin-bottom:12px;\"><span><strong>" + (data.following||"0") + "</strong> Following</span><span><strong>" + (data.followers||"0") + "</strong> Followers</span></div>";
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})

```
