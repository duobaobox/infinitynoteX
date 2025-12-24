# InfinityNoteX 发版操作手册

## 📋 发版流程概览

```
修改版本号 → 提交代码 → 创建 Tag → 自动构建 → 发布 Release
```

---

## 🚀 第一步：修改版本号

打开 `package.json`，找到 `version` 字段，修改为新版本号：

```json
{
  "name": "note",
  "version": "1.0.4",  // ← 修改这里
  ...
}
```

| 版本号规则 | 示例          | 说明                 |
| ---------- | ------------- | -------------------- |
| 主版本     | 1.0.0 → 2.0.0 | 重大更新，不兼容旧版 |
| 次版本     | 1.0.0 → 1.1.0 | 新功能               |
| 修订版     | 1.0.0 → 1.0.1 | Bug 修复             |

---

## 📤 第二步：提交代码并创建 Tag

在终端中执行以下命令：

```bash
# 1. 提交版本号修改
git add package.json
git commit -m "chore: bump version to v1.0.4"
git push

# 2. 创建版本 Tag（触发自动构建）
git tag v1.0.4
git push origin v1.0.4
```

> ⚠️ **注意**：Tag 名称必须以 `v` 开头，如 `v1.0.4`

---

## ⏳ 第三步：等待自动构建

1. 打开 GitHub Actions 页面：
   - https://github.com/duobaobox/infinitynotex/actions

2. 可以看到正在运行的构建任务

3. 等待约 **15-20 分钟**，三个平台构建完成

| 平台    | 产物                 |
| ------- | -------------------- |
| macOS   | `.dmg` + `.zip`      |
| Windows | `.exe` + `.zip`      |
| Linux   | `.AppImage` + `.zip` |

---

## ✅ 第四步：发布 Release

构建完成后，安装包会上传到发布仓库：

1. 打开发布仓库 Releases：
   - https://github.com/duobaobox/duobaobox-infinitynotex-releases/releases

2. 找到 **Draft**（草稿）状态的 Release

3. 点击 **Edit**（编辑）

4. 填写版本说明（更新内容）

5. 点击 **Publish release**（发布）

---

## 🔄 用户如何获取更新

发布后：

- 新用户：从 Releases 页面下载安装包
- 已安装用户：应用内自动检测更新

---

## 📝 快速命令参考

```bash
# 一键发版（修改好版本号后执行）
git add package.json && \
git commit -m "chore: bump version to vX.X.X" && \
git push && \
git tag vX.X.X && \
git push origin vX.X.X
```

将 `vX.X.X` 替换为实际版本号。

---

## ❓ 常见问题

### Q: 构建失败怎么办？

点击失败的任务查看错误日志，修复后重新打 Tag。

### Q: 如何删除错误的 Tag？

```bash
git tag -d v1.0.4
git push origin :refs/tags/v1.0.4
```

### Q: 如何跳过某个版本？

直接发布更高版本号即可，如从 1.0.3 直接到 1.0.5。
