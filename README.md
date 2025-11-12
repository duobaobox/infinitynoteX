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
# 一键全平台 (mac + win + linux)
npm run electron:build:all

# 单平台
npm run electron:build:mac
npm run electron:build:win
npm run electron:build:linux

# 脚本可交互模式：
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
