# 发布与云端存储说明

## 推荐方案

- 前端发布：Vercel
- 云端存储：Supabase
- 登录：MVP 不做登录，只用家庭空间码

## 你需要做的事

### 1. 创建 Supabase 项目

1. 打开 Supabase。
2. 新建项目。
3. 进入 SQL Editor。
4. 复制 `supabase_schema.sql` 的内容并执行。
5. 到 Project Settings > API，复制：
   - Project URL
   - anon public key

### 2. 在网页里连接云端

1. 打开 `index.html`。
2. 左侧找到“云端设置”。
3. 填入 Supabase URL 和 anon key。
4. 点击“连接云端”。
5. 之后家庭空间会保存到 Supabase。

### 3. 发布到 Vercel

最简单方式：

1. 把整个文件夹上传到一个 GitHub 仓库。
2. 打开 Vercel。
3. Import 这个仓库。
4. Framework Preset 选择 Other。
5. Build Command 留空。
6. Output Directory 留空或使用根目录。
7. Deploy。

发布后，把 Vercel 链接发给朋友即可。

## 当前 MVP 云端存储方式

Supabase 中只使用一张表：

```text
spaces
  code: 家庭空间码
  data: 这个空间完整 JSON 数据
```

优点：

- 上线最快。
- 改字段不需要频繁改数据库。
- 适合早期内测。

限制：

- 没有真正登录。
- 空间码相当于访问凭证，需要保护好。
- 不适合存放敏感信息。
- 后续正式版应增加登录、权限和更规范的数据表。
