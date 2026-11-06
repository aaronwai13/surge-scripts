# surge-scripts

自用 Surge 腳本。

## AirportUsage.js

機場流量面板：讀取訂閱回應頭 `Subscription-Userinfo`，喺 Surge 首頁顯示已用／總量、使用比例同到期日。
使用 Clash 嘅 User-Agent，因為部分機場只會對 Clash 客戶端返回流量資料。

```ini
[Panel]
機場名 = script-name=機場名-Usage, update-interval=1800

[Script]
機場名-Usage = type=generic,timeout=15,script-path=https://raw.githubusercontent.com/aaronwai13/surge-scripts/main/AirportUsage.js,argument="完整原始訂閱連結"
```

訂閱連結只填喺自己嘅 Surge 配置入面，唔好寫入呢個 repo。

## SNTPHostWatch.js

守候（SNTP）配置監察：定時下載守候官網嘅 Surge 完整配置，比較 `[Host]` 入面嘅私有 DoH 設定。
第一次執行會記錄目前內容並發通知；之後一有改變就發通知，提你同步自己嘅配置。

```ini
[Script]
SNTP-HostWatch = type=cron,cronexp="0 */6 * * *",wake-system=1,timeout=30,script-path=https://raw.githubusercontent.com/aaronwai13/surge-scripts/main/SNTPHostWatch.js,argument="守候 Surge 完整配置連結"
```
