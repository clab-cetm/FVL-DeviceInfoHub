# FVL-DeviceInfoHub
- Create by clab-rdpd-s9 (Snow@FVL)
- 以2026《身後的中原》合作案為基礎，嘗試開發通用控台系統
- 分為後端Backend與前端Frontend

## Backend 後端功能
- 詳細功能請看Backend/Spec.md
- 設備資訊透過OSC傳到Server，依照預先定義的資料格式儲存在不同的資料庫中；前端可使用HTTP Get取得設備資訊
- Server/DeviceInfoHub.exe為最新執行檔備份，若有更新原始碼，請一併建置更新
- 建置：安裝Go開發環境後在Server資料夾cmd -> go build . 即可建置

## Frontend 前端功能
- 詳細功能請看Frontend/Spec.md
- 此版本為通用用途，而《身後的中原》控台功能有較多客製化的部分（與Unreal Plugin對接、串流頭盔畫面）因此預計以此版本為基礎發展，而不納入版控中
- Requester每隔指定的時間載入指定資料庫的資訊
- Device Panel紀錄現在有哪些設備，以及最後更新設備資訊的時間
- Environment Model可匯入場地模型以觀看設備在場地中的位置
