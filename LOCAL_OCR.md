# 本地真实 OCR 使用说明

## 你需要准备

一个 OpenAI API Key。

创建地址：

https://platform.openai.com/api-keys

不要把 API Key 发给别人，也不要写进网页代码。

## 第一次使用

1. 复制 `.env.example`。
2. 把复制出来的文件改名为 `.env`。
3. 打开 `.env`，把 `OPENAI_API_KEY=` 后面替换成你的 API Key。
4. 双击 `START_LOCAL.bat`。
5. 看到窗口里出现：

```text
课文小老师本地服务已启动：http://localhost:8787
```

6. 用浏览器打开：

```text
http://localhost:8787
```

## 使用 OCR

1. 选择小朋友。
2. 选择或创建课文。
3. 进入“拍课文/习题”。
4. 上传一张或多张图片。
5. 调整图片顺序。
6. 点击“一键 OCR”。
7. 等待识别结果出现在文本框中。
8. 手动校对后保存素材。

## 常见问题

### 点击 OCR 提示“请先启动本地服务”

说明你可能还在用 `file://` 打开页面，或者 `START_LOCAL.bat` 没有启动。

请打开：

```text
http://localhost:8787
```

### 提示缺少 OPENAI_API_KEY

检查 `.env` 文件是否存在，并且里面有：

```text
OPENAI_API_KEY=你的key
```

### 识别结果不理想

- 图片尽量拍正。
- 不要遮挡文字。
- 多页课文先调整好顺序。
- 识别后可以在文本框里手动校对。
