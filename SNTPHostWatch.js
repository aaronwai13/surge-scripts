// 守候配置 [Host] 變更監察（Surge cron 腳本）
//
// 定時下載守候官網嘅 Surge 完整配置，比較入面 [Host] 嘅私有 DoH 設定。
// 第一次執行會記錄目前內容並發通知；之後一有改變就發通知，提你同步自己嘅配置。
//
// 用法（寫入 Surge 配置）：
// [Script]
// SNTP-HostWatch = type=cron,cronexp="0 */6 * * *",wake-system=1,timeout=30,script-path=https://raw.githubusercontent.com/aaronwai13/surge-scripts/main/SNTPHostWatch.js,argument="守候 Surge 完整配置連結"
//
// 只向你填嘅連結發出請求，唔會上傳或者記錄連結。
(function () {
  var KEY = "sntp_host_watch_v1";
  var TITLE = "守候配置監察";
  var url = typeof $argument === "string" ? $argument.trim() : "";

  function notify(subtitle, body) {
    $notification.post(TITLE, subtitle, body || "");
  }

  if (!/^https?:\/\/\S+$/i.test(url)) {
    notify("未設定連結", "請喺腳本 argument 填守候官網嘅 Surge 完整配置連結。");
    $done();
    return;
  }

  var build =
    typeof $environment !== "undefined" && $environment && $environment["surge-build"]
      ? $environment["surge-build"]
      : "3000";
  var ua = "Surge iOS/" + build;

  // 抽出 [Host] 區段內守候嘅設定（優先取 BEGIN / END 標記之間嘅內容）
  function extractHost(body) {
    var lines = String(body).split(/\r?\n/);
    var inHost = false;
    var all = [];
    var marked = [];
    var inMarked = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (/^\[.+\]$/.test(line)) {
        inHost = line.toLowerCase() === "[host]";
        continue;
      }
      if (!inHost) continue;
      if (/^#\s*BEGIN SNTP DOH HOSTS/i.test(line)) {
        inMarked = true;
        continue;
      }
      if (/^#\s*END SNTP DOH HOSTS/i.test(line)) {
        inMarked = false;
        continue;
      }
      if (!line || line.charAt(0) === "#" || line.indexOf("//") === 0) continue;
      all.push(line);
      if (inMarked) marked.push(line);
    }
    return (marked.length ? marked : all).join("\n");
  }

  function read() {
    try {
      return $persistentStore.read(KEY);
    } catch (e) {
      return null;
    }
  }

  function save(value) {
    try {
      $persistentStore.write(value, KEY);
    } catch (e) {}
  }

  $httpClient.get(
    { url: url, headers: { "User-Agent": ua }, timeout: 20 },
    function (error, response, body) {
      var status = response ? Number(response.status || response.statusCode) : 0;
      if (error || status < 200 || status >= 300 || !body) {
        console.log("守候配置下載失敗，HTTP " + (status || "無回應"));
        $done();
        return;
      }
      if (!/\[(General|Proxy)\]/i.test(body)) {
        console.log("回應唔似 Surge 配置，略過今次檢查");
        $done();
        return;
      }

      var current = extractHost(body);
      var shown = current || "（官方配置已冇 [Host]）";
      var previous = read();

      if (previous === null || previous === undefined) {
        save(current);
        notify("已開始監察", "目前官方 [Host]：\n" + shown + "\n\n請確認同你自己配置嘅 [Host] 一樣。");
      } else if (previous !== current) {
        save(current);
        notify(
          "[Host] 有變，要同步你嘅配置",
          "新內容：\n" + shown + "\n\n可以打開 Lite Connect 託管配置複製最尾 [Host]，取代你自己配置嗰段。"
        );
      } else {
        console.log("守候 [Host] 冇變");
      }
      $done();
    }
  );
})();
