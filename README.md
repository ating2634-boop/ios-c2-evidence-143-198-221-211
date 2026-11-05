# DarkSword / Coruna — iOS 盗U 投放体系 静态取证包

> **English abstract** — Static-analysis artifact set for a live iOS watering-hole exploit
> delivery chain (`DarkSword` / `Coruna` family). Contains the original client-side payload
> (byte-exact, SHA-256 verifiable), the deobfuscation scripts and recovered strings, a
> structural analysis report, and a defanged infrastructure survey. **The payload is live
> malware — do not execute.** Third-party victim data and administrative credentials observed
> during the engagement have been deliberately excluded from this repository.

---

## 0. 这是什么

一台攻击者 VPS 在对外投放 iOS 漏洞利用链。本仓库保存了**客户端侧全部投放载荷的原始字节**、
静态还原脚本、还原产物、结构分析报告，以及同一家族在公网上的基础设施测绘结果。

面向的读者：做移动端恶意代码分析、Safari/JavaScriptCore 漏洞研究、威胁情报与检测规则工程的人。

**这不是一份"漏洞报告"，也补不出 0day。** 载荷是成品混淆 bundle，本仓库提供的是一份
**可校验的样本 + 可复现的还原路径 + 结构判读**，不是可读源码。

---

## 1. 目录

```
payload/       14 个原始载荷文件（逐字节原始，混淆态）
portals/        2 个投放落地页原始文件
analysis/
  ios-payload/  REPORT.md + 解混淆产物 + 还原脚本
  family-recon/ 同家族公网基础设施测绘原始结果
MANIFEST.sha256  16 项 SHA-256 校验表
```

### `payload/` — 投放链各阶段（共 5,715,932 B）

| 文件 | 大小 | 作用 |
|---|---:|---|
| `config.js` | 232 | 阶段配置（含硬编码 C2 端点） |
| `boot.js` | 13,619 | 第二阶段 loader，含 stage 机与 channel code |
| `index.js` | 47,726 | iOS <18.1 本地 exploit kit 入口（四层混淆） |
| `rce_loader.js` | 12,460 | RCE loader，含 offsets / chipset / device_model 逻辑 |
| `rce_module.js` | 454,783 | 按版本分发的模块载体 |
| `rce_module_18.6.js` | 85 | iOS 18.6 模块指针 |
| `rce_worker_18.4.js` | 47,801 | exploit worker（18.4 回退） |
| `rce_worker_18.5.js` | 833,762 | exploit worker（18.5 回退） |
| `rce_worker_18.6.js` | **603,420** | **exploit 主体**（推荐版本） |
| `rce_worker_18.7.js` | 1,294,054 | exploit worker（18.7） |
| `sbx0_main_18.4.js` | 425,856 | 沙箱逃逸第一阶段 |
| `sbx1_main.js` | 318,348 | 沙箱逃逸第二阶段 |
| `pe_main.js` | 870,905 | post-exploitation 主模块 |
| `pe_worker.js` | 792,881 | post-exploitation worker |

### `portals/` — 投放落地页（共 2,497,188 B）

| 文件 | 大小 | 说明 |
|---|---:|---|
| `caishen.js` | 1,872,043 | 「财神」主题盗U 落地页 bundle |
| `opsdeck.js` | 625,145 | 另一个投放页 bundle |

---

## 2. 样本完整性

所有样本可用 `MANIFEST.sha256` 校验（相对本仓库根，**16/16 已验证通过**）：

```bash
sha256sum -c MANIFEST.sha256
```

`payload/` 与 `portals/` 内文件**未做任何改动**。样本内部硬编码的 C2 端点、
`__LAB_*` 标记等一律保留原样——否则会在字节层面破坏样本、并使哈希校验失效。

> ⚠️ **样本内硬编码的 C2 是 `143.198.221[.]211`（当时在线）。**
> 它原样留在 `config.js` / `pe_main.js` / `pe_worker.js` / `rce_worker_18.5.js` 里，
> 只是为了保住字节完整性。**请不要访问它**，也不要向它注册设备或写日志——
> 那是操作者仍在控制的系统，任何请求都会把你自己的地址交出去。
**仅在 `analysis/` 的文本与 JSON 中做了 IP defang**（`1.2.3.4` → `1.2.3[.]4`），
所以 `analysis/` 的字面量与样本内的字面量会有 `[.]` 差异，这是刻意的。

---

## 3. 技术结构（详见 `analysis/ios-payload/REPORT.md`）

**投放分流**：iOS < 18.1 走本地 kit（`index.js`）；iOS 18.1–18.7 拉外挂 C2 链；
每 120 秒强制 reload 重投。

**`index.js` 四层混淆**：

1. 每个字符串数组独立 XOR key → 40 位 SHA-256 形态标识符
2. `obChTK = new Function(atob(39900 字符))` → `let MM = { hash: base64(src) }`
3. `MM` 表做 hash→base64，`new Function(atob(...))` 动态执行
4. `ZKvD0e(M)` 按需加载器：`SHA256(prefix+M).substring(0,40)` 生成路径，XHR 拉模块

**模块 A — JavaScriptCore 类型混淆原语**（8309 字符）：

```javascript
const f = new Uint32Array(new ArrayBuffer(8)), g = new Float64Array(f.buffer);
b(t) = float→lo32 ; U(t) = float→hi32 ; B(a,b) = two u32 → float   // addrof / fakeobj
class m { it, et }                                                // 64 位地址运算
```

**模块 B — iOS 版本 → 内存偏移表**：37 条版本配置（iOS 10.0 起，覆盖 10.0–17.3），
每条带该版本专属偏移。

**阶段状态机**（`boot.js` 原文）：

```javascript
var STAGE = { boot:8, loader:18, worker:42, sbx0:58, sbx1:72, pe:86, post:100 };
// channel: __LAB_CHANNEL_CODE__ / __CORUNA_CHANNEL__ / lab_channel_code
```

`rce_worker_18.6.js` 内可检索到原语密度：`keychain` × 92、`PAC` × 234、`addrof` × 32、
`fakeobj` × 15、`kernel` × 93。

---

## 4. IOC

**全部 defang**（`[.]` = `.`）。完整清单见 `analysis/ios-payload/REPORT.md` §5 / §14。

| 类型 | 值 |
|---|---|
| campaign ID | `cecd08aa6ff548c2` |
| 家族 | `darksword`（API 自报） / `Coruna`（频道变量） |
| 部署名 | `muiu38-mirror` |
| 页面标记 | `__ds_rce_hold` / `__ds_chain_hold` / `__er_frame_at` / `__LAB_DELIVERY_HOST__` |
| 全局对象 | `window.NEWS2_CONFIG` / `__LAB_CHAIN_CODE__` / `__CORUNA_CHANNEL__` |
| 设备侧 API | `/api/ds/chain-targets` / `/api/ds/device/register` / `/api/ds/log` |
| exploit 路径 | `/next-chain/rce_loader.js` / `/next-chain/rce_worker_18.5.js` / `/next-chain/rce_worker_18.6.js` |
| 混淆器标识 | `obChTK` / `MM` / `ZKvD0e` / `hPL3On` / `po3QmN` / `eW4__H` |

基础设施测绘（`analysis/family-recon/`，2026-11-03 采样）：
`title="weifile"` 166 条、`title="DarkSword"` 641 条、`body="rce_worker_18"` 9 条。

**检测提示**：同一套后端按 Host 动态改写页面，`https://<域名>/` 与
`http://<IP>:8081/` 字节级一致（`sha256=f8bce44a...`）。**封单域名无效，必须整池封。**

---

## 5. 本仓库刻意不包含

取证过程中还触及了若干**第三方仍在运行的 C2 管理后台**，以及其数据库内的设备/钱包/聊天
记录。那些内容**一律未纳入本仓库**，包括：

- 任何管理后台的口令、JWT、会话凭据
- 设备清单、exfil 记录、钱包地址、照片/即时通讯导出等他人数据
- 我方作业主机的地址与配置

原因很直白：那些不是一个恶意样本可以公开的部分，它们属于**别人正在被侵害的东西**，
以及**别人还在运行的系统**。技术研究不需要它们。

---

## 6. 诚实边界

- 全部结论来自**静态还原**（XOR / atob / JSON 解码）与只读取证。
  **未执行任何 exploit 代码，未运行 `new Function`。**
- **未连接 C2 下发面**（`/next-chain/*`）——会向操作者暴露我方地址。
- 报告 §12 已如实登记：该主机上我方**未取得任何权限（L0）**；
  报告 §13 如实登记了当时产生的副作用（2 条测试写入）。
- 载荷为混淆态 bundle。`analysis/ios-payload/` 里的 `deobf.py` / `recover.py` /
  `unwrap.py` / `unwrap2.py` 是**尝试还原的过程脚本**，产出为
  `stage1_obChTK.js` / `stage2-3_all_functions.js` / `recovered_strings.txt`，
  **不是可读源码**。

---

## 7. 使用与责任

样本为**活体恶意代码**。

- 只做静态分析；不要在浏览器、Node、WebView 或任何 JavaScriptCore 环境里 require/import 它。
- 只有在隔离、断网、快照可回滚的分析环境里才考虑动态分析，且应先自行完成去 C2 化改造。
- 本仓库以「威胁研究与检测工程」为目的分发。不授予任何将其用于攻击、投放或牟利的许可。
- 分析文本可按 CC BY 4.0 引用；**样本本体不附带任何使用许可**。

---

## 8. 引用

```
DarkSword / Coruna iOS delivery kit — static forensic artifact set
captured 2026-11-03 · campaign cecd08aa6ff548c2 · 16 files / 8,213,120 B (SHA-256 in MANIFEST.sha256)
```
