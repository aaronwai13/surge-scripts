/*
 * Surge 机场流量面板（generic 脚本）
 *
 * 读取订阅回应头 Subscription-Userinfo，显示已用 / 总量、使用比例、到期日。
 * 使用 Clash 的 User-Agent，因为部分机场只会对 Clash 客户端返回流量信息。
 *
 * 用法（写入 Surge 配置）：
 * [Panel]
 * 机场名 = script-name=机场名-Usage, update-interval=1800
 * [Script]
 * 机场名-Usage = type=generic,timeout=15,script-path=https://raw.githubusercontent.com/aaronwai13/surge-scripts/main/AirportUsage.js,argument="完整原始订阅链接"
 *
 * 不会记录或上传订阅链接，只向订阅链接本身发出请求。
 */
(function () {
  var UA = "clash.meta/v1.19.23";
  var url = typeof $argument === "string" ? $argument.trim() : "";
  var name =
    typeof $input !== "undefined" && $input && $input.panelName
      ? String($input.panelName)
      : "机场流量";
  var finished = false;

  function finish(title, content, color) {
    if (finished) return;
    finished = true;
    $done({
      title: title,
      content: content,
      icon: "arrow.up.arrow.down.circle.fill",
      "icon-color": color || "#007AFF"
    });
  }

  function fail(message) {
    finish(name, message, "#FF9500");
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatDate(ms) {
    var d = new Date(ms);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function formatTime(d) {
    return formatDate(d.getTime()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function formatBytes(n) {
    if (!isFinite(n) || n < 0) return "未知";
    var units = ["B", "KB", "MB", "GB", "TB", "PB"];
    var i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return (i === 0 ? n.toFixed(0) : n.toFixed(2)) + " " + units[i];
  }

  function getHeader(headers, key) {
    if (!headers) return null;
    for (var k in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, k) && k.toLowerCase() === key) {
        return headers[k];
      }
    }
    return null;
  }

  function parseUserinfo(value) {
    if (!value) return null;
    var info = {};
    String(value)
      .split(";")
      .forEach(function (part) {
        var idx = part.indexOf("=");
        if (idx < 0) return;
        var k = part.slice(0, idx).trim().toLowerCase();
        var v = Number(part.slice(idx + 1).trim());
        if (k && isFinite(v)) info[k] = v;
      });
    if (!isFinite(info.total)) return null;
    return info;
  }

  function progressBar(ratio) {
    var size = 10;
    var filled = Math.round(ratio * size);
    if (ratio > 0 && filled === 0) filled = 1;
    var out = "";
    for (var i = 0; i < size; i++) out += i < filled ? "■" : "□";
    return out;
  }

  function render(info) {
    var used = (info.upload || 0) + (info.download || 0);
    var total = info.total;
    var ratio = total > 0 ? Math.min(used / total, 1) : 0;
    var percent = (ratio * 100).toFixed(1) + "%";

    var color = "#34C759";
    var status = "余量充足";
    if (ratio >= 0.9) {
      color = "#FF3B30";
      status = "即将用完";
    } else if (ratio >= 0.7) {
      color = "#FF9500";
      status = "注意用量";
    }

    var lines = [
      "已用 " + formatBytes(used) + " / 总量 " + formatBytes(total),
      progressBar(ratio) + " " + percent
    ];

    if (info.expire && info.expire > 0) {
      var expireMs = info.expire < 1e12 ? info.expire * 1000 : info.expire;
      var days = Math.ceil((expireMs - Date.now()) / 86400000);
      lines.push(
        "到期 " + formatDate(expireMs) + (days >= 0 ? " · 剩余 " + days + " 天" : " · 已过期")
      );
      if (days >= 0 && days <= 7 && ratio < 0.9) {
        color = "#FF9500";
        status = "即将到期";
      }
      if (days < 0) {
        color = "#FF3B30";
        status = "已过期";
      }
    } else {
      lines.push("到期 长期有效或未提供");
    }

    lines.push("更新 " + formatTime(new Date()));
    finish(name + " · " + status, lines.join("\n"), color);
  }

  function request(method) {
    $httpClient[method](
      { url: url, headers: { "User-Agent": UA }, timeout: 8 },
      function (error, response) {
        if (finished) return;
        var status = response ? Number(response.status || response.statusCode) : 0;
        var info =
          !error && status >= 200 && status < 300
            ? parseUserinfo(getHeader(response.headers, "subscription-userinfo"))
            : null;
        if (info) {
          render(info);
          return;
        }
        // 部分机场不支持 HEAD，或只在 GET 回应中提供流量信息
        if (method === "head") {
          request("get");
          return;
        }
        if (error || !status) fail("网络连接失败，请稍后刷新。");
        else if (status < 200 || status >= 300) fail("订阅服务器返回 HTTP " + status + "。");
        else fail("机场未提供流量信息（Subscription-Userinfo）。");
      }
    );
  }

  if (!/^https?:\/\/\S+$/i.test(url)) {
    fail("请在 argument 填写完整的原始订阅链接。");
    return;
  }
  request("head");
})();
