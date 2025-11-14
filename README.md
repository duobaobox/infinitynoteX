# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
};
```

## 打包构建

新增跨平台打包脚本与命令：

```bash
# 交互式总入口（现在的默认 build）
npm run build

# 一键全平台 (mac + win + linux)
npm run build:all
npm run electron:build:all

# 单平台
npm run electron:build:mac
npm run electron:build:win
npm run electron:build:linux

# 脚本可交互模式（等同于 npm run build）
npm run electron:build           # 弹出选择菜单
bash scripts/build-all.sh        # 弹出选择菜单
bash scripts/build-all.sh --all  # 直接全部
```

脚本支持参数：

```bash
--all          全平台打包
--mac          仅 Mac (x64 + arm64)
--win          仅 Windows (x64)
--linux        仅 Linux (x64)
--skip-assets  跳过前端/主进程构建，复用已有 dist
--dry-run      显示将执行的 electron-builder 命令，不真正打包
```

可通过环境变量追加构建标志：

```bash
BUILDER_EXTRA_FLAGS="--publish never" bash scripts/build-all.sh --all
```

产物输出在 `release/<version>/` 目录（由 `electron-builder.json5` 的 `directories.output` 决定）。

Windows 安装包构建若无 `wine`, 脚本自动 fallback 生成 portable/zip。

### 仅构建前端/主进程（不打包）

如需单独构建渲染与主进程产物（不进行 electron-builder 打包），可执行：

```bash
npm run web:build
```

### 后续可优化方向

1. CI 集成：在 GitHub Actions / GitLab CI 中调用脚本，使用 matrix 策略分平台或统一在 macOS runner 打包。
2. 代码签名：

- macOS: Developer ID + notarization (使用 `CSC_LINK`/`APPLE_ID` 等环境变量)
- Windows: signtool / osslsigncode 证书签名 NSIS 安装包

3. 自动发布：整合 `electron-builder --publish` 到脚本，或用 `release-it`/`semantic-release`。
4. 参数增强：支持 `--version 0.1.0` 覆盖 package.json 版本，或 `--publish auto`。
5. 构建缓存：使用 `tsc --incremental` 和 Vite 缓存提升重复构建速度。
6. 多架构扩展：Linux arm64 / mac universal DMG 按需追加。
7. 失败重试：针对偶发的网络签名 / 上传失败添加自动重试逻辑。

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list

## 自动更新（electron-updater）

项目现已集成 [electron-updater](https://www.electron.build/auto-update) 与前端提示组件 `UpdateNotifier`，可在主窗口右下角查看更新状态、手动检查并在下载完成后点击“立即重启更新”。

启用自动更新需要注意：

1. **发布渠道**：`electron-builder.json5` 默认配置 GitHub Releases (`duobaobox/infinitynotex`) 作为 `publish` 目标，打包时设置 `GH_TOKEN=<your-token>` 即可自动上传并生成 `latest-*.yml`。如需自建服务器，设置 `INFINITY_UPDATER_URL=https://your-domain/path` 环境变量（generic provider）即可覆盖下载源。
2. **版本号**：每次发版前务必更新 `package.json` 的 `version`，否则客户端不会检测到新版本。
3. **签名与 notarize**：macOS / Windows 仍需按照脚本注释配置证书相关环境变量，保证自动更新包可被系统信任。
4. **检查频率**：通过 `INFINITY_UPDATER_INITIAL_DELAY_MS`（默认 15s）和 `INFINITY_UPDATER_INTERVAL_MS`（默认 6h）调整开机延迟与轮询周期。
5. **调试**：开发模式下自动更新被禁用（界面会提示），需要打包后的应用才能完整验证。可先发布 Draft Release，在另一台安装旧版本的机器上验证下载-安装流程。

Build 脚本、UI、主进程的更改均已就绪，你只需准备发布凭据并上传安装包，即可让实际用户获得增量更新体验。
