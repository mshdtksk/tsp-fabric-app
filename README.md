# Tsp App (Microsoft Fabric App)

住所を保存し、地図クリックで地点追加し、巡回路（TSPに近い round trip）を算出して表示する Fabric App です。

<img width="1580" height="866" alt="スクリーンショット 2026-06-15 005044" src="https://github.com/user-attachments/assets/7df37152-6732-4273-af5d-7af50ca77017" />



## 1. 事前条件

1. Microsoft Fabric ワークスペース（対応リージョン）
2. Fabric/Power BI ライセンス
3. Fabric 管理ポータルで Fabric App 項目が有効
4. Node.js 20+ / npm
5. Rayfin CLI（`npx rayfin ...` で実行可能）

## 2. VS Code 前提の前工程（Git clone から開始）

1. GitHub から clone

```bash
git clone https://github.com/mshdtksk/tsp-fabric-app
cd tsp-fabric-app
```

2. VS Code で開く

```bash
code .
```

3. VS Code のターミナルを開く

- メニュー: **Terminal > New Terminal**
- 以降のコマンドはこのターミナルで実行

## 3. 初期セットアップ

```bash
npm install
npx rayfin login --encryption-fallback-enabled
```

## 4. アプリ識別子/表示名

このプロジェクトは以下設定で配布しています（`rayfin/rayfin.yml`）:

```yml
id: my-tsp-fabric-app
name: Tsp App
```

- `id`: デプロイ識別子（環境ごとに重複しない値を推奨）
- `name`: Fabric ポータル上の表示名

## 5. ローカル開発

```bash
npm run dev
```

- ブラウザで `http://localhost:5173` を開く
- 地図クリックで地点追加、または住所テキスト入力で追加
- 「巡回路を計算」で round trip を表示

## 6. Fabric へデプロイ

初回または再構築時は、以前のデプロイ状態を消してから実行してください。

```bash
# 旧デプロイ状態をクリア（任意だが推奨）
rm -f rayfin/.deployments.json

# DB スキーマ反映
npx rayfin up db apply

# 本番デプロイ
npx rayfin up --workspace-id <YOUR_WORKSPACE_GUID> --yes

# 状態確認
npx rayfin up status
```

PowerShell の場合:

```powershell
Remove-Item .\rayfin\.deployments.json -ErrorAction SilentlyContinue
```

## 7. GitHub 公開時の注意

1. `rayfin/.env*`、`rayfin/.deployments.json`、`.env.local` はコミットしない
2. `rayfin/rayfin.yml` の `allowedRedirectUris` に他人のデプロイ URL は入れない
3. README の手順どおりに、利用者自身の workspace で `rayfin up` してもらう

## 8. 主なコマンド

| Command | Description |
|---|---|
| `npm run dev` | Fabric 連携でローカル起動 |
| `npm run rayfin:db` | DB スキーマ反映 (`rayfin up db apply`) |
| `npm run build` | 本番ビルド |
| `npm run test` | テスト実行 |
| `npm run lint` | ESLint 実行 |
