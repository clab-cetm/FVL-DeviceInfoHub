# FVL-DeviceInfoHub
- Create by clab-rdpd-s9 (Snow@FVL)
- 2026《身後的中原》合作案
- 嘗試將控台後端功能中可重複使用的部分整合成這個Server

## 功能簡述
- 設備資訊透過OSC傳到Server，依照預先定義的資料格式儲存在不同的資料庫中
- 控台前端使用HTTP Get取得設備資訊
- 詳細功能請看Spec.md

## 檔案資訊
- Server/DeviceInfoHub.exe為最新執行檔備份，若有更新原始碼，請一併建置更新
- 建置：安裝Go開發環境後在Server資料夾cmd -> go build . 即可建置

