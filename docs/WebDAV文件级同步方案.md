# WebDAV 文件级同步方案

## 背景与问题

### 当前问题

- **index.json 损坏**: 旧方案依赖索引文件,一旦写入异常导致数据不一致
- **增量同步缺陷**: 新设备无法获取历史数据
- **AI 对话写入异常**: 流式写入时索引更新频繁,容易出错

### 设计目标

1. **无索引文件**: 每条数据独立存储,通过文件系统扫描获取列表
2. **可靠同步**: 新设备可直接下载所有文件
3. **冲突解决**: 基于文件修改时间的 LWW 策略

---

## 数据存储结构

```
~/Library/Application Support/note/
├── app.db                    # SQLite (本地缓存 + 全文搜索)
├── app-config.json           # 应用配置
└── data/
    ├── folders/
    │   └── {folderId}.json   # 每个文件夹一个文件
    ├── notes/
    │   └── {noteId}.json     # 每条便签一个文件
    ├── conversations/
    │   └── {convId}.json     # 每个 AI 对话一个文件
    ├── browser-cards/
    │   └── {cardId}.json     # 每个浏览器卡片一个文件
    └── trash/
        └── {trashId}.json    # 每个回收站项一个文件
```

---

## WebDAV 远程结构

```
/InfinityNoteX/
├── folders/
│   └── {folderId}.json
├── notes/
│   └── {noteId}.json
├── conversations/
│   └── {convId}.json
├── browser-cards/
│   └── {cardId}.json
└── .sync/
    ├── manifest.json         # 远程文件清单 (哈希 + 时间戳)
    └── devices/
        └── {deviceId}.json   # 设备同步状态
```

---

## 文件格式设计

### 便签文件 (notes/{id}.json)

```json
{
  "id": "note-uuid",
  "folderId": "folder-uuid",
  "title": "便签标题",
  "content": {
    /* TipTap JSON */
  },
  "tags": ["tag1", "tag2"],
  "pinned": false,
  "color": "#ffffff",
  "createdAt": 1702500000000,
  "updatedAt": 1702500000000,
  "_meta": {
    "version": 1,
    "deviceId": "device-uuid"
  }
}
```

### AI 对话文件 (conversations/{id}.json)

```json
{
  "id": "conv-uuid",
  "title": "对话标题",
  "messages": [
    { "role": "user", "content": "...", "timestamp": 1702500000000 },
    { "role": "assistant", "content": "...", "timestamp": 1702500001000 }
  ],
  "model": "gpt-4",
  "createdAt": 1702500000000,
  "updatedAt": 1702500000000,
  "_meta": {
    "version": 1,
    "deviceId": "device-uuid"
  }
}
```

---

## 同步流程

### 1. 推送 (Push)

```
本地 → WebDAV
```

1. 扫描本地 `data/` 目录所有文件
2. 对比远程 `manifest.json`
3. 上传新增/修改的文件
4. 更新远程 `manifest.json`

### 2. 拉取 (Pull)

```
WebDAV → 本地
```

1. 下载远程 `manifest.json`
2. 对比本地文件 (基于哈希/时间戳)
3. 下载新增/更新的文件
4. 删除远程已删除的文件

### 3. 冲突解决

| 场景            | 策略                  |
| --------------- | --------------------- |
| 本地更新 > 远程 | 保留本地,上传         |
| 远程更新 > 本地 | 保留远程,下载         |
| 同时修改        | LWW (Last Write Wins) |

---

## 无索引的列表获取

**不再使用 index.json**,改为:

### 方案 A: 文件系统扫描 (本地)

```typescript
async function listNotes(): Promise<NoteIndex[]> {
  const files = await fs.readdir('data/notes/');
  return Promise.all(
    files.map(async (f) => {
      const note = JSON.parse(await fs.readFile(f));
      return { id: note.id, title: note.title, updatedAt: note.updatedAt };
    }),
  );
}
```

### 方案 B: SQLite 缓存 (推荐)

```typescript
// 启动时扫描文件,同步到 SQLite
// 后续读取列表从 SQLite 获取 (毫秒级)
// 写入时同时更新文件和 SQLite
```

---

## SQLite 的角色

| 功能            | 实现方式                     |
| --------------- | ---------------------------- |
| 本地列表缓存    | 启动时从文件同步到 SQLite    |
| 全文搜索 (FTS5) | 从 SQLite 搜索               |
| 数据持久化      | **JSON 文件** (真正的数据源) |
| 同步            | **JSON 文件** (WebDAV 传输)  |

**简化**: SQLite 只是**缓存层**,JSON 文件才是**数据源**。

---

## 实施计划

### Phase 1: 数据层改造

- [ ] 创建 `FileStorage` 类,管理 JSON 文件读写
- [ ] 启动时扫描文件,同步到 SQLite 缓存
- [ ] 修改 Repository 写入时同时更新文件和 SQLite

### Phase 2: 同步引擎

- [ ] 实现基于文件的三方比较同步
- [ ] manifest.json 管理远程文件清单
- [ ] 冲突检测与解决

### Phase 3: 原子写入

- [ ] 先写临时文件,再重命名 (避免损坏)
- [ ] AI 对话节流写入 (避免频繁 IO)

---

## 风险与缓解

| 风险       | 缓解措施                        |
| ---------- | ------------------------------- |
| 文件扫描慢 | 使用 SQLite 缓存,只在启动时扫描 |
| 并发写入   | 使用文件锁或队列                |
| 大量小文件 | 合理的批量同步策略              |

---

## 与 Joplin 对比

| 特性     | Joplin          | 本方案                  |
| -------- | --------------- | ----------------------- |
| 存储格式 | Markdown + JSON | JSON                    |
| 索引文件 | 无 (扫描目录)   | 无 (扫描 + SQLite 缓存) |
| 全文搜索 | SQLite FTS      | SQLite FTS              |
| 同步方式 | 文件级对比      | 文件级对比              |
| 冲突解决 | updatedTime     | updatedAt (LWW)         |
