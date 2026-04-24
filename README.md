# literature-search-tool-lex

一個簡單的命令列文獻搜尋工具,透過 [OpenAlex](https://openalex.org/) API 查論文,並自動產生 Markdown 報告(含總覽表、單篇摘要與 DOI / 免費 PDF 連結)與原始 JSON,方便後續閱讀與分析。

- 免費、免 API key(OpenAlex 開放使用)
- 只需要 Node.js,無第三方套件依賴

## 需求

- Node.js 18 以上(需要內建的 `fetch`)

## 安裝

```bash
git clone https://github.com/akira0645/literature-search-tool-lex
cd literature-search-tool-lex
```

沒有需要 `npm install` 的依賴。

## 設定聯絡 email(必填)

OpenAlex 的 "polite pool" 會優先處理帶有聯絡 email 的請求,因此本工具要求先設定環境變數 `OPENALEX_EMAIL`:

**Windows PowerShell**
```powershell
$env:OPENALEX_EMAIL="you@example.com"
```

**macOS / Linux (bash / zsh)**
```bash
export OPENALEX_EMAIL="you@example.com"
```

> email 只會隨請求送給 OpenAlex,不會被本工具留存。想長期有效,可以加到 shell 設定檔(`~/.zshrc`、`~/.bashrc`)或 Windows 的系統環境變數。

## 使用方式

```bash
node search.mjs "<關鍵字>" [選項]
```

### 選項

| 選項 | 說明 | 預設 |
|------|------|------|
| `--limit N` | 回傳筆數(最多 200) | 20 |
| `--year 2020-2026` | 出版年份範圍,也接受 `2020-` 或 `2020` | 無限制 |
| `--sort MODE` | 排序:`relevance`(相關度)/ `citations`(引用數)/ `recent`(最新) | `relevance` |
| `--out FILE` | 自訂輸出 Markdown 路徑 | `results/<關鍵字>.md` |

### 範例

```bash
# 基本搜尋
node search.mjs "online learning engagement"

# 限定年份、調高筆數
node search.mjs "theory of planned behavior e-learning" --limit 30 --year 2020-

# 按引用數排序,近年文獻
node search.mjs "digital inequality" --sort citations --year 2022-2026

# 指定輸出檔名
node search.mjs "six thinking hats" --out my_report.md
```

## 輸出

每次執行會在 `results/` 目錄下產生兩個檔案:

- `<關鍵字>.md` — 人類可讀的報告(總覽表 + 單篇詳細資訊 + 摘要)
- `<關鍵字>.json` — OpenAlex 回傳的原始資料,方便後續程式化處理

Markdown 報告結構:

1. 查詢資訊(日期、來源、筆數)
2. 📊 **總覽表**:編號、年份、引用數、標題、作者、期刊
3. 📚 **單篇詳細資訊**:作者、期刊、引用數、主題標籤、DOI、免費 PDF 連結、完整 Abstract
4. 每篇留有「🔍 理論框架分析」欄位,方便讀後手動補上筆記

## 資料來源

- [OpenAlex API 文件](https://docs.openalex.org/)
- OpenAlex 收錄 2 億+ 筆學術著作,資料完全開放(CC0)

## 授權

MIT
